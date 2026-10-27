import { Router } from "express";
import { authCheck, adminCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { GameController } from "./game.controller.js";
import { collectRouter } from "./game-collect/collect.router.js";
import { reportLimiter, tarotReadingLimiter } from "../../lib/rateLimiter.js";

const gameControllerInstance = new GameController();

export function gameRouter() {
    const router = Router();
    
    // 圖片收集/圖鑑遊戲路由 (/game/collect/...)
    router.use("/collect", collectRouter());

    router.post("/daily-note", authCheck, gameControllerInstance.postDailyNote.bind(gameControllerInstance))
    router.get("/daily-note", authCheck, gameControllerInstance.getDailyNote.bind(gameControllerInstance))
    router.post("/daily-note/:noteId/report", authCheck, reportLimiter, gameControllerInstance.reportDailyNote.bind(gameControllerInstance))

    // 🔮 塔羅牌每日占卜路由 (/game/tarot, /game/tarot/status)
    router.post("/tarot", authCheck, gameControllerInstance.postDrawTarot.bind(gameControllerInstance))
    router.get("/tarot/status", authCheck, gameControllerInstance.getTarotStatus.bind(gameControllerInstance))
    router.post("/tarot/reading", authCheck, tarotReadingLimiter, gameControllerInstance.postTarotReading.bind(gameControllerInstance)) // AI 解牌

    router.get("/:gameName/:difficulty/ranking", authCheck, gameControllerInstance.getAllGameRecordsController.bind(gameControllerInstance))
    router.post("/:gameName", authCheck, gameControllerInstance.postGameRecord.bind(gameControllerInstance))
    router.get("/:gameName/:difficulty", authCheck, gameControllerInstance.getHighestRecordController.bind(gameControllerInstance))
    return router;
}