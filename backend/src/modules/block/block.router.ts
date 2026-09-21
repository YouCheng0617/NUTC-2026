import { Router } from "express";
import { authCheck } from "../middleware/auth.middleware.js";
import { blockController } from "./block.controller.js";

export function blockRouter() {
    const router = Router();
    router.get("/", authCheck, blockController.getBlockList);
    router.post("/:memberId", authCheck, blockController.block);
    router.delete("/:memberId", authCheck, blockController.unblock);
    return router;
}
