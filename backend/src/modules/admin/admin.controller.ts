import type { Response, Request } from "express";
import { getAllMembers, changeMemberStatus, getAllBottlesForAdmin, updateBottleStatus } from "./admin.service.js";

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
}