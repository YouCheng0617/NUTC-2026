import type { Response, Request } from "express";
import { createCategory } from "./category.service.js";

export class CategoryController {
    async createCategory(req: Request, res: Response) {
        try {
            const { name } = req.body;
            const category = await createCategory(name);
            res.status(201).json({
                message: "分類創建成功",
                data: category
            });

        } catch (error: any) {
            if (error.message === "CATEGORY_NAME_EMPTY") {
                return res.status(400).json({ message: "分類名稱不可為空" });
            } else if (error.message === "CATEGORY_ALREADY_EXISTS") {
                return res.status(400).json({ message: "分類名稱已存在" });
            }


            console.error("Error creating category:", error);
            res.status(500).json({
                message: "內部伺服器錯誤",
                real_error: error.message || error.toString()
            });
        }
    };
}