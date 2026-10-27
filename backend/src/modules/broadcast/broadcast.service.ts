import prisma from "../../lib/prisma.js";

/*
 * 管理員發送的通知（以前叫全服通知）
 * 只存一筆，讀取通知列表時混進收件人的通知裡；誰看過記在 BroadcastRead。
 * 收件人：BroadcastTarget 沒有任何一筆＝所有人，有的話只有那些人看得到。
 * 前端的通知 id 用 "b-<id>"，避免跟個人通知的 id 撞號。
 */

export const BROADCAST_TYPE = "BROADCAST";
export const BROADCAST_ID_PREFIX = "b-";
const MAX_CONTENT = 300;
const MAX_VISIBLE = 20; // 通知列表最多混入幾則管理員通知
const MAX_TARGETS = 200; // 指定收件人最多幾位

/*這個人目前看得到的：啟用中、還沒過期、發給所有人或有指定他*/
const visibleWhere = (memberId: number) => ({
    is_active: true,
    AND: [
        { OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }] },
        { OR: [{ targets: { none: {} } }, { targets: { some: { member_id: memberId } } }] },
    ],
});

/*"b-12" → 12；不是全服通知的 id 回傳 null*/
export const parseBroadcastNotifId = (raw: string) => {
    if (!raw.startsWith(BROADCAST_ID_PREFIX)) return null;
    const id = Number(raw.slice(BROADCAST_ID_PREFIX.length));
    return Number.isInteger(id) && id > 0 ? id : null;
};

/*給通知列表用：轉成跟個人通知一樣的格式*/
export const getVisibleBroadcastsFor = async (memberId: number) => {
    const broadcasts = await prisma.broadcast.findMany({
        where: visibleWhere(memberId),
        orderBy: { created_at: "desc" },
        take: MAX_VISIBLE,
        select: {
            id: true,
            content: true,
            created_at: true,
            reads: { where: { member_id: memberId }, select: { member_id: true } },
        },
    });
    return broadcasts.map(b => ({
        id: `${BROADCAST_ID_PREFIX}${b.id}`,
        member_id: memberId,
        actor_id: null,
        type: BROADCAST_TYPE,
        content: b.content,
        is_read: b.reads.length > 0,
        target_id: null,
        created_at: b.created_at,
    }));
};

export const markBroadcastRead = async (broadcastId: number, memberId: number) => {
    const visible = await prisma.broadcast.findFirst({ where: { id: broadcastId, ...visibleWhere(memberId) }, select: { id: true } });
    if (!visible) return;
    await prisma.broadcastRead.createMany({
        data: [{ broadcast_id: broadcastId, member_id: memberId }],
        skipDuplicates: true,
    });
};

export const markAllBroadcastsRead = async (memberId: number) => {
    const visible = await prisma.broadcast.findMany({ where: visibleWhere(memberId), select: { id: true } });
    if (visible.length === 0) return;
    await prisma.broadcastRead.createMany({
        data: visible.map(b => ({ broadcast_id: b.id, member_id: memberId })),
        skipDuplicates: true,
    });
};

// ---------- 後台 ----------

const normalizeContent = (raw: unknown) => {
    const content = typeof raw === "string" ? raw.trim() : "";
    if (!content) throw new Error("請輸入通知內容");
    if (content.length > MAX_CONTENT) throw new Error(`通知內容最多 ${MAX_CONTENT} 字`);
    return content;
};

/*null / "" = 不會過期；有填就要是未來的時間*/
const normalizeExpiry = (raw: unknown) => {
    if (raw === null || raw === undefined || raw === "") return null;
    const date = new Date(raw as string);
    if (isNaN(date.getTime())) throw new Error("到期時間格式錯誤");
    if (date <= new Date()) throw new Error("到期時間必須是未來的時間");
    return date;
};

/*收件人：沒傳或空陣列＝所有人；有傳就要是存在、沒被刪除的會員*/
const normalizeTargets = async (raw: unknown) => {
    if (raw === null || raw === undefined) return [];
    if (!Array.isArray(raw)) throw new Error("收件人格式錯誤");
    const ids = [...new Set(raw.map(Number))];
    if (ids.some(id => !Number.isInteger(id) || id <= 0)) throw new Error("收件人格式錯誤");
    if (ids.length > MAX_TARGETS) throw new Error(`一次最多指定 ${MAX_TARGETS} 位收件人`);
    if (ids.length === 0) return [];

    const found = await prisma.member.findMany({
        where: { member_id: { in: ids }, status: { not: "DELETED" } },
        select: { member_id: true },
    });
    const foundIds = new Set(found.map(m => m.member_id));
    const missing = ids.filter(id => !foundIds.has(id));
    if (missing.length > 0) throw new Error(`找不到這些使用者：ID ${missing.join("、")}`);
    return ids;
};

export const listBroadcasts = async () => {
    const [broadcasts, memberCount] = await Promise.all([
        prisma.broadcast.findMany({
            orderBy: { created_at: "desc" },
            include: {
                _count: { select: { reads: true } },
                targets: { select: { member: { select: { member_id: true, name: true } } } },
            },
        }),
        prisma.member.count({ where: { status: "ACTIVE" } }),
    ]);
    const now = new Date();
    return {
        memberCount,
        broadcasts: broadcasts.map(({ _count, targets, ...b }) => ({
            ...b,
            read_count: _count.reads,
            targets: targets.map(t => t.member), // 空陣列＝發給所有人
            /*active：收件人看得到 / disabled：管理員停用 / expired：過期*/
            state: !b.is_active ? "disabled" : b.expires_at && b.expires_at <= now ? "expired" : "active",
        })),
    };
};

type BroadcastBody = { content?: unknown; expires_at?: unknown; target_ids?: unknown };

export const createBroadcast = async (adminId: number, body: BroadcastBody) => {
    const content = normalizeContent(body.content);
    const expiresAt = normalizeExpiry(body.expires_at);
    const targetIds = await normalizeTargets(body.target_ids);
    return prisma.broadcast.create({
        data: {
            content,
            expires_at: expiresAt,
            created_by: adminId,
            targets: { create: targetIds.map(member_id => ({ member_id })) },
        },
    });
};

/*修改內容不會重設已讀，看過的人不會再跳一次未讀；沒傳 target_ids 就不動收件人*/
export const updateBroadcast = async (id: number, body: BroadcastBody) => {
    const exists = await prisma.broadcast.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new Error("找不到這則通知");
    const content = normalizeContent(body.content);
    const expiresAt = normalizeExpiry(body.expires_at);
    const targetIds = body.target_ids === undefined ? null : await normalizeTargets(body.target_ids);
    return prisma.broadcast.update({
        where: { id },
        data: {
            content,
            expires_at: expiresAt,
            ...(targetIds && {
                targets: { deleteMany: {}, create: targetIds.map(member_id => ({ member_id })) },
            }),
        },
    });
};

export const setBroadcastActive = async (id: number, isActive: boolean) => {
    const result = await prisma.broadcast.updateMany({ where: { id }, data: { is_active: isActive } });
    if (result.count === 0) throw new Error("找不到這則通知");
};

export const deleteBroadcast = async (id: number) => {
    const result = await prisma.broadcast.deleteMany({ where: { id } });
    if (result.count === 0) throw new Error("找不到這則通知");
};
