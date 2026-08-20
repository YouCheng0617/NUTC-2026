import { Router } from "express";
import { authCheck, optionalAuthCheck } from "../../middleware/auth.middleware.js";
import { CollectController } from "./collect.controller.js";

const collectController = new CollectController();

export function collectRouter() {
    const router = Router();

    // 1. 隨機抽取拼圖碎片 (普通 95% / 稀有 5%) - 需登入
    router.post("/unlock", authCheck, collectController.unlockRandomPicture.bind(collectController));

    // 2. 碎片兌換寶箱 (4種規則) - 需登入
    router.post("/exchange", authCheck, collectController.exchangeChest.bind(collectController));

    // 3. 開啟寶箱 (開普通/高級寶箱) - 需登入
    router.post("/open-chest", authCheck, collectController.openChest.bind(collectController));

    // 4. 查詢個人碎片與寶箱庫存 - 需登入
    router.get("/inventory", authCheck, collectController.getInventory.bind(collectController));

    // 5. 全圖圖鑑列表 (若帶 Token 會標註個人 1~9 碎片進度)
    router.get("/gallery", optionalAuthCheck, collectController.getAllGallery.bind(collectController));

    // 6. 使用者已收集的拼圖清單 - 需登入
    router.get("/my", authCheck, collectController.getUserUnlockedPictures.bind(collectController));

    return router;
}
