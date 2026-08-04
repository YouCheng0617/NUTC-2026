import type { Request, Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import { renamePet, interactPet, buyShopItem, getMyPetWithInventory } from "./petGame.service.js";

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
            const { actionType } = req.body;
            if (!memberId || !actionType) {
                return res.status(400).json({ error: "缺少必要參數" })
            }

            const updatedPet = await interactPet(Number(memberId), actionType);
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
}