import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import dotenv from "dotenv";
import { getMybottles, likeBottles, saveBottles, getMyLikedBottles, getMySavedBottles, deleteMyBottle as deleteMyBottleService } from "./bottle.service.js";
export interface TokenPayload {
    member_id: number;
    email: string;
    role: string;
}
export interface AuthRequest extends Request {
    user?: TokenPayload;
}

export const bottleController = {

    /* 丟出瓶子 */
    async throwBottle(req: AuthRequest, res: Response) {
        try {
            const { title, content, isAnonymous, category_id } = req.body;
            const memberId = req.user?.member_id;
            const role = req.user?.role; // 🌟 取得剛才從 Middleware 傳過來的權限

            // 1. 基本身分防呆
            if (!memberId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }

            // 🌟 2. 核心防護：如果是管理員，直接請他換帳號！
            if (role === "ADMIN") {
                return res.status(403).json({
                    message: "管理員帳號無法發文，請切換至一般帳號發文"
                });
            }

            // 3. 資料格式防呆
            if (!title || !content) {
                return res.status(400).json({ message: "瓶子標題和內容不能是空的" });
            }
            if (!Array.isArray(category_id) || category_id.length === 0) {
                return res.status(400).json({ message: "請至少選擇一個分類" });
            }

            // 4. 寫入資料庫
            const newBottle = await prisma.bottle.create({
                data: {
                    title,
                    content,
                    is_anonymous: isAnonymous || false,
                    member_id: memberId, // 這裡已經確定有 memberId，可以直接放
                    status: 1,  /* 暫時預設審核通過 */
                    categories: {
                        create: category_id.map((id: number) => ({
                            category_id: id
                        }))
                    }
                },
                include: {
                    categories: {
                        include: {
                            category: true
                        }
                    }
                }
            });
            res.status(201).json({ message: "瓶子丟出成功", bottle: newBottle });
        } catch (error) {
            console.error("Error creating bottle:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    /* 獲取瓶子 */
    async getBottles(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id; // 💡 訪客會是 undefined
            const limit = 10;
            const categoryIdParam = req.query.categoryId as string;
            const targetCategoryId = categoryIdParam ? parseInt(categoryIdParam) : undefined;

            // 🌟 1. 動態組裝 where 條件
            const whereCondition: any = {
                status: 1, // 只撈取審核通過的瓶子
            };

            // 🌟 如果是會員，就不撈自己的瓶子；如果是訪客，這段就不會加進去
            if (memberId) {
                whereCondition.member_id = { not: memberId };
            }

            // 處理分類過濾
            if (targetCategoryId) {
                whereCondition.categories = {
                    some: { category_id: targetCategoryId }
                };
            }

            // 🌟 2. 第一次查詢：撈出符合條件的瓶子 ID
            const availableBottles = await prisma.bottle.findMany({
                where: whereCondition, // 👈 換成我們剛剛動態組裝的條件
                select: { bottle_id: true }
            });

            if (availableBottles.length === 0) {
                return res.status(404).json({ message: "茫茫大海中，目前沒有撈到任何瓶子" });
            }

            // 隨機選取瓶子
            const suffledBottles = availableBottles.sort(() => 0.5 - Math.random());
            const seletBottles = suffledBottles.slice(0, limit).map(bottle => bottle.bottle_id);

            // 🌟 3. 第二次查詢：獲取詳細資訊
            const randomBottles = await prisma.bottle.findMany({
                where: {
                    bottle_id: { in: seletBottles }
                },
                include: {
                    author: {
                        select: { name: true }
                    },
                    _count: {
                        select: { likes: true, saves: true }
                    },
                    categories: {
                        include: {
                            category: true
                        }
                    }
                }
            });

            // 🌟 4. 整理回傳格式，並清楚告知前端目前的狀態
            const responseBottles = randomBottles.map(bottle => ({
                bottle_id: bottle.bottle_id,
                title: bottle.title,
                content: bottle.content,
                author_name: bottle.is_anonymous ? "匿名使用者" : bottle.author.name,
                created_at: bottle.created_at,
                like_count: bottle._count.likes,
                save_count: bottle._count.saves,
                view_count: bottle.view_count,
                category_list: bottle.categories.map(c => c.category?.name || "未知類別")
            }));

            res.status(200).json({
                // 💡 可以在這裡明確回傳是否為訪客，方便前端判斷
                is_guest: !memberId,
                message: !memberId
                    ? `訪客模式：海水退去，你成功撈取了 ${responseBottles.length} 個瓶子`
                    : `會員模式：海水退去，你成功撈取了 ${responseBottles.length} 個瓶子`,
                bottles: responseBottles
            });

        } catch (error) {
            console.error("Error fetching bottles:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },
    /* AI審核瓶子 */
    async reviewBottle(req: AuthRequest, res: Response) {
        try {
            const aiApiKey = req.headers['x-api-key'] as string;
            const expectedApiKey = process.env['AI_WEBHOOK_API_KEY'];
            if (!expectedApiKey || aiApiKey !== expectedApiKey) {
                return res.status(403).json({ message: "你不是 AI！拒絕存取！" });
            }

            const { bottle_id, status, violation_reason } = req.body;
            if (!bottle_id || status === undefined || ![1, 2].includes(status)) {
                return res.status(400).json({ message: "請提供有效的 bottle_id 和 status並且狀態只能是（1 或 2）" });
            }

            const updateBottle = await prisma.bottle.update({
                where: { bottle_id: bottle_id },
                data: {
                    status: status,
                    violation_reason: status === 2 ? violation_reason : null,
                }
            });

            return res.status(200).json({
                message: `瓶子 #${bottle_id} 審核結果已更新`,
                data: {
                    status: updateBottle.status,
                    violation_reason: updateBottle.violation_reason
                }
            });
        } catch (error) {
            console.error("AI審核瓶子時發生錯誤:", error);
            if ((error as any).code === 'P2025') {
                return res.status(404).json({ message: "找不到該漂流瓶，請檢查瓶子 ID" });
            }
            return res.status(500).json({ message: "內部伺服器錯誤" });
        }

    },

    /* 獲取我的瓶子 */
    async getMyBottles(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id;
            if (!memberId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }
            const myBottles = await getMybottles(memberId!);
            res.status(200).json({
                message: `你總共丟了 ${myBottles.length} 個瓶子`,
                data: myBottles
            })
        } catch (error) {
            console.error("Error fetching my bottles:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    /* 喜歡/取消喜歡瓶子 */
    async likeBottle(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const bottleId = Number(req.params.bottleId);

            if (!bottleId || isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (!memberId || isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員，請重新登入" });
            }

            const result = await likeBottles(bottleId, memberId);
            res.status(200).json({
                message: result.isLiked ? "按讚成功！❤️" : "已取消按讚 💔",
                isLiked: result.isLiked,
                totalLikes: result.totalLikes
            });
        } catch (error) {
            console.error("Error liking bottle:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    /* 儲存/取消儲存瓶子 */
    async saveBottle(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            const bottleId = Number(req.params.bottleId);

            if (!bottleId || isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }
            if (!memberId || isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員，請重新登入" });
            }

            const result = await saveBottles(bottleId, memberId);
            res.status(200).json({
                message: result.isSaved ? "儲存成功！💾" : "已取消儲存 💔",
                isSaved: result.isSaved,
                totalSaves: result.totalSaves // 🌟 這裡修正為 totalSaves
            });
        } catch (error) {
            console.error("Error saving bottle:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    /* 取得我的按讚列表 */
    async getMyLikedBottlesList(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            if (!memberId || isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員，請重新登入" });
            }

            const bottles = await getMyLikedBottles(memberId);
            res.status(200).json(bottles);
        } catch (error) {
            console.error("Error fetching liked bottles:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    /* 取得我的收藏列表 */
    async getMySavedBottlesList(req: AuthRequest, res: Response) {
        try {
            const memberId = req.user?.member_id as number;
            if (!memberId || isNaN(memberId)) {
                return res.status(400).json({ message: "無效的會員，請重新登入" });
            }

            const bottles = await getMySavedBottles(memberId);
            res.status(200).json(bottles);
        } catch (error) {
            console.error("Error fetching saved bottles:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },

    async deleteMyBottle(req: AuthRequest, res: Response) {
        try {
            const bottleId = Number(req.params.bottleId);
            const memberId = req.user?.member_id as number;

            if (!memberId) {
                return res.status(401).json({ message: "未授權，請先登入" });
            }
            if (isNaN(bottleId)) {
                return res.status(400).json({ message: "無效的瓶子 ID" });
            }

            await deleteMyBottleService(bottleId, memberId);
            res.status(200).json({ message: "文章刪除成功" });

        } catch (error: any) {
            if (error.message === "BOTTLE_NOT_FOUND or FORBIDDEN_NOT_AUTHOR") {
                return res.status(404).json({ message: "找不到該文章 或 權限不足" });
            }
            console.error("Error deleting bottle:", error);
            res.status(500).json({ message: "內部伺服器錯誤" });
        }
    },
}
