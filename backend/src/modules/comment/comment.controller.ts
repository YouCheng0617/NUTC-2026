import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { createComment, getCommentsByBottleId } from "./comment.service.js";

export class CommentController {

    async createCommentController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const bottleId = Number(req.params.bottleId);
            const { content } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "留言內容不能為空" });
            }

            const newComment = await createComment(bottleId, memberId, content);
            return res.status(201).json({
                message: "留言成功",
                data: newComment
            });

        } catch (error: any) {
            console.error("createCommentController 錯誤:", error);
            if (error.message === "瓶子不存在") {
                return res.status(404).json({ message: "瓶子不存在" });
            }
            if (error.message === "瓶子狀態不允許留言") {
                return res.status(400).json({ message: "瓶子狀態不允許留言" });
            }
            return res.status(500).json({ message: error.message || "伺服器錯誤" });
        }
    }

    async getCommentsByBottleIdController(req: Request, res: Response) {
        try {
            const bottleId = Number(req.params.bottleId);

            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }

            const comments = await getCommentsByBottleId(bottleId);
            return res.status(200).json({
                message: "成功獲取留言列表",
                data: comments
            });

        } catch (error: any) {
            console.error("getCommentsByBottleIdController 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤，無法獲取留言" });
        }
    }
}