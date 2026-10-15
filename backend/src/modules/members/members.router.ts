import { Router } from "express";
import { authCheck } from "../middleware/auth.middleware.js";
import { membersController } from "./members.controller.js";

/*別人的個人頁：一律要登入；有封鎖關係回 403 BLOCKED（跟 /profile 回 404 不同，這是前端規格要求的）*/
export function membersRouter() {
    const router = Router();
    router.get("/:memberId/profile", authCheck, membersController.getProfile);
    router.get("/:memberId/bottles", authCheck, membersController.getBottles);
    router.get("/:memberId/followers", authCheck, membersController.getFollowers);
    router.get("/:memberId/following", authCheck, membersController.getFollowing);
    return router;
}
