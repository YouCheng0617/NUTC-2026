import prisma from "../../lib/prisma.js";
import { getBlockedMemberIds } from "../block/block.service.js";
import { getRoomInfo } from "../../socket/petServer.js";

/*
 * 揪團彈幕：寵物遊戲的玩家把房號發到首頁，在標題列下方跑 3 分鐘
 * 只活 3 分鐘，所以放在記憶體就好，不進資料庫（後端重啟時正在跑的彈幕會消失）
 */
export const DANMAKU_LIFETIME_MS = 3 * 60 * 1000;
export const DANMAKU_MESSAGE_MAX = 30;
const DANMAKU_MAX_ACTIVE = 30;
const ROOM_ID_PATTERN = /^[A-Z0-9]{6}$/; // 寵物遊戲開房時產生的 6 碼英數字

interface Announcement {
    id: number;
    memberId: number;
    name: string;
    roomId: string;
    message: string;
    createdAt: number;
    expiresAt: number;
}

let nextId = 1;
let announcements: Announcement[] = [];

// 過期的、房間已經關掉的都拿掉
const prune = () => {
    const now = Date.now();
    announcements = announcements.filter((a) => a.expiresAt > now && getRoomInfo(a.roomId) !== null);
};

export const createAnnouncement = async (memberId: number, rawRoomId: string, rawMessage: string) => {
    const roomId = String(rawRoomId || "").trim().toUpperCase();
    if (!ROOM_ID_PATTERN.test(roomId)) {
        throw new Error("INVALID_ROOM_ID");
    }
    if (!getRoomInfo(roomId)) {
        throw new Error("ROOM_NOT_FOUND");
    }

    // 一句話：拿掉換行與控制字元，限制字數
    const message = String(rawMessage || "")
        .replace(/[\u0000-\u001f\u007f]/g, " ")
        .replace(/\s+/g, " ")
        .trim();
    if ([...message].length > DANMAKU_MESSAGE_MAX) {
        throw new Error("MESSAGE_TOO_LONG");
    }

    const member = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: { name: true }
    });
    if (!member) {
        throw new Error("MEMBER_NOT_FOUND");
    }

    prune();
    // 同一個房間、同一個人只留最新的一則，重發就是「頂上來」
    announcements = announcements.filter((a) => a.roomId !== roomId && a.memberId !== memberId);

    const now = Date.now();
    const announcement: Announcement = {
        id: nextId++,
        memberId,
        name: member.name,
        roomId,
        message,
        createdAt: now,
        expiresAt: now + DANMAKU_LIFETIME_MS
    };
    announcements.push(announcement);
    if (announcements.length > DANMAKU_MAX_ACTIVE) {
        announcements = announcements.slice(-DANMAKU_MAX_ACTIVE);
    }
    return formatAnnouncement(announcement);
};

export const getActiveAnnouncements = async (viewerId?: number) => {
    prune();
    const blockedIds = viewerId ? await getBlockedMemberIds(viewerId) : [];
    return announcements
        .filter((a) => !blockedIds.includes(a.memberId))
        .map(formatAnnouncement);
};

const formatAnnouncement = (a: Announcement) => {
    const room = getRoomInfo(a.roomId);
    return {
        id: a.id,
        name: a.name,
        room_id: a.roomId,
        message: a.message,
        players: room?.players ?? 0,
        max_players: room?.maxCapacity ?? 0,
        created_at: new Date(a.createdAt).toISOString(),
        expires_at: new Date(a.expiresAt).toISOString()
    };
};
