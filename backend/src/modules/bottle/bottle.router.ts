import { Router } from "express";
import { bottleController } from "./bottle.conterller.js";
import { authCheck, adminCheck, optionalAuthCheck } from "../middleware/auth.middleware.js";
import { postBottleLimiter, reportLimiter } from "../../lib/rateLimiter.js";

export function bottleRouter() {
    const bottleRouter = Router();

    bottleRouter.post("/", authCheck, postBottleLimiter, bottleController.throwBottle);
    bottleRouter.get("/random", optionalAuthCheck, bottleController.getBottles);
    bottleRouter.patch("/review", authCheck, adminCheck, bottleController.reviewBottle);
    bottleRouter.get("/mybottles", authCheck, bottleController.getMyBottles);
    bottleRouter.get("/liked", authCheck, bottleController.getMyLikedBottlesList);
    bottleRouter.get("/saved", authCheck, bottleController.getMySavedBottlesList);
    bottleRouter.get("/search", optionalAuthCheck, bottleController.searchBottlesController);
    bottleRouter.get("/popular", optionalAuthCheck, bottleController.getPopularBottlesController);
    bottleRouter.post("/:bottleId/vote", authCheck, bottleController.votePollController);
    bottleRouter.post("/:bottleId/like", authCheck, bottleController.likeBottle);
    bottleRouter.post("/:bottleId/save", authCheck, bottleController.saveBottle);
    bottleRouter.delete("/:bottleId/delete", authCheck, bottleController.deleteMyBottle);
    bottleRouter.get("/today", optionalAuthCheck, bottleController.getTodayBottleConterller);
    bottleRouter.post("/:bottleId/report", authCheck, reportLimiter, bottleController.reportBottleController);
    // ⚠️ 這條一定要放在最後：/:bottleId 會吃掉 /random、/liked、/today 這些路徑
    bottleRouter.get("/:bottleId", optionalAuthCheck, bottleController.getBottleByIdController);
    bottleRouter.patch("/:bottleId", authCheck, bottleController.updateMyBottleController);
    return bottleRouter;
}
