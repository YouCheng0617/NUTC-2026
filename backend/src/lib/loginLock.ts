import crypto from "crypto";
import prisma from "./prisma.js";
import { sendEmailLoginLocked } from "./mailer.js";

/*
 * 登入被暫停時寄信通知本人
 * 信裡有「是我本人，解除鎖定」與「不是我，去改密碼」兩條路。
 * 鎖定計數本來就放在記憶體 (loginAccountLimiter)，解鎖憑證也放記憶體，後端重啟兩者一起歸零。
 */

const UNLOCK_TOKEN_TTL = 30 * 60 * 1000; // 解鎖連結 30 分鐘有效
const NOTIFY_COOLDOWN = 15 * 60 * 1000; // 同一個帳號 15 分鐘內只寄一封，避免被拿來轟炸信箱

type UnlockRecord = { email: string; lockedIp: string; expiresAt: number };

const unlockTokens = new Map<string, UnlockRecord>();
const lastNotified = new Map<string, number>();

/*順手清掉過期資料，避免 Map 越長越大*/
const sweep = () => {
    const now = Date.now();
    for (const [token, record] of unlockTokens) {
        if (record.expiresAt < now) unlockTokens.delete(token);
    }
    for (const [email, time] of lastNotified) {
        if (now - time > NOTIFY_COOLDOWN) lastNotified.delete(email);
    }
};

/*帳號被暫停登入時呼叫；查無帳號或未啟用就不寄，回應給前端的內容不受影響*/
export const notifyLoginLocked = async (email: string, lockedIp: string) => {
    if (!email) return;
    sweep();
    if (lastNotified.has(email)) return;
    lastNotified.set(email, Date.now());

    const member = await prisma.member.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { email: true, status: true },
    });
    if (!member || member.status !== "ACTIVE") return;

    const token = crypto.randomBytes(32).toString("hex");
    unlockTokens.set(token, { email, lockedIp, expiresAt: Date.now() + UNLOCK_TOKEN_TTL });

    await sendEmailLoginLocked(member.email, token, lockedIp);
};

/*使用解鎖憑證 (只能用一次)，成功回傳被鎖的信箱與 IP*/
export const consumeUnlockToken = (token: string) => {
    const record = unlockTokens.get(token);
    unlockTokens.delete(token);
    if (!record || record.expiresAt < Date.now()) return null;
    return record;
};
