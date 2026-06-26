import { Router } from "express";
import { authCheck, adminCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { AdminController } from "./admin.controller.js";

const adminController = new AdminController();

export function adminRouter() {
    const router = Router();
    router.get("/members", authCheck, adminCheck, (req, res) => adminController.getMembersList(req, res));
    router.put("/members/:memberId/status", authCheck, adminCheck, (req, res) => adminController.updateMemberStatus(req, res));
    router.get("/bottles", adminCheck, (req, res) => adminController.getBottlesList(req, res));
    router.put("/bottles/review", authCheck, adminCheck, (req, res) => adminController.reviewBottle(req, res));
    router.delete("/bottles/:bottleId/delete", authCheck, adminCheck, (req, res) => adminController.deleteBottle(req, res));
    return router;
}