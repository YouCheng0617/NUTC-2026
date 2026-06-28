import { Router } from "express";
import { bottleController } from "./bottle.conterller.js";
import { authCheck, adminCheck, optionalAuthCheck } from "../middleware/auth.middleware.js";

export function bottleRouter() {
    const bottleRouter = Router();

    bottleRouter.post("/", authCheck, bottleController.throwBottle);
    bottleRouter.get("/random", optionalAuthCheck, bottleController.getBottles);
    bottleRouter.patch("/review", authCheck, adminCheck, bottleController.reviewBottle);
    bottleRouter.get("/mybottles", authCheck, bottleController.getMyBottles);
    bottleRouter.get("/liked", authCheck, bottleController.getMyLikedBottlesList);
    bottleRouter.get("/saved", authCheck, bottleController.getMySavedBottlesList);
    bottleRouter.post("/:bottleId/like", authCheck, bottleController.likeBottle);
    bottleRouter.post("/:bottleId/save", authCheck, bottleController.saveBottle);
    bottleRouter.delete("/:bottleId/delete", authCheck, bottleController.deleteMyBottle);
    bottleRouter.get("/today", optionalAuthCheck, bottleController.getTodayBottleConterller);
    return bottleRouter;
}
