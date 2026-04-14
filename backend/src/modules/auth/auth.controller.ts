import type { Request, Response } from "express";
import { createMember, loginMember } from "./auth.service.js";

export class AuthController {

    async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            if (!email || !password) {
                return res.status(400).json({ message: "信箱與密碼為必填欄位" });
            }
            const token = await loginMember(email, password);
            res.status(200).json({
                message: "登入成功!歡迎回來",
                data: { result: token }
            });
        } catch (error) {
            res.status(400).json({
                message: "登入失敗",
                data: String(error)
            });
        }
    }

    /*呼叫註冊服務，處理會員註冊邏輯*/
    async register(req: Request, res: Response) {
        try {
            const newMember = await createMember(req.body);
            res.status(201).json({
                message: "註冊成功!請前往登入",
                data: newMember
            });
        } catch (error) {
            res.status(400).json({
                message: "註冊失敗",
                data: String(error)
            });
        }
    }
}

export const authController = new AuthController();