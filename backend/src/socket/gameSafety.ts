import prisma from '../lib/prisma.js';

/*
 * 寵物遊戲連線房間的封鎖與檢舉
 *
 * 封鎖（遊戲專用，跟論壇的 Block 分開）：
 * - 被封鎖的人不能進封鎖者當房主的房間
 * - 在別人的房間遇到，雙方互相看不到對方的聊天
 * 檢舉：附上房間最近的聊天紀錄送後台，由管理員審核
 *
 * 前端不知道其他玩家的會員 ID（petServer 不會送），所以封鎖、檢舉都是用房間裡的 socketId 指定對象，
 * 由伺服器換成會員 ID。
 */

/* ---------- 封鎖 ---------- */

/* 會員 -> 跟他有封鎖關係的會員（不分誰封鎖誰），聊天過濾用；進房時載入 */
const conflicts = new Map<number, Set<number>>();

export const loadConflicts = async (memberId: number) => {
    const rows = await prisma.gameBlock.findMany({
        where: { OR: [{ blocker_id: memberId }, { blocked_id: memberId }] },
        select: { blocker_id: true, blocked_id: true },
    });
    conflicts.set(memberId, new Set(rows.map(r => (r.blocker_id === memberId ? r.blocked_id : r.blocker_id))));
};

/* 兩人之間有沒有封鎖關係（任一方封鎖都算） */
export const hasConflict = (a?: number, b?: number) =>
    !!a && !!b && (conflicts.get(a)?.has(b) || conflicts.get(b)?.has(a) || false);

const linkConflict = (a: number, b: number) => {
    conflicts.get(a)?.add(b);
    conflicts.get(b)?.add(a);
};

/* 房主有沒有封鎖這個人（有的話不能進他當房主的房間） */
export const isBlockedByHost = async (hostId: number, joinerId: number) =>
    !!(await prisma.gameBlock.findUnique({
        where: { blocker_id_blocked_id: { blocker_id: hostId, blocked_id: joinerId } },
        select: { id: true },
    }));

export const blockPlayer = async (blockerId: number, blockedId: number, petName: string) => {
    if (blockerId === blockedId) throw new Error('不能封鎖自己喔！');
    await prisma.gameBlock.upsert({
        where: { blocker_id_blocked_id: { blocker_id: blockerId, blocked_id: blockedId } },
        update: { blocked_pet_name: petName },
        create: { blocker_id: blockerId, blocked_id: blockedId, blocked_pet_name: petName },
    });
    linkConflict(blockerId, blockedId);
};

/* 我的封鎖名單：只給寵物名字和封鎖紀錄 ID，不透露對方帳號 */
export const listBlocks = (blockerId: number) =>
    prisma.gameBlock.findMany({
        where: { blocker_id: blockerId },
        select: { id: true, blocked_pet_name: true, created_at: true },
        orderBy: { created_at: 'desc' },
    });

export const unblock = async (blockerId: number, blockId: number) => {
    const row = await prisma.gameBlock.findFirst({ where: { id: blockId, blocker_id: blockerId } });
    if (!row) throw new Error('找不到這筆封鎖紀錄');
    await prisma.gameBlock.delete({ where: { id: blockId } });

    // 對方也封鎖我的話，聊天還是互相看不到
    const reverse = await prisma.gameBlock.findUnique({
        where: { blocker_id_blocked_id: { blocker_id: row.blocked_id, blocked_id: blockerId } },
        select: { id: true },
    });
    if (!reverse) {
        conflicts.get(blockerId)?.delete(row.blocked_id);
        conflicts.get(row.blocked_id)?.delete(blockerId);
    }
};

/* ---------- 房間聊天紀錄（檢舉證據用，只留在記憶體） ---------- */

interface ChatLine { memberId: number; petName: string; message: string; at: Date }
const CHAT_KEEP = 50;
const roomChats = new Map<string, ChatLine[]>();

export const recordRoomChat = (roomId: string, line: ChatLine) => {
    const list = roomChats.get(roomId) ?? [];
    list.push(line);
    if (list.length > CHAT_KEEP) list.shift();
    roomChats.set(roomId, list);
};

export const clearRoomChat = (roomId: string) => roomChats.delete(roomId);

/* ---------- 檢舉 ---------- */

export const REPORT_REASONS: Record<string, string> = {
    harassment: '騷擾或不當言論',
    bad_name: '不當的寵物名稱',
    trolling: '掛機或故意搗亂',
    other: '其他',
};

const EVIDENCE_LINES = 30;     // 附上房間最近幾句聊天
const SAME_TARGET_HOURS = 24;  // 同一個人 24 小時內只能檢舉一次
const REPORTS_PER_HOUR = 10;   // 每人每小時最多檢舉幾次

export const reportPlayer = async (params: {
    reporterId: number; reportedId: number; reportedPetName: string; roomId: string; reason: string; detail?: string;
}) => {
    const { reporterId, reportedId, reportedPetName, roomId, reason } = params;
    if (reporterId === reportedId) throw new Error('不能檢舉自己喔！');
    if (!REPORT_REASONS[reason]) throw new Error('請選擇檢舉理由！');
    const detail = typeof params.detail === 'string' ? params.detail.trim().slice(0, 200) : '';

    const now = Date.now();
    const [sameTarget, recentCount] = await Promise.all([
        prisma.gameReport.findFirst({
            where: { reporter_id: reporterId, reported_id: reportedId, created_at: { gte: new Date(now - SAME_TARGET_HOURS * 3600_000) } },
            select: { id: true },
        }),
        prisma.gameReport.count({ where: { reporter_id: reporterId, created_at: { gte: new Date(now - 3600_000) } } }),
    ]);
    if (sameTarget) throw new Error('你已經檢舉過這位玩家了，管理員會盡快處理！');
    if (recentCount >= REPORTS_PER_HOUR) throw new Error('檢舉次數太多了，請稍後再試。');

    // 證據：房間最近的聊天（標出哪幾句是被檢舉人說的，其他人只留寵物名字）
    const evidence = (roomChats.get(roomId) ?? []).slice(-EVIDENCE_LINES).map(l => ({
        petName: l.petName,
        message: l.message,
        at: l.at.toISOString(),
        isReported: l.memberId === reportedId,
    }));

    await prisma.gameReport.create({
        data: {
            reporter_id: reporterId,
            reported_id: reportedId,
            reported_pet_name: reportedPetName,
            reason,
            detail: detail || null,
            evidence,
            room_id: roomId,
        },
    });
};

/* ---------- 後台 ---------- */

export const getGameReports = (status?: number) =>
    prisma.gameReport.findMany({
        where: status === undefined ? {} : { status },
        orderBy: { created_at: 'desc' },
        include: {
            reporter: { select: { member_id: true, name: true, email: true } },
            reported: { select: { member_id: true, name: true, email: true, status: true } },
        },
    });

export const updateGameReportStatus = async (id: number, status: number) => {
    if (![0, 1, 2].includes(status)) throw new Error('狀態只能是 0（待處理）、1（成立）、2（不成立）');
    const row = await prisma.gameReport.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new Error('找不到這筆檢舉');
    return prisma.gameReport.update({ where: { id }, data: { status } });
};
