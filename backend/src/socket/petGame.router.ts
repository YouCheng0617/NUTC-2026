import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../modules/middleware/auth.middleware.js";
import { PetGameController } from "./petGame.controller.js";
import { listGameBlocksController, unblockGameController } from "./gameSafety.controller.js";
import { redeemCodeController } from "./redeemCode.controller.js";
import { getMemoryRewardsController, setCardBackController, setRoyalOutfitController, setJokerStyleController, markThroneSeenController } from "./memoryRewards.controller.js";
import { redeemLimiter } from "../lib/rateLimiter.js";


const petGameController = new PetGameController();

export function petGameRouter() {
    const router = Router();

    router.post("/rename", authCheck, petGameController.renamePetController);
    router.post("/interact", authCheck, petGameController.interactPetController);
    router.post("/buy", authCheck, petGameController.buyShopItemController);
    router.get("/my-pet", authCheck, petGameController.getMyPetWithInventoryController);
    router.get("/coin", authCheck, petGameController.getPetCoinController);
    router.get("/coins", authCheck, petGameController.getPetCoinController);

    // 每日簽到相關路由
    router.post("/sign-in", authCheck, petGameController.signInPetController);
    router.get("/sign-in-status", authCheck, petGameController.getSignInStatusController);

    // 每日任務相關路由
    router.get("/daily-task", authCheck, petGameController.getDailyTaskStatusController);
    router.post("/daily-task/claim", authCheck, petGameController.claimDailyTaskController);

    // 連線房間的封鎖名單（封鎖、檢舉本身走 socket：game_block_player / game_report_player）
    router.get("/blocks", authCheck, listGameBlocksController);
    router.delete("/blocks/:blockId", authCheck, unblockGameController);

    // 兌換碼（後台建立，玩家輸入後拿積分或道具）
    router.post("/redeem", authCheck, redeemLimiter, redeemCodeController);

    // 翻牌對決勝場獎勵：3 勝卡背、10 勝小丑皮膚、30 勝披風皇冠、100 勝王座動畫
    router.get("/memory-rewards", authCheck, getMemoryRewardsController);
    router.put("/memory-rewards/card-back", authCheck, setCardBackController);
    router.put("/memory-rewards/royal-outfit", authCheck, setRoyalOutfitController);
    router.put("/memory-rewards/joker-style", authCheck, setJokerStyleController);
    router.post("/memory-rewards/throne-seen", authCheck, markThroneSeenController);

    return router;
}

