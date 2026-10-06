import { isValidId } from "../../lib/validateHelper.js";
import type { Response, Request } from "express";
import type { AuthRequest } from "../middleware/auth.middleware.js";
import { createComment, getCommentsByBottleId, likeComment, createReply, updateComment, deleteComment } from "./comment.service.js";
import { EDIT_WINDOW_MINUTES } from "../../lib/editWindow.js";

export class CommentController {

    async createCommentController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const bottleId = Number(req.params.bottleId);
            const { content, isAnonymous } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!isValidId(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "留言內容不能為空" });
            }

            const newComment = await createComment(bottleId, memberId, content, Boolean(isAnonymous));
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
            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }

    async getCommentsByBottleIdController(req: AuthRequest, res: Response) {
        try {
            const bottleId = Number(req.params.bottleId);
            const memberId = req.user?.member_id as number;
            if (!isValidId(bottleId)) {
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
            if (!isValidId(commentId)) {
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
            const { content, isAnonymous } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!isValidId(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (!isValidId(parentId)) {
                return res.status(400).json({ message: "無效的留言 ID" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "回覆內容不能為空" });
            }

            const newReply = await createReply(bottleId, memberId, content, parentId, Boolean(isAnonymous));

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

            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }

    /* 修改留言（本人、留言後 20 分鐘內） */
    async updateCommentController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const commentId = Number(req.params.commentId);
            const { content } = req.body;

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!isValidId(commentId)) {
                return res.status(400).json({ message: "無效的留言 ID" });
            }
            if (!content || typeof content !== "string" || content.trim() === "") {
                return res.status(400).json({ message: "留言內容不能為空" });
            }

            const updated = await updateComment(commentId, memberId, content);
            return res.status(200).json({ message: "留言已修改", data: updated });

        } catch (error: any) {
            if (error.message === "COMMENT_NOT_FOUND") {
                return res.status(404).json({ message: "留言不存在" });
            }
            if (error.message === "FORBIDDEN_NOT_AUTHOR") {
                return res.status(403).json({ message: "只能修改自己的留言" });
            }
            if (error.message === "EDIT_WINDOW_EXPIRED") {
                return res.status(403).json({ message: `留言超過 ${EDIT_WINDOW_MINUTES} 分鐘就不能修改了` });
            }
            console.error("updateCommentController 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }

    /* 刪除留言（本人） */
    async deleteCommentController(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const commentId = Number(req.params.commentId);

            if (!memberId) {
                return res.status(401).json({ message: "請先登入" });
            }
            if (!isValidId(commentId)) {
                return res.status(400).json({ message: "無效的留言 ID" });
            }

            const result = await deleteComment(commentId, memberId);
            return res.status(200).json({ message: "留言已刪除", data: result });

        } catch (error: any) {
            if (error.message === "COMMENT_NOT_FOUND") {
                return res.status(404).json({ message: "留言不存在" });
            }
            if (error.message === "FORBIDDEN_NOT_AUTHOR") {
                return res.status(403).json({ message: "只能刪除自己的留言" });
            }
            console.error("deleteCommentController 錯誤:", error);
            return res.status(500).json({ message: "伺服器錯誤" });
        }
    }
}
