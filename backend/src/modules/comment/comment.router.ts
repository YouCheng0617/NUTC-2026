import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { CommentController } from "./comment.controller.js";
import { commentLimiter } from "../../lib/rateLimiter.js";


const commentController = new CommentController();

export function commentRouter() {
    const router = Router();
    router.post("/bottles/:bottleId", authCheck, commentLimiter, (req, res) => commentController.createCommentController(req, res));
    router.get("/bottles/:bottleId", optionalAuthCheck, (req, res) => commentController.getCommentsByBottleIdController(req, res));
    router.post("/:commentId/like", authCheck, (req, res) => commentController.likeCommentController(req, res));
    router.post("/bottles/:bottleId/comments/:parentId/reply", authCheck, commentLimiter, (req, res) => commentController.createReplyController(req, res));
    router.patch("/:commentId", authCheck, (req, res) => commentController.updateCommentController(req, res));
    router.delete("/:commentId", authCheck, (req, res) => commentController.deleteCommentController(req, res));
    return router;
}

