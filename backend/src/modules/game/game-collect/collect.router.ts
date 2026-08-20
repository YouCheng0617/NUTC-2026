import { Router } from "express";
import { authCheck, optionalAuthCheck } from "../../middleware/auth.middleware.js";
import { CollectController } from "./collect.controller.js";

const collectController = new CollectController();

export function collectRouter() {
    const router = Router();

    // 1. 隨機解鎖圖片 (普通 80% / 稀有 20%) - 需登入
    router.post("/unlock", authCheck, collectController.unlockRandomPicture.bind(collectController));

    // 2. 全圖圖鑑列表 (若帶 Token 會標註個人是否解鎖)
    router.get("/gallery", optionalAuthCheck, collectController.getAllGallery.bind(collectController));

    // 3. 使用者已解鎖的圖片清單 - 需登入
    router.get("/my", authCheck, collectController.getUserUnlockedPictures.bind(collectController));

    return router;
}
