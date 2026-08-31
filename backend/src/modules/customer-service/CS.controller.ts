import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import {
    createCustomerServiceTicket,
    getUserCustomerServiceTickets,
    getCustomerServiceTicketById
} from "./CS.service.js";

export class CSController {
    // 會員送出客服問題
    async createTicket(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入或無效憑證" });
            }

            const { title, message } = req.body;
            if (!title || typeof title !== "string" || !title.trim()) {
                return res.status(400).json({ message: "請填寫客服問題主旨" });
            }
            if (!message || typeof message !== "string" || !message.trim()) {
                return res.status(400).json({ message: "請填寫客服問題詳細內容" });
            }

            const ticket = await createCustomerServiceTicket(memberId, title, message);
            return res.status(201).json({
                message: "客服問題已成功送出！",
                data: ticket
            });
        } catch (error) {
            console.error("送出客服問題時發生錯誤:", error);
            return res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    // 取得使用者自己的客服紀錄列表
    async getMyTickets(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const tickets = await getUserCustomerServiceTickets(memberId);
            return res.status(200).json({
                message: "獲取客服紀錄成功",
                data: tickets
            });
        } catch (error) {
            console.error("獲取客服紀錄時發生錯誤:", error);
            return res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    // 取得單一客服問題詳情
    async getTicketDetail(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const ticketId = Number(req.params.id);

            if (!ticketId || isNaN(ticketId)) {
                return res.status(400).json({ message: "無效的客服問題 ID" });
            }

            const ticket = await getCustomerServiceTicketById(ticketId, memberId);
            if (!ticket) {
                return res.status(404).json({ message: "找不到該筆客服紀錄或無權限查看" });
            }

            return res.status(200).json({
                message: "獲取客服詳情成功",
                data: ticket
            });
        } catch (error) {
            console.error("獲取客服詳情時發生錯誤:", error);
            return res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
}