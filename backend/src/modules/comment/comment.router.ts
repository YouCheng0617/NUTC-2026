import { Router } from "express";
import { authCheck, adminCheck, optionalAuthCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { CommentController } from "./comment.controller.js";


const commentController = new CommentController();

export function commentRouter() {
    const router = Router();
    router.post("/bottles/:bottleId", authCheck, (req, res) => commentController.createCommentController(req, res));
    router.get("/bottles/:bottleId", optionalAuthCheck, (req, res) => commentController.getCommentsByBottleIdController(req, res));
    router.post("/:commentId/like", authCheck, (req, res) => commentController.likeCommentController(req, res));
    return router;
}

