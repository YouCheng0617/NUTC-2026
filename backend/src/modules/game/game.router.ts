import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { gameController } from "./game.controller.js";
const gameControllerInstance = new gameController();

export function gameRouter() {
    const router = Router();
    return router;
}