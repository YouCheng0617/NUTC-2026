import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { Request, Response } from "express";
import jwt from "jsonwebtoken";
import { isAiRequest, type AuthRequest } from "../modules/middleware/auth.middleware.js";

/*
 * 流量限制工具
 * 依照 IP 計算次數，避免有人用腳本狂打 API。
 * 正式環境跑在 nginx 反向代理後面，index.ts 需設定 trust proxy，
 * 否則抓到的會是代理的 IP，所有使用者會被算成同一個人。
 */

/*超過限制時統一回傳 JSON，格式與其他 API 一致*/
const limitHandler = (message: string) => {
    return (req: Request, res: Response) => {
        console.warn(`⚠️ [流量限制] ${req.ip} 觸發限制：${req.originalUrl}`);
        return res.status(429).json({ message });
    };
};

/*註冊：同一個 IP 每小時最多 10 次*/
export const registerLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 10,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitHandler("註冊次數過於頻繁，請稍後再試（每小時最多 10 次）。"),
});

/*寄送信件（重寄驗證信、忘記密碼）：同一個 IP 每小時最多 5 次*/
export const emailLimiter = rateLimit({
    windowMs: 60 * 60 * 1000,
    limit: 5,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitHandler("信件寄送過於頻繁，請稍後再試（每小時最多 5 次）。"),
});

/*
 * 以下是防止亂刷 API 的限制。
 * 有登入就用會員 ID 計算 (同一個人換 IP 也算同一個)，沒登入才用 IP；
 * IPv6 用 ipKeyGenerator 以網段計算，避免換一個位址就重新計數。
 */
const tokenMemberId = (req: Request): number | null => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith("Bearer ")) return null;
    try {
        const decoded = jwt.verify(authHeader.split(" ")[1] as string, process.env.JWT_SECRET_KEY!) as { member_id?: number };
        return typeof decoded.member_id === "number" ? decoded.member_id : null;
    } catch {
        return null;
    }
};

const memberOrIpKey = (req: Request): string => {
    /*放在 authCheck 之後的限制器可以直接用 req.user；全站限制器在驗證之前，要自己解 token*/
    const memberId = (req as AuthRequest).user?.member_id ?? tokenMemberId(req);
    return memberId ? `member:${memberId}` : `ip:${ipKeyGenerator(req.ip ?? "")}`;
};

/*建立「每個會員 / IP」的限制器*/
const perMemberLimiter = (windowMs: number, limit: number, message: string) => rateLimit({
    windowMs,
    limit,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    keyGenerator: memberOrIpKey,
    handler: limitHandler(message),
});

const WRITE_METHODS = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/*
 * 全站寫入限制：所有 POST / PUT / PATCH / DELETE 共用
 * 寵物遊戲每點一下就送一次請求 (跳動音符 0.5 秒一次)，額度給比較寬
 * AI 審核程式用金鑰呼叫，不受限制
 */
export const writeLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: (req) => req.path.startsWith("/pet-games") ? 300 : 120,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skip: (req) => !WRITE_METHODS.has(req.method) || isAiRequest(req),
    keyGenerator: (req) => `${req.path.startsWith("/pet-games") ? "pet" : "write"}:${memberOrIpKey(req)}`,
    handler: limitHandler("操作太頻繁了，請稍後再試。"),
});

/*登入：同一個 IP 15 分鐘內失敗 20 次就暫停；成功登入不計次，學校網路多人共用 IP 也不會被誤擋*/
export const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 20,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    skipSuccessfulRequests: true,
    handler: limitHandler("登入失敗次數過多，請 15 分鐘後再試。"),
});

/*驗證碼：同一個 IP 每分鐘最多 30 張，避免被拿來塞爆伺服器記憶體*/
export const captchaLimiter = rateLimit({
    windowMs: 60 * 1000,
    limit: 30,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    handler: limitHandler("驗證碼請求過於頻繁，請稍後再試。"),
});

/*發文：每人 10 分鐘最多 10 篇*/
export const postBottleLimiter = perMemberLimiter(10 * 60 * 1000, 10, "發文太頻繁了，請 10 分鐘後再試。");

/*留言與回覆：每人 10 分鐘最多 30 則*/
export const commentLimiter = perMemberLimiter(10 * 60 * 1000, 30, "留言太頻繁了，請稍後再試。");

/*檢舉：每人每小時最多 10 次*/
export const reportLimiter = perMemberLimiter(60 * 60 * 1000, 10, "檢舉次數過多，請稍後再試。");

/*客服：每人每小時最多 5 筆*/
export const csTicketLimiter = perMemberLimiter(60 * 60 * 1000, 5, "客服問題送出太頻繁，請稍後再試（每小時最多 5 筆）。");
