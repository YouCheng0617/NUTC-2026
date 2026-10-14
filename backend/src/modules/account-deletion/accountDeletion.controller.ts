import type { Request, Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware.js";
import {
    requestDeletion, confirmDeletion, denyDeletion,
    cancelDeletionByLink,
} from "./accountDeletion.service.js";

/*信件連結帶來的憑證只收字串*/
const readToken = (req: Request) => {
    const token = req.body?.token;
    return typeof token === "string" && token ? token : null;
};

const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    console.error(`${label} 錯誤:`, error);
    return res.status(500).json({ message: "伺服器發生錯誤，請稍後再試" });
};

export const accountDeletionController = {

    /*登入後申請註銷（需再輸入一次密碼）*/
    async request(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }
            const { password, agree } = req.body ?? {};
            if (agree !== true) {
                return res.status(400).json({ message: "請先閱讀並同意註銷規則" });
            }
            if (typeof password !== "string" || !password) {
                return res.status(400).json({ message: "請輸入密碼" });
            }

            const result = await requestDeletion(memberId, password, req.ip ?? "未知");
            return res.status(200).json({
                message: `確認信已寄到 ${result.email}，請在 24 小時內點信中的按鈕完成確認`,
                data: result,
            });
        } catch (error) {
            return fail(res, error, "requestDeletion");
        }
    },

    /*信裡的「確認註銷」*/
    async confirm(req: Request, res: Response) {
        try {
            const token = readToken(req);
            if (!token) return res.status(400).json({ message: "缺少憑證，請從信件中的連結進入。" });

            const { scheduledAt } = await confirmDeletion(token);
            return res.status(200).json({
                message: "已確認註銷，帳號進入 7 天後悔期",
                data: { scheduledAt },
            });
        } catch (error) {
            return fail(res, error, "confirmDeletion");
        }
    },

    /*信裡的「這不是我」*/
    async deny(req: Request, res: Response) {
        try {
            const token = readToken(req);
            if (!token) return res.status(400).json({ message: "缺少憑證，請從信件中的連結進入。" });

            const { resetMailSent } = await denyDeletion(token);
            return res.status(200).json({
                message: resetMailSent
                    ? "已取消這次申請並登出所有裝置，重設密碼信已寄出，請盡快更換密碼"
                    : "已取消這次申請並登出所有裝置，請到登入頁使用「忘記密碼」更換密碼",
                data: { resetMailSent },
            });
        } catch (error) {
            return fail(res, error, "denyDeletion");
        }
    },

    /*信裡的「取消註銷」*/
    async cancelByLink(req: Request, res: Response) {
        try {
            const token = readToken(req);
            if (!token) return res.status(400).json({ message: "缺少憑證，請從信件中的連結進入。" });

            await cancelDeletionByLink(token);
            return res.status(200).json({ message: "已取消註銷，歡迎回來！請重新登入" });
        } catch (error) {
            return fail(res, error, "cancelDeletionByLink");
        }
    },
};
