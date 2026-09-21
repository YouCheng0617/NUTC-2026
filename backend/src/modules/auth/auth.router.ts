import { Router } from "express";
import { authCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { authController } from "./auth.controller.js"
import { registerLimiter, emailLimiter } from "../../lib/rateLimiter.js";

export function authRouter() {
    const router = Router();
    // Define your authentication routes here
    router.post('/login', authController.login);
    router.post('/register', registerLimiter, authController.register);
    router.post("/logout", authCheck, authController.logout);
    router.post("/verify-email", authController.verifyEmail);
    router.get("/verify-email", authController.verifyEmail);
    router.post("/resend-verification", emailLimiter, authController.resendVerification);
    router.post("/forgot-password", emailLimiter, authController.forgotPassword);
    router.post("/reset-password", authController.resetPassword);
    router.patch("/update-data", authCheck, authController.updateMemberData);
    router.post("/follow", authCheck, authController.followMembers);
    router.get("/followers", authCheck, authController.getFollowerListData);
    router.get("/following", authCheck, authController.getFollowingList);
    /*測試用*/
    router.get('/profile', authCheck, (req, res) => {
        const authReq = req as AuthRequest;
        res.status(200).json({
            message: "🎉 歡迎來到機密頁面！警衛已確認您的身分。",
            data: { user: authReq.user }
        });
    }); /*測試用*/
    return router;
}