import { Router } from "express";
import { authController } from "./auth.controller.js"
export function authRouter() {
    const router = Router();

    // Define your authentication routes here
    router.post('/login', authController.login);

    return router;
}