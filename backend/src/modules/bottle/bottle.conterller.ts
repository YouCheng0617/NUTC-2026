import { Router } from "express";
import type { Request, Response } from "express";
import prisma from "../../lib/prisma.js";
import dotenv from "dotenv";
export interface TokenPayload {
    member_id: number;
}
export interface AuthRequest extends Request {
    user?: TokenPayload;
}

export const bottleController = {

    /* 丟出瓶子 */
    async throwBottle(req: AuthRequest, res: Response) {
        try {
            const { title, content, isAnonymous } = req.body;
            const memberId = req.user?.member_id;

            if (!title || !content) {
                return res.status(400).json({ message: "瓶子標題和內容不能是空的" });
            }
            const newBottle = await prisma.bottle.create({
                data: {
                    title,
                    content,
                    is_anonymous: isAnonymous || false,
                    member_id: memberId!,
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
            const memberId = req.user?.member_id;
            const limit = 10; /* 每次獲取的瓶子數量 */

            const availableBottles = await prisma.bottle.findMany({
                where: {
                    member_id: { not: memberId! },
                    status: 1 /* 只撈取審核通過的瓶子 */
                },
                select: { bottle_id: true }
            });
            if (availableBottles.length === 0) {
                return res.status(404).json({ message: "茫茫大海中，目前沒有撈到任何瓶子" });
            }
            /* 隨機選取瓶子 */
            const suffledBottles = availableBottles.sort(() => 0.5 - Math.random());
            /* 取出前 limit 個瓶子 ID ，如果瓶子數量<limit，則取所有瓶子 */
            const seletBottles = suffledBottles.slice(0, limit).map(bottle => bottle.bottle_id);

            /* 根據選取的瓶子 ID 獲取瓶子詳細信息 */
            const randomBottles = await prisma.bottle.findMany({
                where: {
                    bottle_id: { in: seletBottles! }
                },
                include: {
                    author: {
                        select: { name: true, }
                    }
                }
            });

            const responseBottles = randomBottles.map(bottle => ({
                bottle_id: bottle.bottle_id,
                title: bottle.title,
                content: bottle.content,
                author_name: bottle.is_anonymous ? "匿名使用者" : bottle.author.name,
                created_at: bottle.created_at,
            }));

            res.status(200).json({
                message: `海水退去，你成功撈取了 ${responseBottles.length} 個瓶子`,
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

    }

}
