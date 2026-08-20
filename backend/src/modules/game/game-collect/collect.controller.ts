import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import {
    unlockRandomPicturePieceService,
    exchangeChestService,
    openChestService,
    getUserInventoryService,
    getAllGalleryService,
    getUserUnlockedPicturesService
} from "./collect.service.js";

export class CollectController {
    /**
     * POST /game/collect/unlock
     * 隨機抽取一張圖片的拼圖碎片 (1~9號碎片，95% 普通 / 5% 高級，每抽碎片可累積碎片庫存)
     */
    async unlockRandomPicture(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const { obtained_from } = req.body || {};
            const result = await unlockRandomPicturePieceService(memberId, obtained_from);

            let message = "";
            if (result.isCompletedNow) {
                message = `🎉 恭喜！你集齊了【${result.picture.title}】全部 9 片拼圖，解鎖了完整圖鑑！`;
            } else if (result.isNewPiece) {
                message = `✨ 恭喜獲得【${result.picture.title}】的第 ${result.drawnPiece} 號碎片！(${result.puzzleProgress.piece_count}/9)`;
            } else {
                message = `抽到了已擁有的【${result.picture.title}】第 ${result.drawnPiece} 號碎片，已轉化為碎片庫存！`;
            }

            return res.status(200).json({
                message,
                data: result
            });
        } catch (error: any) {
            console.error("Unlock puzzle piece error:", error);
            return res.status(500).json({
                message: error.message || "抽取拼圖碎片失敗，請稍後再試"
            });
        }
    }

    /**
     * POST /game/collect/exchange
     * 碎片兌換寶箱
     * Body: { exchange_type: 1 | 2 | 3 | 4, times?: number }
     *  - 1: 10 普通碎片 -> 1 普通寶箱
     *  - 2: 30 普通碎片 -> 1 高級寶箱
     *  - 3: 1 高級碎片 -> 10 普通寶箱
     *  - 4: 5 高級碎片 -> 1 高級寶箱
     */
    async exchangeChest(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const { exchange_type, times } = req.body || {};
            if (!exchange_type) {
                return res.status(400).json({ message: "請提供兌換類型 (exchange_type: 1, 2, 3, 4)" });
            }

            const result = await exchangeChestService(
                memberId,
                Number(exchange_type) as 1 | 2 | 3 | 4,
                times ? Number(times) : 1
            );

            return res.status(200).json({
                message: `🎉 兌換成功！${result.exchangeDesc}`,
                data: result
            });
        } catch (error: any) {
            console.error("Exchange chest error:", error);
            return res.status(400).json({
                message: error.message || "兌換寶箱失敗"
            });
        }
    }

    /**
     * POST /game/collect/open-chest
     * 開啟普通寶箱或高級寶箱
     * Body: { chest_type: "NORMAL" | "PREMIUM", count?: number }
     */
    async openChest(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const { chest_type, count } = req.body || {};
            if (!chest_type || (chest_type !== "NORMAL" && chest_type !== "PREMIUM")) {
                return res.status(400).json({ message: "請提供正確的寶箱類型 (chest_type: 'NORMAL' 或 'PREMIUM')" });
            }

            const result = await openChestService(
                memberId,
                chest_type,
                count ? Number(count) : 1
            );

            return res.status(200).json({
                message: `🎁 成功開啟 ${result.count} 個${chest_type === "PREMIUM" ? "高級" : "普通"}寶箱！`,
                data: result
            });
        } catch (error: any) {
            console.error("Open chest error:", error);
            return res.status(400).json({
                message: error.message || "開啟寶箱失敗"
            });
        }
    }

    /**
     * GET /game/collect/inventory
     * 取得當前使用者的碎片與寶箱庫存
     */
    async getInventory(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const inventory = await getUserInventoryService(memberId);

            return res.status(200).json({
                message: "取得庫存成功",
                data: inventory
            });
        } catch (error: any) {
            console.error("Get inventory error:", error);
            return res.status(500).json({
                message: "取得庫存失敗"
            });
        }
    }

    /**
     * GET /game/collect/gallery
     * 取得全圖拼圖圖鑑清單 (若有 Token 會回傳個人每張圖 1~9 碎片的解鎖清單)
     */
    async getAllGallery(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            const category = req.query.category as string | undefined;

            const gallery = await getAllGalleryService(memberId, category);

            return res.status(200).json({
                message: "取得拼圖圖鑑清單成功",
                data: gallery
            });
        } catch (error: any) {
            console.error("Get gallery error:", error);
            return res.status(500).json({
                message: "取得拼圖圖鑑清單失敗"
            });
        }
    }

    /**
     * GET /game/collect/my
     * 取得當前使用者已收集的拼圖清單 (包含碎片狀態與完成度)
     */
    async getUserUnlockedPictures(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const status = (req.query.status as "ALL" | "COMPLETED" | "IN_PROGRESS") || "ALL";
            const rarity = req.query.rarity as "NORMAL" | "PREMIUM" | undefined;
            const category = req.query.category as string | undefined;

            const result = await getUserUnlockedPicturesService(memberId, status, rarity, category);

            return res.status(200).json({
                message: "取得我的拼圖清單成功",
                data: result
            });
        } catch (error: any) {
            console.error("Get user unlocked pictures error:", error);
            return res.status(500).json({
                message: "取得我的拼圖清單失敗"
            });
        }
    }
}