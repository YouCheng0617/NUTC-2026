import type { Response } from "express";
import { isValidId } from "../../lib/validateHelper.js";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { getMemberBottles, getMemberFollowList, getMemberProfile } from "./members.service.js";

/*回傳 null 代表已經回應錯誤了*/
const parseTarget = (req: AuthRequest, res: Response) => {
    const id = Number(req.params.memberId);
    if (!isValidId(id)) {
        res.status(400).json({ message: "無效的會員 ID" });
        return null;
    }
    return id;
};

/*前端看 code 決定顯示什麼畫面，字串不要改*/
const handleError = (res: Response, error: unknown, label: string) => {
    const code = error instanceof Error ? error.message : "";
    if (code === "NOT_FOUND") {
        return res.status(404).json({ message: "找不到這位使用者" });
    }
    if (code === "BLOCKED") {
        return res.status(403).json({ code: "BLOCKED", message: "無法查看這位使用者" });
    }
    if (code === "FOLLOW_LIST_HIDDEN") {
        return res.status(403).json({ code: "FOLLOW_LIST_HIDDEN", message: "此用戶婉拒您的查看" });
    }
    console.error(`${label} 錯誤:`, error);
    return res.status(500).json({ message: "伺服器錯誤，請稍後再試" });
};

export const membersController = {

    async getProfile(req: AuthRequest, res: Response) {
        const targetId = parseTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getMemberProfile(targetId, req.user!.member_id) });
        } catch (error) {
            return handleError(res, error, "getMemberProfile");
        }
    },

    async getBottles(req: AuthRequest, res: Response) {
        const targetId = parseTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ bottles: await getMemberBottles(targetId, req.user!.member_id) });
        } catch (error) {
            return handleError(res, error, "getMemberBottles");
        }
    },

    async getFollowers(req: AuthRequest, res: Response) {
        const targetId = parseTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getMemberFollowList(targetId, "followers", req.user!.member_id) });
        } catch (error) {
            return handleError(res, error, "getMemberFollowers");
        }
    },

    async getFollowing(req: AuthRequest, res: Response) {
        const targetId = parseTarget(req, res);
        if (targetId === null) return;
        try {
            return res.status(200).json({ data: await getMemberFollowList(targetId, "following", req.user!.member_id) });
        } catch (error) {
            return handleError(res, error, "getMemberFollowing");
        }
    },
};
