import type { Response } from "express";
import { type AuthRequest } from "../middleware/auth.middleware.js";
import { blockMember, unblockMember, getMyBlockList } from "./block.service.js";

export const blockController = {

    /* 封鎖會員 */
    async block(req: AuthRequest, res: Response) {
        try {
            const blockerId = req.user?.member_id;
            const blockedId = Number(req.params.memberId);

            if (!blockerId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }
            if (!blockedId || isNaN(blockedId)) {
                return res.status(400).json({ message: "請提供有效的會員 ID" });
            }

            await blockMember(blockerId, blockedId);
            return res.status(200).json({
                message: "已封鎖該會員",
                data: { isBlocked: true }
            });
        } catch (error: any) {
            if (error.message === "CANNOT_BLOCK_SELF") {
                return res.status(400).json({ message: "不能封鎖自己喔！" });
            }
            if (error.message === "TARGET_NOT_FOUND") {
                return res.status(404).json({ message: "找不到該名會員" });
            }
            console.error("封鎖會員發生錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    },

    /* 解除封鎖 */
    async unblock(req: AuthRequest, res: Response) {
        try {
            const blockerId = req.user?.member_id;
            const blockedId = Number(req.params.memberId);

            if (!blockerId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }
            if (!blockedId || isNaN(blockedId)) {
                return res.status(400).json({ message: "請提供有效的會員 ID" });
            }

            await unblockMember(blockerId, blockedId);
            return res.status(200).json({
                message: "已解除封鎖",
                data: { isBlocked: false }
            });
        } catch (error) {
            console.error("解除封鎖發生錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    },

    /* 取得我的封鎖名單 */
    async getBlockList(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }

            const list = await getMyBlockList(memberId);
            return res.status(200).json({
                message: `你總共封鎖了 ${list.length} 位會員`,
                data: list
            });
        } catch (error) {
            console.error("取得封鎖名單發生錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
};
