import type { Response } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getTodayQuestion, voteToday, listSchedule, scheduleQuestion, unscheduleQuestion } from "./dailyQuestion.service.js";

/* GET /daily-question：今天的題目（有登入且投過票才附結果） */
export const getTodayController = async (req: AuthRequest, res: Response) => {
    try {
        return res.status(200).json({ data: await getTodayQuestion(req.user?.member_id) });
    } catch (error) {
        console.error("getTodayQuestion 錯誤:", error);
        return res.status(500).json({ message: "伺服器發生錯誤，請稍後再試" });
    }
};

/* POST /daily-question/vote { optionIndex } */
export const voteController = async (req: AuthRequest, res: Response) => {
    try {
        const memberId = req.user?.member_id;
        if (!memberId) return res.status(401).json({ message: "請先登入才能投票" });
        return res.status(200).json({ message: "投票成功！", data: await voteToday(memberId, req.body?.optionIndex) });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "投票失敗" });
    }
};

/* 後台：GET /admin/daily-questions */
export const listScheduleController = async (_req: AuthRequest, res: Response) => {
    try {
        return res.status(200).json({ data: await listSchedule() });
    } catch (error) {
        console.error("listSchedule 錯誤:", error);
        return res.status(500).json({ message: "內部伺服器錯誤" });
    }
};

/* 後台：PUT /admin/daily-questions/:date { question, options: [{ emoji, label }] } */
export const scheduleController = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.member_id;
        if (!adminId) return res.status(401).json({ message: "尚未登入" });
        const saved = await scheduleQuestion(String(req.params.date), req.body ?? {}, adminId);
        return res.status(200).json({ message: `${saved.date} 的題目已排好`, data: saved });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "排程失敗" });
    }
};

/* 後台：DELETE /admin/daily-questions/:date（取消排程，改回題庫） */
export const unscheduleController = async (req: AuthRequest, res: Response) => {
    try {
        await unscheduleQuestion(String(req.params.date));
        return res.status(200).json({ message: "已取消排程，這天會改用題庫的題目" });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "取消失敗" });
    }
};
