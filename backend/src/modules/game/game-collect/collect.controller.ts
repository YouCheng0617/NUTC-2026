import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import { unlockRandomPictureService, getAllGalleryService, getUserUnlockedPicturesService } from "./collect.service.js";

export class CollectController {
    /**
     * POST /game/collect/unlock
     * 隨機解鎖一張圖片 (80% 普通 / 20% 高級)
     */
    async unlockRandomPicture(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const { obtained_from } = req.body || {};
            const result = await unlockRandomPictureService(memberId, obtained_from);

            return res.status(200).json({
                message: result.isNew ? "🎉 恭喜解鎖新圖鑑！" : "已擁有過此圖鑑",
                data: result
            });
        } catch (error: any) {
            console.error("Unlock picture error:", error);
            return res.status(500).json({
                message: error.message || "解鎖圖片失敗，請稍後再試"
            });
        }
    }

    /**
     * GET /game/collect/gallery
     * 取得全圖圖鑑清單 (包含個人解鎖狀態與統計)
     */
    async getAllGallery(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id; // 若有登入會附帶解鎖紀錄
            const category = req.query.category as string | undefined;

            const gallery = await getAllGalleryService(memberId, category);

            return res.status(200).json({
                message: "取得圖鑑清單成功",
                data: gallery
            });
        } catch (error: any) {
            console.error("Get gallery error:", error);
            return res.status(500).json({
                message: "取得圖鑑清單失敗"
            });
        }
    }

    /**
     * GET /game/collect/my
     * 取得當前使用者已解鎖的圖片清單
     */
    async getUserUnlockedPictures(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const rarity = req.query.rarity as "NORMAL" | "PREMIUM" | undefined;
            const category = req.query.category as string | undefined;

            const result = await getUserUnlockedPicturesService(memberId, rarity, category);

            return res.status(200).json({
                message: "取得已解鎖圖片成功",
                data: result
            });
        } catch (error: any) {
            console.error("Get user unlocked pictures error:", error);
            return res.status(500).json({
                message: "取得已解鎖圖片失敗"
            });
        }
    }
}