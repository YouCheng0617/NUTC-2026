import type { Request, Response } from "express";
import { createMember, loginMember, forgotPassword, resetPassword } from "./auth.service.js";
import { countHelper } from "../../lib/countHelper.js";
import prisma from "../../lib/prisma.js";

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
            const displayData = {
                member_id: countHelper(newMember.member_id),
                email: newMember.email,
                name: newMember.name,
            };
            res.status(201).json({
                message: "註冊成功!請前往登入",
                data: displayData
            });
        } catch (error) {
            res.status(400).json({
                message: "註冊失敗",
                data: String(error)
            });
        }
    }

    async logout(req: Request, res: Response) {
        try {
            const token = req.headers.authorization?.split(" ")[1] as string;
            const member_id = (req as any).user?.member_id;

            await prisma.blacklistedToken.create({
                data: {
                    token: token,
                    member_id: member_id!,
                }
            });
            return res.status(200).json({ message: "登出成功" });
        } catch (error) {
            return res.status(500).json({ message: "登出過程出了一點小意外" });
        }
    }

    async forgotPassword(req: Request, res: Response) {
        try {
            const { email } = req.body;
            if (!email) {
                return res.status(400).json({ message: "請提供註冊的信箱" });
            }

            const resetToken = await forgotPassword(email);
            res.status(200).json({
                message: "密碼重設信已寄送，請檢查您的信箱",
            });

        } catch (error) {
            console.error('forgotPassword Controller 錯誤:', error);
            return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試' });
        }
    }

    async resetPassword(req: Request, res: Response) {
        try {
            const { token, newPassword } = req.body;
            if (!token || !newPassword) {
                return res.status(400).json({ message: "請提供重設密碼所需的憑證和新密碼" });
            }
            await resetPassword(token, newPassword);
            res.status(200).json({ message: "密碼重設成功" });

        } catch (error) {
            if (error instanceof Error) {
                return res.status(400).json({ message: error.message });
            }

            console.error('resetPassword Controller 錯誤:', error);
            return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試' });
        }
    }
}



export const authController = new AuthController();