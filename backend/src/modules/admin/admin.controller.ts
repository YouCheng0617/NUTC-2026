import type { Response, Request } from "express";
import {
    getAllMembers,
    changeMemberStatus,
    getAllBottlesForAdmin,
    updateBottleStatus,
    deleteBottleByAdmin,
    deleteMemberByAdmin,
    getReportedBottles,
    getAllComments,
    getAllCustomerServiceTickets,
    getCustomerServiceTicketForAdmin,
    replyCustomerServiceTicket,
    updateCustomerServiceStatus,
    deleteCustomerServiceTicket
} from "./admin.service.js";

export class AdminController {

    /*獲取會員列表*/
    async getMembersList(req: Request, res: Response) {
        try {
            const members = await getAllMembers();
            res.status(200).json({
                message: "會員列表獲取成功",
                data: members
            });
        } catch (error) {
            console.error("Error fetching members list:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
    /*更新會員狀態*/
    async updateMemberStatus(req: Request, res: Response) {
        try {
            const memberId = Number(req.params.memberId);
            const { newStatus } = req.body;

            if (!memberId || isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員 ID" });
            }

            const validStatuses = ["ACTIVE", "INACTIVE", "BANNED"];
            if (!validStatuses.includes(newStatus)) {
                return res.status(400).json({ message: "無效的狀態值，只能是 ACTIVE、INACTIVE 或 BANNED" });
            }

            const updatedMember = await changeMemberStatus(memberId, newStatus as "ACTIVE" | "INACTIVE" | "BANNED");
            res.status(200).json({
                message: "會員狀態更新成功",
                data: updatedMember
            });
        } catch (error) {
            console.error("Error updating member status:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
    /*獲取瓶子列表*/
    async getBottlesList(req: Request, res: Response) {
        try {
            const bottles = await getAllBottlesForAdmin();
            res.status(200).json({
                message: "全站瓶子列表獲取成功",
                data: bottles
            });
        } catch (error) {
            console.error("Error fetching bottles list:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
    /*審核瓶子*/
    async reviewBottle(req: Request, res: Response) {
        try {
            // 🌟 因為 Router 已經掛了 adminCheck，能進來這裡的「絕對是人類管理員」，所以不用再檢查身分了！

            const { bottle_id, status, violation_reason } = req.body;
            if (!bottle_id || status === undefined || ![1, 2].includes(status)) {
                return res.status(400).json({
                    message: "請提供有效的 bottle_id 和 status，並且狀態只能是 1 (通過) 或 2 (違規)"
                });
            }

            // 呼叫 Service 執行更新 (Service 不用改，維持我們剛剛寫的那樣)
            const updateBottle = await updateBottleStatus(bottle_id, status, violation_reason);

            return res.status(200).json({
                message: `管理員已將瓶子 #${bottle_id} 的狀態更新為：${status === 1 ? '安全通過 🟢' : '違規下架 🔴'}`,
                data: {
                    status: updateBottle.status,
                    violation_reason: updateBottle.violation_reason
                }
            });

        } catch (error: any) {
            console.error("管理員審核瓶子時發生錯誤:", error);
            if (error.code === 'P2025') {
                return res.status(404).json({ message: "找不到該漂流瓶，請檢查瓶子 ID" });
            }
            return res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
    /*刪除瓶子*/
    async deleteBottle(req: Request, res: Response) {
        try {
            const bottleId = Number(req.params.bottleId);

            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            await deleteBottleByAdmin(bottleId);
            return res.status(200).json({ message: "漂流瓶已成功刪除" });

        } catch (error: any) {
            if (error.message === "BOTTLE_NOT_FOUND" || error.code === 'P2025') {
                return res.status(404).json({ message: "找不到該漂流瓶，請檢查瓶子 ID" });
            }
            console.error("Error deleting bottle:", error);
            return res.status(500).json({
                message: "內部伺服器錯誤",
                real_error: error.message || error.toString(),
                stack: error.stack
            });
        }
    }
    /*刪除會員*/
    async deleteMember(req: Request, res: Response) {
        try {
            const memberId = Number(req.params.memberId);

            if (isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員 ID" });
            }
            await deleteMemberByAdmin(memberId);
            return res.status(200).json({ message: "會員已成功刪除" });

        } catch (error: any) {
            if (error.message === "MEMBER_NOT_FOUND") {
                return res.status(404).json({ message: "找不到該會員，請檢查會員 ID" });
            }
            console.error("Error deleting member:", error);
            return res.status(500).json({
                message: "內部伺服器錯誤",
                real_error: error.message || error.toString(),
                stack: error.stack
            });
        }
    }
    /*獲取被檢舉的瓶子列表*/
    async getReportedBottlesController(req: Request, res: Response) {
        try {
            const reportedBottles = await getReportedBottles();

            return res.status(200).json({
                message: "成功獲取被檢舉的瓶子列表",
                data: reportedBottles
            });
        } catch (error: any) {
            console.error("Error fetching reported bottles:", error);
            return res.status(500).json({
                message: "內部伺服器錯誤",
                real_error: error.message || error.toString(),
                stack: error.stack
            });
        }
    }
    async getAllCommentsController(req: Request, res: Response) {
        try {
            const comments = await getAllComments();
            return res.status(200).json({
                message: "所有留言獲取成功",
                data: comments
            });
        } catch (error: any) {
            console.error("Error fetching comments:", error);
            return res.status(500).json({
                message: "內部伺服器錯誤",
                real_error: error.message || error.toString(),
                stack: error.stack
            });
        }
    }

    /* 獲取所有客服問題列表 */
    async getAllCustomerServices(req: Request, res: Response) {
        try {
            const status = req.query.status !== undefined ? Number(req.query.status) : undefined;
            const tickets = await getAllCustomerServiceTickets(status);
            res.status(200).json({
                message: "客服問題列表獲取成功",
                data: tickets
            });
        } catch (error) {
            console.error("Error fetching customer services:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    /* 獲取單筆客服問題詳情 */
    async getCustomerServiceDetail(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ message: "無效的客服問題 ID" });
            }
            const ticket = await getCustomerServiceTicketForAdmin(id);
            if (!ticket) {
                return res.status(404).json({ message: "找不到該筆客服紀錄" });
            }
            res.status(200).json({
                message: "客服問題詳情獲取成功",
                data: ticket
            });
        } catch (error) {
            console.error("Error fetching customer service detail:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    /* 管理員回覆客服問題 */
    async replyCustomerService(req: Request, res: Response) {
        try {
            const id = Number(req.params.id || req.body.id || req.body.ticket_id);
            const { reply, status } = req.body;

            if (!id || isNaN(id)) {
                return res.status(400).json({ message: "請提供有效的客服問題 ID" });
            }
            if (!reply || typeof reply !== "string" || !reply.trim()) {
                return res.status(400).json({ message: "請輸入回覆內容" });
            }

            const newStatus = status !== undefined ? Number(status) : 2; // 預設 2 (已回覆/結案)
            const updated = await replyCustomerServiceTicket(id, reply, newStatus);

            res.status(200).json({
                message: "回覆成功，已同步發送通知給使用者！",
                data: updated
            });
        } catch (error: any) {
            console.error("Error replying to customer service:", error);
            if (error.code === 'P2025') {
                return res.status(404).json({ message: "找不到該客服問題" });
            }
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    /* 管理員更新客服問題狀態 */
    async updateCustomerServiceStatus(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            const { status } = req.body;

            if (isNaN(id) || status === undefined || isNaN(Number(status))) {
                return res.status(400).json({ message: "請提供有效的 ID 與 status 數值" });
            }

            const updated = await updateCustomerServiceStatus(id, Number(status));
            res.status(200).json({
                message: "客服狀態更新成功",
                data: updated
            });
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ message: "找不到該客服紀錄" });
            }
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }

    /* 管理員刪除客服紀錄 */
    async deleteCustomerService(req: Request, res: Response) {
        try {
            const id = Number(req.params.id);
            if (isNaN(id)) {
                return res.status(400).json({ message: "無效的客服問題 ID" });
            }
            await deleteCustomerServiceTicket(id);
            res.status(200).json({ message: "客服紀錄已刪除" });
        } catch (error: any) {
            if (error.code === 'P2025') {
                return res.status(404).json({ message: "找不到該客服紀錄" });
            }
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    }
}