import type { Request, Response } from "express";
import { createMember } from "./auth.service.js";
export class AuthController {

    async login(req: Request, res: Response) {
        res.send('Login successful');
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