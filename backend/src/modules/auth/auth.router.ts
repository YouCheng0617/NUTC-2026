import { Router } from "express";
import { authCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { authController } from "./auth.controller.js"
export function authRouter() {
    const router = Router();

    // Define your authentication routes here
    router.post('/login', authController.login);
    router.post('/register', authController.register);
    router.post("/logout", authCheck, authController.logout);
    router.get('/profile', authCheck, (req, res) => {
        const authReq = req as AuthRequest;
        res.status(200).json({
            message: "🎉 歡迎來到機密頁面！警衛已確認您的身分。",
            data: { user: authReq.user }
        });
    }); /*測試用*/
    return router;
}