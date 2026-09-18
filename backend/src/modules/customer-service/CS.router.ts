import { Router } from "express";
import { authCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { CSController } from "./CS.controller.js";
import { csImageUpload } from "./CS.upload.js";

const csController = new CSController();

export function CSRouter() {
    const router = Router();

    // 1. 會員送出客服問題 (multipart/form-data, 圖片欄位: images, 最多 3 張)
    router.post("/", authCheck, csImageUpload, (req: AuthRequest, res) => csController.createTicket(req, res));

    // 2. 獲取自己的客服問題列表
    router.get("/my", authCheck, (req: AuthRequest, res) => csController.getMyTickets(req, res));

    // 3. 獲取單筆客服問題詳情
    router.get("/:id", authCheck, (req: AuthRequest, res) => csController.getTicketDetail(req, res));

    return router;
}

