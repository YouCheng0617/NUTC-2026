import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { saveGameRecord, getHighScore, getAllGameRecords } from "./game-record/game-record.service.js";

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
            const limit = req.query.limit ? Number(req.query.limit) : 10;

            if (!game_name || !difficulty) {
                return res.status(400).json({ message: "請提供遊戲名稱和難度" });

            }
            if (isNaN(limit)) {
                return res.status(400).json({ message: "limit 必須是數字" });
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

}