import { Router } from "express";
import { authCheck } from "../middleware/auth.middleware.js";
import { aiChatLimiter } from "../../lib/rateLimiter.js";
import { aiChatController } from "./aiChat.controller.js";

/*AI 特助：要登入，每人每小時有次數上限*/
export function aiChatRouter() {
    const router = Router();
    router.post("/chat", authCheck, aiChatLimiter, aiChatController.postChat);
    return router;
}
