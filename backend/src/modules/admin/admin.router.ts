import { Router } from "express";
import { authCheck, adminCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { AdminController } from "./admin.controller.js";

const adminController = new AdminController();

export function adminRouter() {
    const router = Router();
    router.get("/members", authCheck, adminCheck, (req, res) => adminController.getMembersList(req, res));
    router.put("/members/:memberId/status", authCheck, adminCheck, (req, res) => adminController.updateMemberStatus(req, res));
    router.get("/bottles", authCheck, adminCheck, (req, res) => adminController.getBottlesList(req, res));
    router.put("/bottles/review", authCheck, adminCheck, (req, res) => adminController.reviewBottle(req, res));
    router.delete("/bottles/:bottleId/delete", authCheck, adminCheck, (req, res) => adminController.deleteBottle(req, res));
    router.delete("/members/:memberId/delete", authCheck, adminCheck, (req, res) => adminController.deleteMember(req, res));
    router.get("/bottles/reported", authCheck, adminCheck, (req: AuthRequest, res) => adminController.getReportedBottlesController(req, res));
    router.get("/comments", authCheck, adminCheck, (req, res) => adminController.getAllCommentsController(req, res));
    return router;
}