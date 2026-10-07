import { Router } from "express";
import { authCheck, optionalAuthCheck } from "../middleware/auth.middleware.js";
import { getTodayController, voteController } from "./dailyQuestion.controller.js";

/* 今日一題（後台排程的路由在 admin.router.ts） */
export function dailyQuestionRouter() {
    const router = Router();
    router.get("/", optionalAuthCheck, getTodayController);
    router.post("/vote", authCheck, voteController);
    return router;
}
