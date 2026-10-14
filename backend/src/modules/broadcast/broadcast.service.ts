import prisma from "../../lib/prisma.js";

/*
 * 全服通知
 * 只存一筆，讀取通知列表時混進每個人的通知裡；誰看過記在 BroadcastRead。
 * 前端的通知 id 用 "b-<id>"，避免跟個人通知的 id 撞號。
 */

export const BROADCAST_TYPE = "BROADCAST";
export const BROADCAST_ID_PREFIX = "b-";
const MAX_CONTENT = 300;
const MAX_VISIBLE = 20; // 通知列表最多混入幾則全服通知

/*目前大家看得到的：啟用中、還沒過期*/
const visibleWhere = () => ({
    is_active: true,
    OR: [{ expires_at: null }, { expires_at: { gt: new Date() } }],
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
        where: visibleWhere(),
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
    const visible = await prisma.broadcast.findFirst({ where: { id: broadcastId, ...visibleWhere() }, select: { id: true } });
    if (!visible) return;
    await prisma.broadcastRead.createMany({
        data: [{ broadcast_id: broadcastId, member_id: memberId }],
        skipDuplicates: true,
    });
};

export const markAllBroadcastsRead = async (memberId: number) => {
    const visible = await prisma.broadcast.findMany({ where: visibleWhere(), select: { id: true } });
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

export const listBroadcasts = async () => {
    const [broadcasts, memberCount] = await Promise.all([
        prisma.broadcast.findMany({
            orderBy: { created_at: "desc" },
            include: { _count: { select: { reads: true } } },
        }),
        prisma.member.count({ where: { status: "ACTIVE" } }),
    ]);
    const now = new Date();
    return {
        memberCount,
        broadcasts: broadcasts.map(({ _count, ...b }) => ({
            ...b,
            read_count: _count.reads,
            /*active：大家看得到 / disabled：管理員停用 / expired：過期*/
            state: !b.is_active ? "disabled" : b.expires_at && b.expires_at <= now ? "expired" : "active",
        })),
    };
};

export const createBroadcast = async (adminId: number, body: { content?: unknown; expires_at?: unknown }) => {
    return prisma.broadcast.create({
        data: {
            content: normalizeContent(body.content),
            expires_at: normalizeExpiry(body.expires_at),
            created_by: adminId,
        },
    });
};

/*修改內容不會重設已讀，看過的人不會再跳一次未讀*/
export const updateBroadcast = async (id: number, body: { content?: unknown; expires_at?: unknown }) => {
    const exists = await prisma.broadcast.findUnique({ where: { id }, select: { id: true } });
    if (!exists) throw new Error("找不到這則全服通知");
    return prisma.broadcast.update({
        where: { id },
        data: {
            content: normalizeContent(body.content),
            expires_at: normalizeExpiry(body.expires_at),
        },
    });
};

export const setBroadcastActive = async (id: number, isActive: boolean) => {
    const result = await prisma.broadcast.updateMany({ where: { id }, data: { is_active: isActive } });
    if (result.count === 0) throw new Error("找不到這則全服通知");
};

export const deleteBroadcast = async (id: number) => {
    const result = await prisma.broadcast.deleteMany({ where: { id } });
    if (result.count === 0) throw new Error("找不到這則全服通知");
};
