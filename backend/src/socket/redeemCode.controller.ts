import type { Response } from "express";
import type { AuthRequest } from "../modules/middleware/auth.middleware.js";
import {
    createRedeemCode, updateRedeemCode, listRedeemCodes, setRedeemCodeActive, deleteRedeemCode, listRedeemCodeUses, redeemCode,
} from "./redeemCode.js";

const parseId = (raw: unknown) => {
    const id = Number(raw);
    return Number.isInteger(id) && id > 0 ? id : null;
};

/* 玩家：POST /pet-games/redeem { code } */
export const redeemCodeController = async (req: AuthRequest, res: Response) => {
    try {
        const memberId = req.user?.member_id;
        if (!memberId) return res.status(401).json({ error: "尚未登入" });
        const result = await redeemCode(memberId, req.body?.code);
        return res.status(200).json({ message: `🎁 兌換成功！「${result.title}」的獎勵已經送到你的帳號`, data: result });
    } catch (error) {
        return res.status(400).json({ error: error instanceof Error ? error.message : "兌換失敗，請稍後再試" });
    }
};

/* 後台：GET /admin/redeem-codes */
export const listRedeemCodesController = async (_req: AuthRequest, res: Response) => {
    try {
        return res.status(200).json({ message: "成功獲取兌換碼列表", data: await listRedeemCodes() });
    } catch (error) {
        console.error("listRedeemCodes 錯誤:", error);
        return res.status(500).json({ message: "內部伺服器錯誤" });
    }
};

/* 後台：POST /admin/redeem-codes { code?, title, coin, items, maxUses?, expiresAt? } */
export const createRedeemCodeController = async (req: AuthRequest, res: Response) => {
    try {
        const createdBy = req.user?.member_id;
        if (!createdBy) return res.status(401).json({ message: "尚未登入" });
        const { code, title, coin, items, maxUses, expiresAt } = req.body ?? {};
        const created = await createRedeemCode({ code, title, coin, items, maxUses, expiresAt, createdBy });
        return res.status(201).json({ message: `兌換碼 ${created.code} 建立成功`, data: created });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "建立失敗" });
    }
};

/* 後台：PUT /admin/redeem-codes/:id { code?, title, coin, items, maxUses?, expiresAt? } 修改設定 */
export const updateRedeemCodeController = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ message: "兌換碼編號錯誤" });
        const { code, title, coin, items, maxUses, expiresAt } = req.body ?? {};
        const updated = await updateRedeemCode(id, { code, title, coin, items, maxUses, expiresAt });
        return res.status(200).json({ message: `兌換碼 ${updated?.code} 已更新`, data: updated });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "更新失敗" });
    }
};

/* 後台：PUT /admin/redeem-codes/:id/active { isActive } */
export const setRedeemCodeActiveController = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ message: "兌換碼編號錯誤" });
        if (typeof req.body?.isActive !== "boolean") return res.status(400).json({ message: "isActive 要是 true 或 false" });
        const updated = await setRedeemCodeActive(id, req.body.isActive);
        return res.status(200).json({ message: updated.is_active ? "已重新啟用" : "已停用", data: updated });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "更新失敗" });
    }
};

/* 後台：DELETE /admin/redeem-codes/:id（只能刪沒人用過的） */
export const deleteRedeemCodeController = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ message: "兌換碼編號錯誤" });
        await deleteRedeemCode(id);
        return res.status(200).json({ message: "已刪除" });
    } catch (error) {
        return res.status(400).json({ message: error instanceof Error ? error.message : "刪除失敗" });
    }
};

/* 後台：GET /admin/redeem-codes/:id/uses */
export const listRedeemCodeUsesController = async (req: AuthRequest, res: Response) => {
    try {
        const id = parseId(req.params.id);
        if (!id) return res.status(400).json({ message: "兌換碼編號錯誤" });
        return res.status(200).json({ message: "成功獲取兌換紀錄", data: await listRedeemCodeUses(id) });
    } catch (error) {
        console.error("listRedeemCodeUses 錯誤:", error);
        return res.status(500).json({ message: "內部伺服器錯誤" });
    }
};
