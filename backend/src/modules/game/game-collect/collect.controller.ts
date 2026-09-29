import type { Response } from "express";
import type { AuthRequest } from "../../middleware/auth.middleware.js";
import {
    exchangeChestService,
    openChestService,
    getUserInventoryService,
    getAllGalleryService,
    getUserUnlockedPicturesService,
    puzzleSignInService,
    getPuzzleSignInStatusService
} from "./collect.service.js";
import {
    PuzzleError,
    getPuzzleTasksService,
    claimPuzzleTaskService,
    drawWithAwakenStoneService,
    getDrawRecordsService,
    withMemberDrawLock
} from "./puzzleTask.service.js";

export class CollectController {
    /**
     * POST /game/collect/unlock
     * 消耗 1 顆喚醒石，隨機抽取一張圖片的拼圖碎片 (1~9號碎片，95% 普通 / 5% 高級)
     * 喚醒石由後端記錄，不夠就回 400；來源固定記為 AWAKEN_STONE，不再相信前端傳的 obtained_from
     */
    async unlockRandomPicture(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const result = await drawWithAwakenStoneService(memberId);

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
            if (error instanceof PuzzleError) {
                return res.status(400).json({ message: error.message });
            }
            console.error("Unlock puzzle piece error:", error);
            return res.status(500).json({
                message: "抽取拼圖碎片失敗，請稍後再試"
            });
        }
    }

    /**
     * GET /game/collect/tasks
     * 查詢今日拼圖任務進度 (每日簽到、今日發文 3 / 6 / 10 篇) 與喚醒石數量
     */
    async getPuzzleTasks(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const result = await getPuzzleTasksService(memberId);
            return res.status(200).json({
                message: "取得今日任務成功",
                data: result
            });
        } catch (error: any) {
            if (error instanceof PuzzleError) {
                return res.status(400).json({ message: error.message });
            }
            console.error("Get puzzle tasks error:", error);
            return res.status(500).json({ message: "取得今日任務失敗" });
        }
    }

    /**
     * POST /game/collect/tasks/:taskKey/claim
     * 領取任務獎勵 (+1 顆喚醒石)，每個任務每天限領一次
     */
    async claimPuzzleTask(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const result = await claimPuzzleTaskService(memberId, String(req.params.taskKey));
            return res.status(200).json({
                message: `💎 領取成功！獲得 ${result.reward} 顆喚醒石`,
                data: result
            });
        } catch (error: any) {
            if (error instanceof PuzzleError) {
                return res.status(400).json({ message: error.message });
            }
            console.error("Claim puzzle task error:", error);
            return res.status(500).json({ message: "領取任務獎勵失敗" });
        }
    }

    /**
     * GET /game/collect/draw-records?page=1&limit=20
     * 查詢抽卡紀錄 (喚醒石抽卡與開寶箱)，新到舊排序
     */
    async getDrawRecords(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const page = Number(req.query.page) || 1;
            const limit = Number(req.query.limit) || 20;
            const result = await getDrawRecordsService(memberId, page, limit);
            return res.status(200).json({
                message: "取得抽卡紀錄成功",
                data: result
            });
        } catch (error: any) {
            console.error("Get draw records error:", error);
            return res.status(500).json({ message: "取得抽卡紀錄失敗" });
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

            /*開寶箱也會抽碎片，跟喚醒石抽卡排同一個隊，避免同時寫入拼圖進度*/
            const result = await withMemberDrawLock(memberId, () =>
                openChestService(memberId, chest_type, count ? Number(count) : 1)
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

    /**
     * POST /game/collect/sign-in
     * 拼圖每日簽到 (1~29 天送 1 個普通寶箱，第 30 天送 1 個高級寶箱)
     */
    async puzzleSignIn(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const result = await puzzleSignInService(memberId);
            return res.status(200).json(result);
        } catch (error: any) {
            console.error("Puzzle sign-in error:", error);
            return res.status(400).json({
                message: error.message || "拼圖簽到失敗"
            });
        }
    }

    /**
     * GET /game/collect/sign-in-status
     * 查詢拼圖簽到狀態與 30 天獎勵清單進度預覽
     */
    async getPuzzleSignInStatus(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "尚未登入" });
            }

            const status = await getPuzzleSignInStatusService(memberId);
            return res.status(200).json(status);
        } catch (error: any) {
            console.error("Get puzzle sign-in status error:", error);
            return res.status(500).json({
                message: "取得拼圖簽到狀態失敗"
            });
        }
    }
}