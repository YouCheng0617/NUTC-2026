import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { GameController } from "./game.controller.js";
const gameControllerInstance = new GameController();

export function gameRouter() {
    const router = Router();
    router.get("/:gameName/:difficulty/ranking", optionalAuthCheck, gameControllerInstance.getAllGameRecordsController.bind(gameControllerInstance))
    router.post("/:gameName", authCheck, gameControllerInstance.postGameRecord.bind(gameControllerInstance))
    router.get("/:gameName/:difficulty", authCheck, gameControllerInstance.getHighestRecordController.bind(gameControllerInstance))
    router.post("/daily-note", authCheck, gameControllerInstance.postDailyNote.bind(gameControllerInstance))
    router.get("/daily-note", optionalAuthCheck, gameControllerInstance.getDailyNote.bind(gameControllerInstance))
    return router;
}