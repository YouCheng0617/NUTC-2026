import prisma from "../../lib/prisma.js";
import { PrismaClient } from "../../generated/prisma/index.js";
const prismaClient = new PrismaClient();
import dotenv from "dotenv";

export const getMybottles = async (memberId: number) => {
    const myBottles = await prismaClient.bottle.findMany({
        where: {
            member_id: memberId,
        },
        orderBy: {
            created_at: "desc",
        }
    });

    return myBottles;
};

export const likeBottles = async (bottleId: number, memberId: number) => {
    // 1. 先查有沒有按過讚
    const existingLike = await prismaClient.bottleLike.findUnique({
        where: {
            member_id_bottle_id: {
                member_id: memberId,
                bottle_id: bottleId,
            }
        }
    });

    let isLiked: boolean;

    // 2. 邏輯判斷
    if (existingLike) {
        // 🗑️ 情境 A：如果有找到紀錄 (代表想取消讚) -> 執行 delete
        await prismaClient.bottleLike.delete({
            where: {
                member_id_bottle_id: {
                    member_id: memberId,
                    bottle_id: bottleId
                }
            }
        });
        isLiked = false;
    } else {
        // ❤️ 情境 B：如果沒找到紀錄 (代表第一次按讚) -> 執行 create
        await prismaClient.bottleLike.create({
            data: {
                member_id: memberId,
                bottle_id: bottleId
            }
        });
        isLiked = true;
    }

    // 3. 計算最新總讚數並回傳
    const totalLikes = await prismaClient.bottleLike.count({
        where: { bottle_id: bottleId }
    });

    return { isLiked, totalLikes };
};