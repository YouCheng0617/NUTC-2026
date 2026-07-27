import type { Request, Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware.js";
import { createMember, loginMember, forgotPassword, resetPassword, updateMember, followMember, getFollowedMembers, getFollowerList } from "./auth.service.js";
import { countHelper } from "../../lib/countHelper.js";
import { verifyCaptcha } from "../../lib/captchaHelper.js";
import prisma from "../../lib/prisma.js";
export class AuthController {

    async login(req: Request, res: Response) {
        try {
            const { email, password, captchaId, userInput } = req.body;
            if (!captchaId || !userInput) {
                return res.status(400).json({ message: "驗證碼為必填欄位" });
            }
            if (!verifyCaptcha(captchaId, userInput)) {
                return res.status(400).json({ message: "驗證碼錯誤或已過期，請重新輸入" });
            }
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
    async updateMemberData(req: Request, res: Response) {
        try {
            const memberId = (req as any).user?.member_id;

            if (!memberId) {
                return res.status(400).json({ message: "未授權，請先登入" });
            }
            const { name, birthday, blood_type, bio } = req.body;

            const updatedMember = await updateMember(memberId, {
                name,
                birthday,
                blood_type,
                bio
            });
            res.status(200).json({ message: "會員資料更新成功", data: updatedMember });

        } catch (error: any) {
            if (error.message === "生日格式錯誤，請使用有效的日期格式!") {
                return res.status(400).json({ message: error.message });
            }
            if (error.message === "找不到該會員，無法更新資料。") {
                return res.status(404).json({ message: error.message });
            }

            console.error('updateMemberData Controller 錯誤:', error);
            return res.status(500).json({ message: '伺服器發生錯誤，請稍後再試', data: String(error) });
        }
    }
    async followMembers(req: AuthRequest, res: Response) {
        try {
            const followerId = req.user?.member_id;
            const followedId = Number(req.body.followedId);

            if (!followerId || isNaN(followedId)) {
                return res.status(400).json({ message: "請提供有效的會員 ID" });
            }

            const result = await followMember(followerId, followedId);
            res.status(200).json({
                message: result.message,
                data: {
                    isFollowing: result.isFollowing
                }
            });

        } catch (error: any) {
            if (error.message === "CANNOT_FOLLOW_SELF") {
                return res.status(400).json({ message: "不能追蹤自己喔！" });
            }
            if (error.message === "TARGET_NOT_FOUND") {
                return res.status(404).json({ message: "找不到該名會員" });
            }

            console.error("追蹤會員發生錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
    async getFollowerListData(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id!;
            const followers = await getFollowerList(memberId);

            return res.status(200).json({
                message: "成功獲取粉絲列表",
                data: followers
            });

        } catch (error: any) {
            console.error("獲取粉絲列表錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
    async getFollowingList(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const following = await getFollowedMembers(memberId!);

            return res.status(200).json({
                message: "成功獲取追蹤中列表",
                data: following
            });

        } catch (error: any) {
            console.error("獲取追蹤中列表錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
}
export const authController = new AuthController();