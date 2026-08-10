import type { Request, Response } from 'express';
import type { AuthRequest } from '../middleware/auth.middleware.js';
import { getUserNotifications, markNotificationAsRead, markAllNotificationsAsRead } from './notification.service.js';

export class NotificationController {

    // 1. 取得當前登入使用者的通知列表
    async getMyNotifications(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }

            const notifications = await getUserNotifications(memberId);
            return res.status(200).json({
                message: "成功獲取通知",
                data: notifications
            });
        } catch (error: any) {
            console.error("getMyNotifications 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤，無法獲取通知" });
        }
    }

    // 2. 將單筆通知標記為已讀
    async readNotification(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const notificationId = Number(req.params.id);

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (isNaN(notificationId)) {
                return res.status(400).json({ message: "無效的通知 ID" });
            }

            await markNotificationAsRead(notificationId, memberId);
            return res.status(200).json({ message: "已標記為已讀" });
        } catch (error: any) {
            console.error("readNotification 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }

    // 3. 一鍵全部標記為已讀
    async readAllNotifications(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }

            await markAllNotificationsAsRead(memberId);
            return res.status(200).json({ message: "已全部標記為已讀" });
        } catch (error: any) {
            console.error("readAllNotifications 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }
}