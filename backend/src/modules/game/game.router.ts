import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { GameController } from "./game.controller.js";
const gameControllerInstance = new GameController();

export function gameRouter() {
    const router = Router();
    router.get("/:gameName/:difficulty/ranking", optionalAuthCheck, gameControllerInstance.getAllGameRecordsController.bind(gameControllerInstance))
    router.post("/:gameName", authCheck, gameControllerInstance.postGameRecord.bind(gameControllerInstance))
    router.get("/:gameName/:difficulty", authCheck, gameControllerInstance.getHighestRecordController.bind(gameControllerInstance))
    return router;
}