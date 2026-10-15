import type { Response } from "express";
import { isValidId, parseLimit } from "../../lib/validateHelper.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getProfile, getProfileBottles, getProfileMembers } from "./profile.service.js";

/*
 * :memberId 可以是數字，或 "me"（自己的個人頁，要登入）
 * 回傳 null 代表已經回應錯誤了
 */
const resolveTarget = (req: AuthRequest, res: Response) => {
    const raw = String(req.params.memberId ?? "");
    if (raw === "me") {
        if (!req.user?.member_id) {
            res.status(401).json({ message: "請先登入" });
            return null;
        }
        return req.user.member_id;
    }
    const id = Number(raw);
    if (!isValidId(id)) {
        res.status(400).json({ message: "無效的會員 ID" });
        return null;
    }
    return id;
};

const handleError = (res: Response, error: unknown, label: string) => {
    /*有封鎖關係時這裡也當作找不到，不讓對方知道被封鎖*/
    if (error instanceof Error && (error.message === "NOT_FOUND" || error.message === "BLOCKED")) {
        return res.status(404).json({ message: "找不到這位使用者" });
    }
    if (error instanceof Error && error.message === "FOLLOW_LIST_HIDDEN") {
        return res.status(403).json({ code: "FOLLOW_LIST_HIDDEN", message: "此用戶婉拒您的查看" });
    }
    console.error(`${label} 錯誤:`, error);
    return res.status(500).json({ message: "伺服器錯誤，請稍後再試" });
};

const pageOf = (req: AuthRequest) => parseLimit(req.query.page, 1, 1000);

export const profileController = {

    async getProfile(req: AuthRequest, res: Response) {
        const targetId = resolveTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getProfile(targetId, req.user?.member_id) });
        } catch (error) {
            return handleError(res, error, "getProfile");
        }
    },

    async getBottles(req: AuthRequest, res: Response) {
        const targetId = resolveTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getProfileBottles(targetId, pageOf(req), req.user?.member_id) });
        } catch (error) {
            return handleError(res, error, "getProfileBottles");
        }
    },

    async getFollowers(req: AuthRequest, res: Response) {
        const targetId = resolveTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getProfileMembers(targetId, "followers", pageOf(req), req.user?.member_id) });
        } catch (error) {
            return handleError(res, error, "getProfileFollowers");
        }
    },

    async getFollowing(req: AuthRequest, res: Response) {
        const targetId = resolveTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getProfileMembers(targetId, "following", pageOf(req), req.user?.member_id) });
        } catch (error) {
            return handleError(res, error, "getProfileFollowing");
        }
    },
};
