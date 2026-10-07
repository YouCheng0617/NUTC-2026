import type { Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import { getMemoryRewards, setCardBack, setRoyalOutfit, markThroneSeen } from "./memoryRewards.js";

const handle = (fn: (memberId: number, req: AuthRequest) => Promise<unknown>) =>
    async (req: AuthRequest, res: Response) => {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });
            return res.status(200).json({ data: await fn(memberId, req) });
        } catch (error) {
            return res.status(400).json({ error: error instanceof Error ? error.message : "操作失敗" });
        }
    };

/* GET /pet-games/memory-rewards：勝場、各里程碑解鎖狀態、目前的卡背與披風皇冠 */
export const getMemoryRewardsController = handle((memberId) => getMemoryRewards(memberId));

/* PUT /pet-games/memory-rewards/card-back { cardBack }（null = 換回預設） */
export const setCardBackController = handle((memberId, req) => setCardBack(memberId, req.body?.cardBack ?? null));

/* PUT /pet-games/memory-rewards/royal-outfit { outfit: "king" | "queen" | null } */
export const setRoyalOutfitController = handle((memberId, req) => setRoyalOutfit(memberId, req.body?.outfit ?? null));

/* POST /pet-games/memory-rewards/throne-seen：王座動畫播完後呼叫 */
export const markThroneSeenController = handle((memberId) => markThroneSeen(memberId));
