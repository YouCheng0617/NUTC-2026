import { count } from "node:console";
import prisma from "../../lib/prisma.js";
import dotenv from "dotenv";

/*獲取我丟的瓶子清單*/
export const getMybottles = async (memberId: number) => {
    const myBottles = await prisma.bottle.findMany({
        where: {
            member_id: memberId,
        },
        orderBy: {
            created_at: "desc",
        },
        include: {
            categories: {
                include: {
                    category: true,
                }
            },
            _count: {
                select: { likes: true, saves: true }
            }
        }
    });
    return myBottles.map(bottle => {
        const { _count, categories, ...bottleData } = bottle;
        return {
            ...bottleData,
            like_count: _count.likes,
            save_count: _count.saves,
            category_list: categories.map(c => c.category?.name || "未知類別")
        };
    });
};

/*按讚/取消按讚瓶子*/
export const likeBottles = async (bottleId: number, memberId: number) => {
    // 1. 先查有沒有按過讚
    const existingLike = await prisma.bottleLike.findUnique({
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
        await prisma.bottleLike.delete({
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
        await prisma.bottleLike.create({
            data: {
                member_id: memberId,
                bottle_id: bottleId
            }
        });
        isLiked = true;
    }

    // 3. 計算最新總讚數並回傳
    const totalLikes = await prisma.bottleLike.count({
        where: { bottle_id: bottleId }
    });

    return { isLiked, totalLikes };
};

/*獲取我按過讚的瓶子清單*/
export const getMyLikedBottles = async (memberId: number) => {
    const likedRecords = await prisma.bottleLike.findMany({
        where: { member_id: memberId },
        include: {
            bottle: {
                include: {
                    author: {
                        select: {
                            name: true,
                        }
                    },
                    categories: {
                        include: {
                            category: true
                        }
                    },
                    _count: {
                        select: { likes: true, saves: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return likedRecords.map(record => {
        const { _count, author, ...bottleData } = record.bottle;
        return {
            ...bottleData,
            like_count: _count.likes,
            save_count: _count.saves,
            member_name: author?.name || "匿名使用者",
            category_list: record.bottle.categories.map(c => c.category?.name || "未知類別")
        };
    });
};

/*儲存/取消儲存瓶子*/
export const saveBottles = async (bottleId: number, memberId: number) => {
    // 1. 先查有沒有儲存
    const existingSave = await prisma.bottleSave.findUnique({
        where: {
            member_id_bottle_id: {
                member_id: memberId,
                bottle_id: bottleId,
            }
        }
    });

    let isSaved: boolean;

    // 2. 邏輯判斷
    if (existingSave) {
        await prisma.bottleSave.delete({
            where: {
                member_id_bottle_id: {
                    member_id: memberId,
                    bottle_id: bottleId
                }
            }
        });
        isSaved = false;
    } else {
        await prisma.bottleSave.create({
            data: {
                member_id: memberId,
                bottle_id: bottleId
            }
        });
        isSaved = true;
    }

    // 3. 計算最新總讚數並回傳
    const totalLikes = await prisma.bottleLike.count({
        where: { bottle_id: bottleId }
    });

    // 4. 計算最新總儲存數並回傳
    const totalSaves = await prisma.bottleSave.count({
        where: { bottle_id: bottleId }
    });

    return { isSaved, totalLikes, totalSaves };
};

/*獲取我儲存的瓶子清單*/
export const getMySavedBottles = async (memberId: number) => {
    const savedRecords = await prisma.bottleSave.findMany({
        where: { member_id: memberId },
        include: {
            bottle: {
                include: {
                    author: {
                        select: {
                            name: true,
                        }
                    },
                    categories: {
                        include: {
                            category: true
                        }
                    },
                    _count: {
                        select: { likes: true, saves: true }
                    }
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return savedRecords.map(record => {
        const { _count, author, ...bottleData } = record.bottle;
        return {
            ...bottleData,
            like_count: _count.likes,
            save_count: _count.saves,
            member_name: author?.name || "匿名使用者",
            category_list: record.bottle.categories.map(c => c.category?.name || "未知類別")
        };
    });
};

/*刪除自己的文章*/
export const deleteMyBottle = async (bottleId: number, memberId: number) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });

    if (!bottle || bottle.member_id !== memberId) {
        throw new Error("BOTTLE_NOT_FOUND or FORBIDDEN_NOT_AUTHOR");
    }

    await prisma.bottleCategory.deleteMany({
        where: { bottle_id: bottleId }
    });
    await prisma.bottle.delete({
        where: { bottle_id: bottleId }
    });

    return true;
};

export const getTodayBottle = async () => {
    const startToday = new Date();
    startToday.setHours(0, 0, 0, 0);
    const endToday = new Date();
    endToday.setHours(23, 59, 59, 999);

    const todayBottlesCount = await prisma.bottle.count({
        where: {
            created_at: {
                gte: startToday,
                lte: endToday,
            },
        }
    });
    return {
        todayBottles: todayBottlesCount
    }
};
