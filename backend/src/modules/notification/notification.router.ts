import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { NotificationController } from "./notification.controller.js";


const notificationController = new NotificationController();

export function notificationRouter() {
    const router = Router();
    router.get('/', authCheck, (req, res) => notificationController.getMyNotifications(req, res));
    router.patch('/read-all', authCheck, (req, res) => notificationController.readAllNotifications(req, res));
    router.patch('/:id/read', authCheck, (req, res) => notificationController.readNotification(req, res));
    return router;
}

