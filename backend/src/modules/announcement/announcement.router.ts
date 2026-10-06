import { Router } from "express";
import { authCheck, optionalAuthCheck } from "../middleware/auth.middleware.js";
import { announcementLimiter } from "../../lib/rateLimiter.js";
import { announcementController } from "./announcement.controller.js";

export function announcementRouter() {
    const router = Router();
    router.get("/", optionalAuthCheck, announcementController.list);
    router.post("/", authCheck, announcementLimiter, announcementController.create);
    return router;
}
