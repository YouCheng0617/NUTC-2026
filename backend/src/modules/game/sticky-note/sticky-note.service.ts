import prisma from "../../../lib/prisma.js";
import { aiServiceUrl } from "../../../lib/aiService.js";
import { createNotification } from "../../notification/notification.service.js";
import { alertAdmins } from "../../../lib/adminAlert.js";

const getTodayDate = (): string => {
    const now = new Date();

    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return taiwanTime.toISOString().split("T")[0] as string;
}

/* 便利貼審核狀態，跟瓶子一樣：0 待審、1 通過、2 違規 */
export const NOTE_PENDING = 0;
export const NOTE_APPROVED = 1;
export const NOTE_REJECTED = 2;

const AI_REVIEW_TIMEOUT_MS = 60 * 1000;
// AI 服務在 Gemini 出錯、沒設金鑰時會回「通過」加上這兩種原因，那其實是沒審到（跟 ai_db_worker.py 同一套判斷）
const AI_UNAVAILABLE_REASONS = new Set(["AI回應異常防護", "無 API Key 防護"]);

export const createDailyNote = async (member_id: number, content: string) => {
    const today = getTodayDate();

    const existingNote = await prisma.daliyNote.findUnique({
        where: {
            member_id_date: {
                member_id: member_id,
                date: today
            }
        }
    })

    if (existingNote) {
        throw new Error("今天已經有寫便利貼了")
    }

    const note = await prisma.daliyNote.create({
        data: {
            member_id: member_id,
            content: content,
            date: today,
            status: NOTE_PENDING // 先待審，AI 審過才給大家看
        }
    });

    // 不等 AI：發文的人先拿到回應，審核在背景跑
    reviewNoteByAi(note.id, note.member_id, note.content)
        .catch(err => console.error("便利貼 AI 審核失敗:", err));

    return note;
}

/* 🤖 把便利貼送給 AI 服務（/api/analyze）審核
 * AI 沒回應就留在待審，讓管理員在後台審 */
const reviewNoteByAi = async (noteId: number, memberId: number, content: string) => {
    let aiData: { ai_status?: string; ai_reason?: string } | undefined;
    try {
        const response = await fetch(aiServiceUrl("/api/analyze"), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content }),
            signal: AbortSignal.timeout(AI_REVIEW_TIMEOUT_MS),
        });
        if (!response.ok) {
            console.warn(`⚠️ 便利貼 #${noteId} AI 審核回傳 ${response.status}，留給管理員審`);
            return;
        }
        aiData = ((await response.json()) as { data?: typeof aiData }).data;
    } catch (error) {
        console.warn(`⚠️ 便利貼 #${noteId} 連不到 AI 服務，留給管理員審:`, error);
        return;
    }

    if (!aiData || AI_UNAVAILABLE_REASONS.has(aiData.ai_reason ?? "")) {
        console.warn(`⚠️ 便利貼 #${noteId} AI 暫時無法審核，留給管理員審`);
        return;
    }

    const passed = aiData.ai_status === "通過";
    // 只改還在待審的：AI 還沒回來前管理員可能已經先審了
    const updated = await prisma.daliyNote.updateMany({
        where: { id: noteId, status: NOTE_PENDING },
        data: {
            status: passed ? NOTE_APPROVED : NOTE_REJECTED,
            violation_reason: passed ? null : (aiData.ai_reason || null),
        }
    });
    if (updated.count > 0 && !passed) {
        await notifyNoteRejected(memberId, aiData.ai_reason);
    }
}

/* 🔔 便利貼被判違規，通知作者 */
const notifyNoteRejected = async (memberId: number, reason?: string | null) => {
    const reasonText = reason ? ` 原因：${reason}` : '請留意社群規範。';
    await createNotification(memberId, 'SYSTEM_ALERT', `你的便利貼沒有通過審核，沒有貼到海面上。${reasonText}`)
        .catch(err => console.error("便利貼違規通知發送失敗:", err));
}

/* 今天的便利貼：大家只看得到通過的；自己那張還在審核中也看得到（標成審核中） */
export const getDailyNote = async (memberId?: number) => {
    const today = getTodayDate();

    const notes = await prisma.daliyNote.findMany({
        where: {
            date: today,
            OR: [
                { status: NOTE_APPROVED },
                ...(memberId ? [{ member_id: memberId, status: NOTE_PENDING }] : [])
            ]
        },
        orderBy: {
            created_at: "desc"
        },
        select: {
            id: true,
            member_id: true,
            content: true,
            created_at: true,
            status: true
        }
    });

    // 便利貼是匿名的：不把作者 ID 傳出去，只告訴他哪張是自己的
    return notes.map(({ member_id, ...note }) => ({ ...note, is_mine: member_id === memberId }));
}

/* 🚩 檢舉便利貼 */
export const reportDailyNote = async (noteId: number, memberId: number, reason: string) => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) throw new Error("REPORT_REASON_EMPTY");

    const note = await prisma.daliyNote.findUnique({
        where: { id: noteId },
        select: { member_id: true, status: true, content: true }
    });
    if (!note || note.status !== NOTE_APPROVED) throw new Error("NOTE_NOT_FOUND");
    if (note.member_id === memberId) throw new Error("CANNOT_REPORT_OWN");

    let report;
    try {
        report = await prisma.noteReport.create({
            data: { note_id: noteId, member_id: memberId, reason: trimmedReason }
        });
    } catch (error: any) {
        if (error.code === "P2002") throw new Error("ALREADY_REPORTED");
        throw error;
    }

    // 🚨 這張第一次被檢舉（還沒處理的只有這一筆）才寄信提醒管理員
    const pendingCount = await prisma.noteReport.count({ where: { note_id: noteId, status: 0 } });
    if (pendingCount === 1) {
        alertAdmins({ kind: "便利貼檢舉", context: "今天的便利貼", summary: note.content, detail: trimmedReason });
    }
    return report;
}

/* ===== 後台 ===== */

/* 今天所有便利貼（不管狀態），附作者與檢舉 */
export const getDailyNotesForAdmin = async () => {
    const today = getTodayDate();
    return prisma.daliyNote.findMany({
        where: { date: today },
        orderBy: { created_at: "desc" },
        include: {
            member: { select: { member_id: true, name: true, email: true } },
            reports: {
                orderBy: { created_at: "desc" },
                include: { reporter: { select: { member_id: true, name: true } } }
            }
        }
    });
}

/* 管理員審核：通過（待處理的檢舉算不成立）或下架（待處理的檢舉算成立，並通知作者） */
export const reviewDailyNote = async (noteId: number, status: number, violationReason?: string) => {
    const before = await prisma.daliyNote.findUnique({
        where: { id: noteId },
        select: { status: true, member_id: true }
    });
    if (!before) throw new Error("NOTE_NOT_FOUND");

    const rejected = status === NOTE_REJECTED;
    const reason = rejected ? (violationReason?.trim() || null) : null;
    await prisma.$transaction([
        prisma.daliyNote.update({
            where: { id: noteId },
            data: { status, violation_reason: reason }
        }),
        prisma.noteReport.updateMany({
            where: { note_id: noteId, status: 0 },
            data: { status: rejected ? 1 : 2 }
        })
    ]);

    if (rejected && before.status !== NOTE_REJECTED) {
        await notifyNoteRejected(before.member_id, reason);
    }
}
