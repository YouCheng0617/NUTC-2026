import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";
import prisma from "../../lib/prisma.js";


export interface AuthRequest extends Request {
    user?: string | jwt.JwtPayload;
}
interface TokenPayload {
    member_id: number;
    email: string;
}

export const authCheck = async (req: AuthRequest, res: Response, next: NextFunction) => {
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
        /*as unknown as TokenPayload ---二次跳轉，先轉成unknown再轉成TokenPayload，解決兩個型別差太多不轉的情況*/
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY!) as unknown as TokenPayload;

        const memberstatus = await prisma.member.findUnique({
            where: { member_id: decoded.member_id },
            select: { status: true },
        });
        if (!memberstatus) {
            return res.status(404).json({ message: "找不到使用者" });
        }
        if (memberstatus?.status === "BANNED") {
            return res.status(403).json({ message: "帳號已被封鎖，若有疑問請聯繫客服" });
        }
        if (memberstatus?.status === "INACTIVE") {
            return res.status(403).json({ message: "帳號未啟用，請先驗證帳號" });
        }

        req.user = decoded;
        next();
    } catch (error: any) {
        return res.status(403).json({
            message: "憑證無效或過期!?",
            real_error_name: error.name,       // 錯誤的種類
            real_error_message: error.message
        });
    }
}