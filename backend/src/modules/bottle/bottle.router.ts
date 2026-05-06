import { Router } from "express";
import { bottleController } from "./bottle.conterller.js";
import { authCheck } from "../middleware/auth.middleware.js";

export function bottleRouter() {
    const bottleRouter = Router();

    bottleRouter.post("/", authCheck, bottleController.throwBottle);
    bottleRouter.get("/random", authCheck, bottleController.getBottles);
    bottleRouter.patch("/review", bottleController.reviewBottle);
    return bottleRouter;
}
