import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";

export interface AuthRequest extends Request {
    user?: TokenPayload;
}
interface TokenPayload {
    member_id: number;
    email: string;
    role: string;
}

/*
 * AI 服務的身分驗證：只收 x-ai-api-key 這個 header。
 * 原本還接受 ?key=xxx，但放在網址上的金鑰會被 nginx access log、
 * 瀏覽器歷史與 Referer 記下來，等於把管理員權限公開，所以移除。
 * AI 端 (AI/src/ai_db_worker.py) 本來就只帶 header，不受影響。
 */
const isAiRequest = (req: Request): boolean => {
    const secret = process.env.AI_SECRT_KEY;
    /*環境變數沒設定時一律不放行，避免兩邊都是 undefined 就通過*/
    if (!secret) return false;

    const aiApiKey = req.headers["x-ai-api-key"];
    return typeof aiApiKey === "string" && aiApiKey === secret;
};


export const authCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
    /*給AI用的*/
    if (isAiRequest(req)) {
        console.log("系統提示：AI通過驗證");
        return next();
    }

    /*給人用的*/
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "無此授權或格式錯誤" });
    }

    const token = authHeader.split(" ")[1] as string;

    try {
        const isBlacklisted = await prisma.blacklistedToken.findUnique({
            where: { token: token },
        });
        if (isBlacklisted) {
            return res.status(403).json({ message: "此憑證已被封鎖，請重新登入" });
        }

        /*as unknown as TokenPayload ---二次跳轉*/
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as unknown as TokenPayload;

        // 🌟 優化這裡：把 role 也一起 select 出來！
        const memberData = await prisma.member.findUnique({
            where: { member_id: decoded.member_id },
            select: { status: true, role: true }, // 👈 增加 role: true
        });

        if (!memberData) {
            return res.status(404).json({ message: "找不到使用者" });
        }
        if (memberData.status === "BANNED") {
            return res.status(403).json({ message: "帳號已被封鎖，若有疑問請聯繫客服" });
        }
        if (memberData.status === "INACTIVE") {
            return res.status(403).json({ message: "帳號未啟用，請先驗證帳號" });
        }

        // 🌟 組合技：把解碼的 token 資料，加上資料庫最新的 role 賦予給 req.user
        req.user = {
            ...decoded,
            role: memberData.role
        };

        next();
    } catch (error: any) {
        /*細節只留在伺服器 log，不回傳給前端，避免洩漏 JWT 的內部錯誤訊息*/
        console.error("JWT 驗證失敗:", error.name, error.message);
        return res.status(401).json({ message: "憑證無效或過期，請重新登入" });
    }
}

/*辨識對方是不是管理員*/
/*辨識對方是不是管理員 (Schema 升級版)*/
export const adminCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (isAiRequest(req)) {
            console.log("系統提示：AI通過驗證");
            return next();
        }

        if (!req.user) {
            return res.status(401).json({ message: "尚未登入" });
        }

        // 🌟 直接去資料庫查這個人的 role 是不是 ADMIN
        const member = await prisma.member.findUnique({
            where: { member_id: req.user.member_id },
            select: { role: true } // 只撈權限欄位，節省效能
        });

        if (!member || member.role !== "ADMIN") {
            return res.status(403).json({ message: "權限不足！您不是管理員 🚫" });
        }

        next(); // 是管理員，請進！
    } catch (error) {
        console.error("Admin check error:", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};

export const optionalAuthCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return next();
    }
    const token = authHeader.split(" ")[1] as string;

    try {
        const isBlacklisted = await prisma.blacklistedToken.findUnique({
            where: { token: token },
        });
        if (isBlacklisted) {
            return next()
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as unknown as TokenPayload;
        const memberData = await prisma.member.findUnique({
            where: { member_id: decoded.member_id },
            select: { status: true, role: true },
        });

        if (!memberData || memberData.status === "BANNED" || memberData.status === "INACTIVE") {
            return next();
        }

        req.user = {
            ...decoded,
            role: memberData.role
        };
        next();
    } catch (error: any) {
        return next();
    }

}