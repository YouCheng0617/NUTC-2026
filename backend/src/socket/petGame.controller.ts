import type { Request, Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import {
    renamePet,
    interactPet,
    buyShopItem,
    getMyPetWithInventory,
    getPetCoin,
    signInPetService,
    getSignInStatusService,
    getDailyTaskStatusService,
    claimDailyTaskService,
    type PetActionType,
    type DailyTaskKey
} from "./petGame.service.js";

export class PetGameController {

    async renamePetController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const { newName } = req.body;
            if (!memberId || !newName) {
                return res.status(400).json({ error: "缺少必要參數" })
            }

            const updatedPet = await renamePet(Number(memberId), String(newName));
            return res.status(200).json({ message: "寵物命名成功", pet: updatedPet });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
    async interactPetController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const rawAction = req.body.action || req.body.actionType;

            // 1. 先確認有值存在
            if (!memberId || !rawAction) {
                return res.status(400).json({ error: "缺少必要參數" });
            }

            // 2. 轉大寫
            // 前端淨化水質送的是 'clean'，後端統一叫 PURIFY
            const upperAction = String(rawAction).toUpperCase();
            const actionType = upperAction === 'CLEAN' ? 'PURIFY' : upperAction;

            // 3. 檢查動作是否合法（可選但推薦，避免非預期的動作傳入）
            const validActions = ['FEED', 'PURIFY', 'PET', 'MONEY_EXCHANGE', 'MUSIC_NOTE', 'MUSIC_BUY_NOTE'];
            if (!validActions.includes(actionType)) {
                return res.status(400).json({ error: "無效的互動類型！" });
            }

            const updatedPet = await interactPet(
                Number(memberId),
                actionType as PetActionType
            );

            return res.status(200).json({
                message: "互動成功！",
                coin: updatedPet.coin,
                pet: updatedPet
            });
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
    async buyShopItemController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const { category, itemName } = req.body;

            if (!memberId) return res.status(400).json({ error: "缺少會員身份" });
            if (!category || !itemName) return res.status(400).json({ error: "缺少必要參數 (category 或 itemName)" });

            const updatedPet = await buyShopItem(Number(memberId), category, String(itemName));
            return res.status(200).json({
                message: "操作成功！",
                pet: updatedPet
            });

        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
    async getMyPetWithInventoryController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(400).json({ error: "缺少會員身份" });

            const petWithInventory = await getMyPetWithInventory(Number(memberId));
            return res.status(200).json(petWithInventory);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async getPetCoinController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });

            const result = await getPetCoin(Number(memberId));
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async signInPetController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });

            const result = await signInPetService(Number(memberId));
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async getSignInStatusController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });

            const status = await getSignInStatusService(Number(memberId));
            return res.status(200).json(status);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async getDailyTaskStatusController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });

            const status = await getDailyTaskStatusService(Number(memberId));
            return res.status(200).json(status);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }

    async claimDailyTaskController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) return res.status(401).json({ error: "尚未登入" });

            // 前端任務 key 是 pet / feed / clean，也接受互動的名稱 (PET / FEED / PURIFY)
            const raw = String(req.body.task ?? "").toLowerCase();
            const task = raw === 'purify' ? 'clean' : raw;
            if (!['pet', 'feed', 'clean'].includes(task)) {
                return res.status(400).json({ error: "無效的任務類型！(pet / feed / clean)" });
            }

            const result = await claimDailyTaskService(Number(memberId), task as DailyTaskKey);
            return res.status(200).json(result);
        } catch (error: any) {
            return res.status(400).json({ error: error.message });
        }
    }
}