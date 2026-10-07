import { Router } from "express";
import { authCheck, adminCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { AdminController } from "./admin.controller.js";
import { getGameReportsController, updateGameReportStatusController } from "../../socket/gameSafety.controller.js";
import {
    listRedeemCodesController, createRedeemCodeController, updateRedeemCodeController, setRedeemCodeActiveController,
    deleteRedeemCodeController, listRedeemCodeUsesController,
} from "../../socket/redeemCode.controller.js";
import { listScheduleController, scheduleController, unscheduleController } from "../daily-question/dailyQuestion.controller.js";

const adminController = new AdminController();

export function adminRouter() {
    const router = Router();
    router.get("/members", authCheck, adminCheck, (req, res) => adminController.getMembersList(req, res));
    router.put("/members/:memberId/status", authCheck, adminCheck, (req, res) => adminController.updateMemberStatus(req, res));
    router.put("/members/:memberId/role", authCheck, adminCheck, (req: AuthRequest, res) => adminController.updateMemberRole(req, res));
    router.get("/bottles", authCheck, adminCheck, (req, res) => adminController.getBottlesList(req, res));
    router.put("/bottles/review", authCheck, adminCheck, (req, res) => adminController.reviewBottle(req, res));
    router.delete("/bottles/:bottleId/delete", authCheck, adminCheck, (req, res) => adminController.deleteBottle(req, res));
    router.delete("/members/:memberId/delete", authCheck, adminCheck, (req, res) => adminController.deleteMember(req, res));
    router.get("/bottles/reported", authCheck, adminCheck, (req: AuthRequest, res) => adminController.getReportedBottlesController(req, res));
    router.get("/comments", authCheck, adminCheck, (req, res) => adminController.getAllCommentsController(req, res));

    // 🐌 寵物遊戲連線房間的玩家檢舉
    router.get("/game-reports", authCheck, adminCheck, getGameReportsController);
    router.put("/game-reports/:id/status", authCheck, adminCheck, updateGameReportStatusController);

    // 🎁 寵物遊戲兌換碼
    router.get("/redeem-codes", authCheck, adminCheck, listRedeemCodesController);
    router.post("/redeem-codes", authCheck, adminCheck, createRedeemCodeController);
    router.put("/redeem-codes/:id", authCheck, adminCheck, updateRedeemCodeController);
    router.put("/redeem-codes/:id/active", authCheck, adminCheck, setRedeemCodeActiveController);
    router.delete("/redeem-codes/:id", authCheck, adminCheck, deleteRedeemCodeController);
    router.get("/redeem-codes/:id/uses", authCheck, adminCheck, listRedeemCodeUsesController);

    // 📅 首頁今日一題的排程
    router.get("/daily-questions", authCheck, adminCheck, listScheduleController);
    router.put("/daily-questions/:date", authCheck, adminCheck, scheduleController);
    router.delete("/daily-questions/:date", authCheck, adminCheck, unscheduleController);

    // 🌟 客服後台管理
    router.get("/customer-services", authCheck, adminCheck, (req, res) => adminController.getAllCustomerServices(req, res));
    router.get("/customer-services/:id", authCheck, adminCheck, (req, res) => adminController.getCustomerServiceDetail(req, res));
    router.put("/customer-services/:id/reply", authCheck, adminCheck, (req, res) => adminController.replyCustomerService(req, res));
    router.put("/customer-services/reply", authCheck, adminCheck, (req, res) => adminController.replyCustomerService(req, res));
    router.put("/customer-services/:id/status", authCheck, adminCheck, (req, res) => adminController.updateCustomerServiceStatus(req, res));
    router.delete("/customer-services/:id", authCheck, adminCheck, (req, res) => adminController.deleteCustomerService(req, res));

    return router;
}