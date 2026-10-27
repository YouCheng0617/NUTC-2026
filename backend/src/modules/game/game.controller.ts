import { isValidId, parseLimit } from "../../lib/validateHelper.js";
import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { saveGameRecord, getHighScore, getAllGameRecords } from "./game-record/game-record.service.js";
import {
    createDailyNote, getDailyNote, reportDailyNote, getDailyNotesForAdmin, reviewDailyNote,
    NOTE_APPROVED, NOTE_REJECTED,
} from "./sticky-note/sticky-note.service.js";
import { drawTarot, getTarotDailyStatus, requestTarotReading } from "./tarot/tarot.service.js";
export class GameController {
    /*儲存遊戲紀錄*/
    async postGameRecord(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const game_name = req.params.gameName;
            const { difficulty, score } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!game_name) {
                return res.status(400).json({ message: "請提供遊戲名稱" });
            }
            if (!difficulty || typeof score !== "number") {
                return res.status(400).json({ message: "請提供有效的難度和分數" });
            }
            const record = await saveGameRecord(memberId, game_name as string, difficulty, score);
            return res.status(200).json({
                message: "遊戲紀錄已儲存",
                data: record
            });

        } catch (error) {
            console.error("Error saving game record:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /*取得會員的最高遊戲紀錄*/
    async getHighestRecordController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const game_name = req.params.gameName;
            const difficulty = req.params.difficulty as string;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!game_name) {
                return res.status(400).json({ message: "請提供遊戲名稱" });
            }
            if (!difficulty) {
                return res.status(400).json({ message: "請提供難度" });
            }
            const record = await getHighScore(memberId, game_name as string, difficulty);

            return res.status(200).json({
                message: "取得遊戲紀錄成功",
                data: record
            });
        } catch (error) {
            console.error("Error fetching highest record:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /*取得會員的最高遊戲紀錄排行榜*/
    async getAllGameRecordsController(req: AuthRequest, res: Response) {
        try {
            const game_name = req.params.gameName;
            const difficulty = req.params.difficulty as string;
            const limit = parseLimit(req.query.limit, 10, 100);

            if (!game_name || !difficulty) {
                return res.status(400).json({ message: "請提供遊戲名稱和難度" });

            }

            const records = await getAllGameRecords(game_name as string, difficulty, limit);

            return res.status(200).json({
                message: "取得遊戲排行榜成功",
                data: records
            });

        } catch (error) {
            console.error("getRankingRecordController 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤，無法獲取排行榜" });
        }
    }

    async postDailyNote(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const { content } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "請提供內容" });
            }
            if (content.trim().length > 50) {
                return res.status(400).json({ message: "內容過長" });
            }

            const note = await createDailyNote(memberId, content.trim());

            return res.status(201).json({
                message: "便利貼已送出，審核通過後大家就看得到",
                data: {
                    id: note.id,
                    content: note.content,
                    created_at: note.created_at,
                    status: note.status,
                    is_mine: true
                }
            });

        } catch (error: any) {
            if (error.message === "今天已經有寫便利貼了") {
                return res.status(400).json({ message: "你今天已經發過便利貼囉！明天再來吧！" });
            }
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    async getDailyNote(req: AuthRequest, res: Response) {
        try {
            const notes = await getDailyNote(req.user?.member_id);

            return res.status(200).json({
                message: "取得便利貼成功",
                data: notes
            });

        } catch (error: any) {
            console.error("getTodayNotesController 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /* 🚩 檢舉便利貼 */
    async reportDailyNote(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const noteId = Number(req.params.noteId);
            const { reason } = req.body;
            if (!isValidId(noteId)) {
                return res.status(400).json({ message: "無效的便利貼 ID" });
            }
            if (typeof reason !== "string" || reason.trim().length > 200) {
                return res.status(400).json({ message: "檢舉理由最多 200 字" });
            }

            await reportDailyNote(noteId, memberId, reason);
            return res.status(201).json({ message: "檢舉已送出，管理員會盡快處理" });
        } catch (error: any) {
            if (error.message === "REPORT_REASON_EMPTY") {
                return res.status(400).json({ message: "檢舉理由不能為空字串" });
            }
            if (error.message === "NOTE_NOT_FOUND") {
                return res.status(404).json({ message: "這張便利貼已經不在了" });
            }
            if (error.message === "CANNOT_REPORT_OWN") {
                return res.status(400).json({ message: "不能檢舉自己的便利貼" });
            }
            if (error.message === "ALREADY_REPORTED") {
                return res.status(409).json({ message: "你已經檢舉過這張便利貼囉！感謝你的回報。" });
            }
            console.error("reportDailyNote 錯誤:", error);
            return res.status(500).json({ message: "伺服器發生錯誤，請稍後再試" });
        }
    }

    /* 📝 後台：今天所有便利貼與檢舉 */
    async getDailyNotesForAdmin(req: AuthRequest, res: Response) {
        try {
            const notes = await getDailyNotesForAdmin();
            return res.status(200).json({ data: notes });
        } catch (error: any) {
            console.error("getDailyNotesForAdmin 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /* 📝 後台：審核便利貼（1 通過、2 下架） */
    async reviewDailyNote(req: AuthRequest, res: Response) {
        try {
            const noteId = Number(req.params.noteId);
            const { status, violation_reason } = req.body;
            if (!isValidId(noteId)) {
                return res.status(400).json({ message: "無效的便利貼 ID" });
            }
            if (status !== NOTE_APPROVED && status !== NOTE_REJECTED) {
                return res.status(400).json({ message: "狀態只能是 1（通過）或 2（下架）" });
            }

            await reviewDailyNote(noteId, status, typeof violation_reason === "string" ? violation_reason : undefined);
            return res.status(200).json({ message: status === NOTE_APPROVED ? "便利貼已通過" : "便利貼已下架" });
        } catch (error: any) {
            if (error.message === "NOTE_NOT_FOUND") {
                return res.status(404).json({ message: "這張便利貼已經不在了" });
            }
            console.error("reviewDailyNote 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /* 塔羅牌：進行每日占卜 (每天限 3 次，00:00 台北時間重置) */
    async postDrawTarot(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            if (!memberId) {
                return res.status(401).json({ message: "請先登入會員" });
            }

            const { past, present, future } = req.body;
            const result = await drawTarot(memberId, { past, present, future });

            return res.status(200).json({
                message: result.message,
                data: result
            });
        } catch (error: any) {
            if (error.message && error.message.includes("上限")) {
                return res.status(400).json({ message: error.message });
            }
            console.error("postDrawTarot 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /* 塔羅牌：AI 解牌（要登入，經過後端才叫得到 AI） */
    async postTarotReading(req: AuthRequest, res: Response) {
        try {
            const { card_name, orientation, question } = req.body ?? {};
            /*只收字串並限制長度，避免被拿來塞超長內容給 AI*/
            const fields = [[card_name, 60], [orientation, 30], [question, 50]] as const;
            if (fields.some(([value, max]) => typeof value !== "string" || !value.trim() || value.length > max)) {
                return res.status(400).json({ message: "抽牌資料格式錯誤，請重新抽牌" });
            }

            const analysis = await requestTarotReading({ card_name, orientation, question });
            return res.status(200).json({ status: "success", analysis });
        } catch (error: any) {
            if (error.message === "AI_UNAVAILABLE") {
                return res.status(503).json({ message: "海之占卜師暫時休息中，請稍後再試" });
            }
            console.error("postTarotReading 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    /* 塔羅牌：查詢今日剩餘占卜次數與狀態 */
    async getTarotStatus(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            if (!memberId) {
                return res.status(401).json({ message: "請先登入會員" });
            }

            const status = await getTarotDailyStatus(memberId);
            return res.status(200).json({
                message: "取得塔羅占卜狀態成功",
                data: status
            });
        } catch (error: any) {
            console.error("getTarotStatus 錯誤:", error);
            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }
}