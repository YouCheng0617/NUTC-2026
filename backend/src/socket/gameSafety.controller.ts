import type { Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import { listBlocks, unblock, getGameReports, updateGameReportStatus, REPORT_REASONS } from "./gameSafety.js";

/* 我的連線房間封鎖名單 */
export const listGameBlocksController = async (req: AuthRequest, res: Response) => {
    try {
        const memberId = req.user?.member_id;
        if (!memberId) return res.status(401).json({ error: "尚未登入" });
        return res.status(200).json({ data: await listBlocks(memberId) });
    } catch (error) {
        console.error("listGameBlocks 錯誤:", error);
        return res.status(500).json({ error: "伺服器發生錯誤，請稍後再試" });
    }
};

/* 解除封鎖（用封鎖名單裡的 id） */
export const unblockGameController = async (req: AuthRequest, res: Response) => {
    try {
        const memberId = req.user?.member_id;
        if (!memberId) return res.status(401).json({ error: "尚未登入" });
        const blockId = Number(req.params.blockId);
        if (!Number.isInteger(blockId) || blockId <= 0) return res.status(400).json({ error: "封鎖紀錄編號錯誤" });
        await unblock(memberId, blockId);
        return res.status(200).json({ message: "已解除封鎖" });
    } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "解除封鎖失敗" });
    }
};

/* 後台：玩家檢舉列表，可用 ?status=0 只看待處理 */
export const getGameReportsController = async (req: AuthRequest, res: Response) => {
    try {
        const raw = req.query.status;
        const status = raw === undefined || raw === "" ? undefined : Number(raw);
        if (status !== undefined && ![0, 1, 2].includes(status)) {
            return res.status(400).json({ message: "status 只能是 0、1、2" });
        }
        const reports = await getGameReports(status);
        return res.status(200).json({
            message: "成功獲取遊戲檢舉列表",
            data: reports.map(r => ({ ...r, reasonText: REPORT_REASONS[r.reason] ?? r.reason })),
        });
    } catch (error) {
        console.error("getGameReports 錯誤:", error);
        return res.status(500).json({ message: "內部伺服器錯誤" });
    }
};

/* 後台：審核檢舉（1 成立、2 不成立）。要停權請用既有的 PUT /admin/members/:memberId/status */
export const updateGameReportStatusController = async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!Number.isInteger(id) || id <= 0) return res.status(400).json({ message: "檢舉編號錯誤" });
        const updated = await updateGameReportStatus(id, Number(req.body?.status));
        return res.status(200).json({ message: "檢舉狀態已更新", data: updated });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "更新失敗" });
    }
};
