import type { Response } from "express";
import { isValidId } from "../../lib/validateHelper.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { listBroadcasts, createBroadcast, updateBroadcast, setBroadcastActive, deleteBroadcast } from "./broadcast.service.js";

/*service 丟出的錯誤都是給管理員看的訊息*/
const fail = (res: Response, error: unknown, label: string) => {
    if (error instanceof Error) {
        return res.status(400).json({ message: error.message });
    }
    console.error(`${label} 錯誤:`, error);
    return res.status(500).json({ message: "伺服器錯誤" });
};

/* 後台：發送過的通知列表（含已讀人數、收件人） */
export const listBroadcastsController = async (req: AuthRequest, res: Response) => {
    try {
        return res.status(200).json({ data: await listBroadcasts() });
    } catch (error) {
        console.error("listBroadcasts 錯誤:", error);
        return res.status(500).json({ message: "伺服器錯誤" });
    }
};

/* 後台：發送通知給所有人或指定的人（要真人管理員，AI 金鑰沒有 member_id） */
export const createBroadcastController = async (req: AuthRequest, res: Response) => {
    try {
        const adminId = req.user?.member_id;
        if (!adminId) return res.status(403).json({ message: "此操作需使用管理員帳號登入後執行" });
        const broadcast = await createBroadcast(adminId, req.body ?? {});
        return res.status(201).json({ message: "已發送通知", data: broadcast });
    } catch (error) {
        return fail(res, error, "createBroadcast");
    }
};

/* 後台：修改內容、到期時間或收件人 */
export const updateBroadcastController = async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!isValidId(id)) return res.status(400).json({ message: "無效的通知 ID" });
        const broadcast = await updateBroadcast(id, req.body ?? {});
        return res.status(200).json({ message: "已更新通知", data: broadcast });
    } catch (error) {
        return fail(res, error, "updateBroadcast");
    }
};

/* 後台：停用 / 重新啟用 */
export const setBroadcastActiveController = async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!isValidId(id)) return res.status(400).json({ message: "無效的通知 ID" });
        if (typeof req.body?.is_active !== "boolean") return res.status(400).json({ message: "is_active 必須是 true 或 false" });
        await setBroadcastActive(id, req.body.is_active);
        return res.status(200).json({ message: req.body.is_active ? "已重新啟用" : "已停用，收件人的通知列表不會再看到這則" });
    } catch (error) {
        return fail(res, error, "setBroadcastActive");
    }
};

/* 後台：刪除（連同已讀紀錄） */
export const deleteBroadcastController = async (req: AuthRequest, res: Response) => {
    try {
        const id = Number(req.params.id);
        if (!isValidId(id)) return res.status(400).json({ message: "無效的通知 ID" });
        await deleteBroadcast(id);
        return res.status(200).json({ message: "已刪除通知" });
    } catch (error) {
        return fail(res, error, "deleteBroadcast");
    }
};
