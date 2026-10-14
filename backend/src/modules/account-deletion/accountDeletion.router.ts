import { Router } from "express";
import { authCheck } from "../middleware/auth.middleware.js";
import { accountDeletionController } from "./accountDeletion.controller.js";
import { deletionRequestLimiter, emailLimiter } from "../../lib/rateLimiter.js";

export function accountDeletionRouter() {
    const router = Router();
    router.post("/request", authCheck, deletionRequestLimiter, accountDeletionController.request);
    router.post("/confirm", accountDeletionController.confirm);
    router.post("/deny", emailLimiter, accountDeletionController.deny); // 會寄重設密碼信
    /*後悔期內不能登入，取消只能走信裡的連結；重寄取消連結在登入時處理 (auth.controller)*/
    router.post("/cancel-by-link", accountDeletionController.cancelByLink);
    return router;
}
