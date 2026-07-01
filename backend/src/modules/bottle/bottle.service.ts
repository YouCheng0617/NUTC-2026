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
/*新增瓶子並透過 AI 自動審核與分類*/
export const createBottle = async (
    memberId: number, 
    title: string, 
    content: string, 
    isAnonymous: boolean
) => {
    // 1. 設定預設值 (萬一 AI 伺服器掛掉，文章還是能以狀態 1 存入)
    let finalStatus = 1; 
    let violationReason = null;
    let aiCategory = 4; // 預設分類代號

    try {
        // 2. 把使用者的內容送給妳的 Python AI 大腦
        console.log("📡 正在將貼文傳送給 AI 進行審核...");
        const aiResponse = await fetch("http://127.0.0.1:5000/api/analyze", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ content: content })
        });

        // 3. 解析 AI 回傳的結果
        if (aiResponse.ok) {
            const aiResult = await aiResponse.json();
            const aiData = aiResult.data;

            // 判斷狀態 (2 = 通過, 3 = 不通過)
            finalStatus = aiData.ai_status === "通過" ? 2 : 3;
            violationReason = aiData.ai_status === "通過" ? null : aiData.ai_reason;
            aiCategory = aiData.category;
            
            console.log(`✅ AI 處理完畢！狀態: ${finalStatus}, 分類: ${aiCategory}`);
        } else {
            console.warn("⚠️ AI 伺服器回傳異常狀態碼，將使用預設值 (1)");
        }
    } catch (error) {
        console.error("❌ 無法連線到 AI 伺服器 (請確認 python api_server.py 是否有啟動):", error);
    }

    // 4. 將最終結果存入 Prisma 資料庫
    const newBottle = await prisma.bottle.create({
        data: {
            member_id: memberId,
            title: title,
            content: content,
            is_anonymous: isAnonymous,
            status: finalStatus,
            violation_reason: violationReason,
            
            // 💡 這裡將 AI 算出來的分類代號直接寫入關聯表
            // (注意：這裡的寫法是基於妳前面的 Prisma 結構推測的，如果報錯請依妳的 schema 微調)
            categories: {
                create: {
                    category_id: aiCategory
                }
            }
        }
    });

    return newBottle;
};