import { Router } from "express";
import { optionalAuthCheck } from "../middleware/auth.middleware.js";
import { profileController } from "./profile.controller.js";

/*個人頁面：訪客也能看；有登入時會帶出「我有沒有追蹤他」並排除有封鎖關係的人*/
export function profileRouter() {
    const router = Router();
    router.get("/:memberId", optionalAuthCheck, profileController.getProfile);
    router.get("/:memberId/bottles", optionalAuthCheck, profileController.getBottles);
    router.get("/:memberId/followers", optionalAuthCheck, profileController.getFollowers);
    router.get("/:memberId/following", optionalAuthCheck, profileController.getFollowing);
    return router;
}
