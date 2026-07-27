import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { createComment, getCommentsByBottleId, likeComment, createReply } from "./comment.service.js";

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

    async getCommentsByBottleIdController(req: AuthRequest, res: Response) {
        try {
            const bottleId = Number(req.params.bottleId);
            const memberId = req.user?.member_id as number;
            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }

            const comments = await getCommentsByBottleId(bottleId, memberId);
            return res.status(200).json({
                message: "成功獲取留言列表",
                data: comments
            });

        } catch (error: any) {
            console.error("getCommentsByBottleIdController 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤，無法獲取留言" });
        }
    }

    async likeCommentController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const commentId = parseInt(req.params.commentId as string, 10);

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (isNaN(commentId)) {
                return res.status(400).json({ message: "無效的留言 ID" });
            }

            const result = await likeComment(commentId, memberId);
            return res.status(200).json({
                message: result.message,
                data: {
                    isLiked: result.isLiked
                }
            });

        } catch (error: any) {
            console.error("likeCommentController 錯誤:", error);
            if (error.message === "留言不存在") {
                return res.status(404).json({ message: "留言不存在" });
            }

            return res.status(500).json({ message: "伺服器內部錯誤" });
        }
    }

    async createReplyController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const bottleId = Number(req.params.bottleId);
            const parentId = Number(req.params.parentId); // 從網址抓取父留言的 ID
            const { content } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (isNaN(parentId)) {
                return res.status(400).json({ message: "無效的留言 ID" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "回覆內容不能為空" });
            }

            const newReply = await createReply(bottleId, memberId, content, parentId);

            return res.status(201).json({
                message: "回覆成功",
                data: newReply
            });

        } catch (error: any) {
            console.error("createReplyController 錯誤:", error);

            // 捕捉我們在 Service 寫好的各種防呆錯誤
            if (error.message === "要回覆的留言不存在") {
                return res.status(404).json({ message: error.message });
            }
            if (error.message === "該留言不屬於此漂流瓶，無法回覆" || error.message === "只能回覆主留言，無法針對子留言進行回覆") {
                return res.status(400).json({ message: error.message });
            }

            return res.status(500).json({ message: error.message || "伺服器錯誤" });
        }
    }
}