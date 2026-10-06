import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { createAnnouncement, getActiveAnnouncements, DANMAKU_MESSAGE_MAX } from "./announcement.service.js";

export const announcementController = {

    /* 取得正在跑的揪團彈幕（訪客也能看） */
    async list(req: AuthRequest, res: Response) {
        try {
            const data = await getActiveAnnouncements(req.user?.member_id);
            return res.status(200).json({ message: "成功取得揪團彈幕", data });
        } catch (error) {
            console.error("取得揪團彈幕錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    },

    /* 發揪團彈幕：房號必須是正在開的寵物遊戲房間 */
    async create(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            const { roomId, message } = req.body ?? {};
            const data = await createAnnouncement(memberId, roomId, message);
            return res.status(201).json({ message: "揪團彈幕已發出，會在首頁跑 3 分鐘", data });

        } catch (error: any) {
            if (error.message === "INVALID_ROOM_ID") {
                return res.status(400).json({ message: "房號格式不對，是 6 碼英文或數字喔" });
            }
            if (error.message === "ROOM_NOT_FOUND") {
                return res.status(404).json({ message: "找不到這個房間，請確認房間還開著" });
            }
            if (error.message === "MESSAGE_TOO_LONG") {
                return res.status(400).json({ message: `想說的話最多 ${DANMAKU_MESSAGE_MAX} 個字` });
            }
            if (error.message === "MEMBER_NOT_FOUND") {
                return res.status(404).json({ message: "找不到該名會員" });
            }
            console.error("發揪團彈幕錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
};
