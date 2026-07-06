import { Router } from "express";
import { authCheck, adminCheck, type AuthRequest } from "../middleware/auth.middleware.js";
import { CategoryController } from "./category.controller.js";

const categoryController = new CategoryController();

export function categoryRouter() {
    const router = Router();
    router.post("/create", authCheck, adminCheck, (req, res) => categoryController.createCategory(req, res));
    return router;
}