import rateLimit from "express-rate-limit";
import type { Request, Response } from "express";

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
