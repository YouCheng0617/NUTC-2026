import type { Request, Response, NextFunction } from "express";
import jwt from "jsonwebtoken";

export interface AuthRequest extends Request {
    user?: string | jwt.JwtPayload;
}

export const authCheck = (req: AuthRequest, res: Response, next: NextFunction) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
        return res.status(401).json({ message: "無此授權或格式錯誤" });
    }

    const token = authHeader.split(" ")[1] as string;
    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET_KEY as string);
        req.user = decoded;
        next();
    } catch (error) {
        return res.status(403).json({ message: "憑證無效或過期" });
    }
}