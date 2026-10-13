import type { Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import { getMemoryRewards, setCardBack, setJokerStyle, markThroneSeen } from "./memoryRewards.js";

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

/* GET /pet-games/memory-rewards：勝場、各里程碑解鎖狀態、目前的卡背、塗鴉貼圖是否解鎖 */
export const getMemoryRewardsController = handle((memberId) => getMemoryRewards(memberId));

/* PUT /pet-games/memory-rewards/card-back { cardBack }（null = 預設卡背；勝場拿到的選過就不能換） */
export const setCardBackController = handle((memberId, req) => setCardBack(memberId, req.body?.cardBack ?? null));

/* PUT /pet-games/memory-rewards/joker-style { jokerStyle: "a" | "b" | "c" | "d" }（黑桃／紅心／方塊／梅花） */
export const setJokerStyleController = handle((memberId, req) => setJokerStyle(memberId, req.body?.jokerStyle));

/* POST /pet-games/memory-rewards/throne-seen：王座動畫播完後呼叫 */
export const markThroneSeenController = handle((memberId) => markThroneSeen(memberId));
