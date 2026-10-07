import { count } from "node:console";
import prisma from "../../lib/prisma.js";
import dotenv from "dotenv";
import { createNotification } from "../notification/notification.service.js";
import { getBlockedMemberIds, isBlockedBetween } from "../block/block.service.js";
import { isWithinEditWindow } from "../../lib/editWindow.js";

/* 投票選項 include：memberId 存在時一併撈出該會員自己的投票 */
const pollInclude = (memberId?: number) => ({
    PollOption: {
        select: {
            id: true,
            text: true,
            _count: { select: { votes: true } }
        }
    },
    PollVote: {
        where: { member_id: memberId ?? -1 }, // 訪客沒有投票紀錄
        select: { option_id: true }
    }
});

/* 把 PollOption / PollVote 轉成回傳給前端的 poll_options / user_voted_option_id */
const formatPoll = (bottle: {
    PollOption: { id: number; text: string; _count: { votes: number } }[];
    PollVote: { option_id: number }[];
}) => ({
    poll_options: bottle.PollOption.map(opt => ({
        option_id: opt.id,
        text: opt.text,
        vote_count: opt._count.votes
    })),
    user_voted_option_id: bottle.PollVote[0]?.option_id ?? null
});

/* 匿名文章不回傳作者 ID，避免被反查出發文者 (自己的文章清單不需要) */
const hideAnonymousAuthor = <T extends { is_anonymous: boolean; member_id: number }>(bottle: T) => ({
    ...bottle,
    member_id: bottle.is_anonymous ? null : bottle.member_id
});

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
            },
            ...pollInclude(memberId)
        }
    });
    return myBottles.map(bottle => {
        const { _count, categories, PollOption, PollVote, ...bottleData } = bottle;
        return {
            ...bottleData,
            like_count: _count.likes,
            save_count: _count.saves,
            category_list: categories.map(c => c.category?.name || "未知類別"),
            ...formatPoll(bottle)
        };
    });
};

/*按讚/取消按讚瓶子*/
export const likeBottles = async (bottleId: number, memberId: number) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });

    const liker = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: { name: true }
    });

    // 有封鎖關係時當作文章不存在，不讓對方知道被封鎖
    if (!bottle || await isBlockedBetween(memberId, bottle.member_id)) {
        throw new Error("找不到該漂流瓶");
    }

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
        if (bottle.member_id) {
            const likerName = liker?.name || "未知使用者";

            await createNotification(
                bottle.member_id,
                'BOTTLE_LIKE',
                `${likerName} 按了你的漂流瓶讚！`,
                memberId,
                bottleId,
                { dedupe: true }
            ).catch(err => console.error("按讚通知發送失敗:", err));
        }
    }


    // 3. 計算最新總讚數並回傳
    const totalLikes = await prisma.bottleLike.count({
        where: { bottle_id: bottleId }
    });

    return { isLiked, totalLikes };
};

/*獲取我按過讚的瓶子清單*/
export const getMyLikedBottles = async (memberId: number) => {
    const blockedIds = await getBlockedMemberIds(memberId);
    const likedRecords = await prisma.bottleLike.findMany({
        where: {
            member_id: memberId,
            bottle: { member_id: { notIn: blockedIds } }
        },
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
                    },
                    ...pollInclude(memberId)
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return likedRecords.map(record => {
        const { _count, author, PollOption, PollVote, ...bottleData } = record.bottle;
        return {
            ...hideAnonymousAuthor(bottleData),
            like_count: _count.likes,
            save_count: _count.saves,
            member_name: bottleData.is_anonymous ? "匿名使用者" : (author?.name || "未知使用者"),
            category_list: record.bottle.categories.map(c => c.category?.name || "未知類別"),
            ...formatPoll(record.bottle)
        };
    });
};

/*儲存/取消儲存瓶子*/
export const saveBottles = async (bottleId: number, memberId: number) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });

    const saver = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: { name: true }
    });

    // 有封鎖關係時當作文章不存在，不讓對方知道被封鎖
    if (!bottle || await isBlockedBetween(memberId, bottle.member_id)) {
        throw new Error("找不到該漂流瓶");
    }

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

        if (bottle.member_id) {
            const saverName = saver?.name || "未知使用者";

            await createNotification(
                bottle.member_id,
                'BOTTLE_SAVE',
                `${saverName} 收藏了你的漂流瓶！`,
                memberId,
                bottleId,
                { dedupe: true }
            ).catch(err => console.error("收藏通知發送失敗:", err));
        }
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
    const blockedIds = await getBlockedMemberIds(memberId);
    const savedRecords = await prisma.bottleSave.findMany({
        where: {
            member_id: memberId,
            bottle: { member_id: { notIn: blockedIds } }
        },
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
                    },
                    ...pollInclude(memberId)
                }
            }
        },
        orderBy: { createdAt: "desc" }
    });

    return savedRecords.map(record => {
        const { _count, author, PollOption, PollVote, ...bottleData } = record.bottle;
        return {
            ...hideAnonymousAuthor(bottleData),
            like_count: _count.likes,
            save_count: _count.saves,
            member_name: bottleData.is_anonymous ? "匿名使用者" : (author?.name || "未知使用者"),
            category_list: record.bottle.categories.map(c => c.category?.name || "未知類別"),
            ...formatPoll(record.bottle)
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

/*檢舉瓶子*/
export const reportBottle = async (bottleId: number, memberId: number, reason: string) => {
    const trimmedReason = reason.trim();
    if (!trimmedReason) {
        throw new Error("REPORT_REASON_EMPTY");
    }

    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });
    if (!bottle) {
        throw new Error("BOTTLE_NOT_FOUND");
    }

    try {
        const newReport = await prisma.bottleReport.create({
            data: {
                member_id: memberId,
                bottle_id: bottleId,
                reason: trimmedReason,
            }
        });

        if (bottle.member_id) {
            await createNotification(
                bottle.member_id,
                'SYSTEM_ALERT',
                '你的漂流瓶收到了一次檢舉，請確保內容符合規範。若查核違規，系統將會直接進行下架處理。',
                undefined,
                bottleId
            ).catch(err => console.error("檢舉通知發送失敗:", err));
        }

        await createNotification(
            memberId,
            'SYSTEM',
            '我們已收到你的檢舉，審查團隊會盡快核實處理，感謝你協助維護社群環境！',
            undefined,
            bottleId
        ).catch(err => console.error("檢舉回饋通知發送失敗:", err));

        return newReport;
    } catch (error: any) {
        if (error.code === 'P2002') {
            throw new Error("ALREADY_REPORTED");
        }
        throw error;
    }
};

export const searchBottle = async (keyword: string, memberId?: number) => {
    const searchTerm = keyword.trim();

    if (!searchTerm) {
        return [];
    }

    const blockedIds = await getBlockedMemberIds(memberId);
    const searchResults = await prisma.bottle.findMany({
        where: {

            status: 1,
            member_id: { notIn: blockedIds }, // 排除有封鎖關係的人的文章

            OR: [
                { title: { contains: searchTerm } },
                { content: { contains: searchTerm } },
                {
                    author: {
                        name: { contains: searchTerm }
                    },
                    is_anonymous: false
                }
            ]
        },
        orderBy: {
            created_at: "desc",
        },
        include: {
            author: {
                select: {
                    name: true,
                }
            },
            categories: {
                include: {
                    category: true,
                }
            },
            _count: {
                select: { likes: true, saves: true }
            },
            ...pollInclude(memberId)
        }
    });

    return searchResults.map(bottle => {
        const { _count, categories, author, PollOption, PollVote, ...bottleData } = bottle;
        return {
            ...hideAnonymousAuthor(bottleData),
            like_count: _count.likes,
            save_count: _count.saves,
            // 💡 重要：處理匿名邏輯，保護發文者
            member_name: bottleData.is_anonymous ? "匿名使用者" : (author?.name || "未知使用者"),
            category_list: categories.map(c => c.category?.name || "未知類別"),
            ...formatPoll(bottle)
        };
    });
};

/*獲取熱門瓶子 (依收藏數排序)*/
/* 熱門瓶子：互動分數 ÷ 時間衰減（Hacker News 的做法），新文章熱起來也上得了榜
 *   分數 = (留言×2 + 收藏×3) ÷ (發文經過的小時數 + 2) ^ 1.5
 *   （瓶子的按讚在畫面上按不到：卡片的按鈕列藏起來了、文章頁只有收藏，所以不算讚數）
 *   只從最近 14 天挑；不夠的話用比較舊、收藏多的文章補滿，看板才不會空 */
const POPULAR_WINDOW_DAYS = 14;
const POPULAR_WEIGHTS = { comment: 2, save: 3 };
const POPULAR_GRAVITY = 1.5;
const POPULAR_CANDIDATES = 300; // 最近 14 天最多拿幾篇來算分數

export const getPopularBottles = async (limit: number = 10, memberId?: number) => {
    const blockedIds = await getBlockedMemberIds(memberId);
    const baseWhere = {
        status: 1, // 只抓取審核通過的文章
        member_id: { notIn: blockedIds }, // 排除有封鎖關係的人的文章
    };
    const include = {
        author: { select: { name: true } },
        categories: { include: { category: true } },
        _count: {
            select: {
                likes: true,
                saves: true,
                Comment: { where: { is_deleted: false } } // 已刪除的留言不算
            }
        },
        ...pollInclude(memberId)
    };

    const since = new Date(Date.now() - POPULAR_WINDOW_DAYS * 24 * 60 * 60 * 1000);
    const recent = await prisma.bottle.findMany({
        where: { ...baseWhere, created_at: { gte: since } },
        orderBy: { created_at: "desc" },
        take: POPULAR_CANDIDATES,
        include
    });

    const now = Date.now();
    const score = (b: typeof recent[number]) => {
        const interactions =
            b._count.Comment * POPULAR_WEIGHTS.comment +
            b._count.saves * POPULAR_WEIGHTS.save;
        const hours = Math.max(0, (now - b.created_at.getTime()) / 3600000);
        return interactions / Math.pow(hours + 2, POPULAR_GRAVITY);
    };

    let ranked = recent
        .map((b) => ({ b, score: score(b) }))
        .filter((x) => x.score > 0) // 完全沒互動的不算熱門
        .sort((x, y) => y.score - x.score || y.b.created_at.getTime() - x.b.created_at.getTime()) // 同分時新的排前面
        .slice(0, limit)
        .map((x) => x.b);

    // 最近的熱門文章不夠：用比較舊、收藏多的補滿
    if (ranked.length < limit) {
        const filler = await prisma.bottle.findMany({
            where: { ...baseWhere, bottle_id: { notIn: ranked.map((b) => b.bottle_id) } },
            orderBy: [{ saves: { _count: "desc" } }, { Comment: { _count: "desc" } }, { created_at: "desc" }],
            take: limit - ranked.length,
            include
        });
        ranked = ranked.concat(filler);
    }

    return ranked.map(bottle => {
        const { _count, categories, author, PollOption, PollVote, ...bottleData } = bottle;
        return {
            ...hideAnonymousAuthor(bottleData),
            like_count: _count.likes,
            save_count: _count.saves,
            comment_count: _count.Comment,
            member_name: bottleData.is_anonymous ? "匿名使用者" : (author?.name || "未知使用者"),
            category_list: categories.map(c => c.category?.name || "未知類別"),
            ...formatPoll(bottle)
        };
    });
};

export const votePoll = async (bottleId: number, memberId: number, optionId: number) => {
    const option = await prisma.pollOption.findUnique({
        where: { id: optionId },
    });

    if (!option || option.bottle_id !== bottleId) {
        throw new Error("無效的選項或該選項不屬於此漂流瓶");
    }

    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });
    if (!bottle || await isBlockedBetween(memberId, bottle.member_id)) {
        throw new Error("找不到該漂流瓶");
    }

    const existingVote = await prisma.pollVote.findFirst({
        where: {
            bottle_id: bottleId,
            member_id: memberId,
        }
    });

    let voteRecord;

    if (existingVote) {
        voteRecord = await prisma.pollVote.update({
            where: { id: existingVote.id }, // 用剛剛找到的現有紀錄 ID 來更新
            data: { option_id: optionId }
        });
    } else {
        voteRecord = await prisma.pollVote.create({
            data: {
                member_id: memberId,
                bottle_id: bottleId,
                option_id: optionId
            }
        });
    }

    return voteRecord;
};
/* 🔔 瓶子被下架／刪除時，通知還在等結果的檢舉人 */
export const notifyReporters = async (reporterIds: number[], bottleId: number) => {
    for (const reporterId of reporterIds) {
        await createNotification(
            reporterId,
            'SYSTEM',
            '你檢舉的漂流瓶經審查確認違規，已被處理。感謝你協助維護社群環境！',
            undefined,
            bottleId
        ).catch(err => console.error("檢舉結果通知發送失敗:", err));
    }
};

/* 瓶子被判定違規：把待處理的檢舉改成「成立」並通知檢舉人（只處理 status 0，所以不會重複通知） */
export const resolvePendingReports = async (bottleId: number) => {
    const pending = await prisma.bottleReport.findMany({
        where: { bottle_id: bottleId, status: 0 },
        select: { member_id: true }
    });
    if (pending.length === 0) return;

    await prisma.bottleReport.updateMany({
        where: { bottle_id: bottleId, status: 0 },
        data: { status: 1 }
    });
    await notifyReporters(pending.map(r => r.member_id), bottleId);
};

/* 🔔 瓶子審核通過：新瓶子通知「漂進海裡了」，被判違規後又恢復的通知「已恢復上架」 */
export const notifyBottleApproved = async (memberId: number | null, bottleId: number, beforeStatus: number | undefined, wasEdited = false) => {
    if (!memberId || beforeStatus === 1 || beforeStatus === undefined) return;

    const message = beforeStatus === 2
        ? '你的漂流瓶經重新審核後已恢復上架，又漂回海裡了！'
        : wasEdited
            ? '你修改後的漂流瓶通過審核，又漂回海裡了！'
            : '你的漂流瓶通過審核，已經漂進海裡了！';

    await createNotification(
        memberId,
        'SYSTEM',
        message,
        undefined,
        bottleId
    ).catch(err => console.error("審核通過通知發送失敗:", err));
};

/* 修改瓶子：只有作者、只在發文後 20 分鐘內
 * 內容有改就退回「待審」重新跑 AI 審核，避免先發正常內容過審、再偷改成違規內容 */
export const updateMyBottle = async (bottleId: number, memberId: number, title: string, content: string) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true, created_at: true, title: true, content: true }
    });
    if (!bottle) {
        throw new Error("BOTTLE_NOT_FOUND");
    }
    if (bottle.member_id !== memberId) {
        throw new Error("FORBIDDEN_NOT_AUTHOR");
    }
    if (!isWithinEditWindow(bottle.created_at)) {
        throw new Error("EDIT_WINDOW_EXPIRED");
    }

    const newTitle = title.trim();
    const newContent = content.trim();
    if (newTitle === bottle.title && newContent === bottle.content) {
        return { changed: false, status: undefined };
    }

    const updated = await prisma.bottle.update({
        where: { bottle_id: bottleId },
        data: {
            title: newTitle,
            content: newContent,
            edited_at: new Date(),
            status: 0,
            violation_reason: null
        },
        select: { bottle_id: true, title: true, content: true, edited_at: true, status: true }
    });
    return { changed: true, ...updated };
};

/*
 * 首頁「我的海域」：追蹤的人最近 7 天的新瓶
 * 匿名發的不列（不然等於把匿名作者公開了），有封鎖關係的、還沒審核或違規的也不列
 */
export const FOLLOWING_FEED_DAYS = 7;
const FOLLOWING_FEED_LIMIT = 20;

export const getFollowingFeed = async (memberId: number) => {
    const [follows, blockedIds] = await Promise.all([
        prisma.follow.findMany({ where: { follower_id: memberId }, select: { following_id: true } }),
        getBlockedMemberIds(memberId),
    ]);
    const blocked = new Set(blockedIds);
    const followingIds = follows.map(f => f.following_id).filter(id => !blocked.has(id));
    if (followingIds.length === 0) return { followingCount: 0, bottles: [] };

    const bottles = await prisma.bottle.findMany({
        where: {
            member_id: { in: followingIds },
            is_anonymous: false,
            status: 1,
            created_at: { gte: new Date(Date.now() - FOLLOWING_FEED_DAYS * 86400000) },
        },
        orderBy: { created_at: "desc" },
        take: FOLLOWING_FEED_LIMIT,
        select: {
            bottle_id: true,
            title: true,
            content: true,
            created_at: true,
            author: { select: { name: true } },
            categories: { select: { category: { select: { name: true } } } },
        },
    });

    return {
        followingCount: followingIds.length,
        bottles: bottles.map(b => ({
            bottle_id: b.bottle_id,
            title: b.title,
            preview: b.content.replace(/\s+/g, " ").trim().slice(0, 60),
            created_at: b.created_at,
            member_name: b.author?.name || "未知使用者",
            category_list: b.categories.map(c => c.category?.name).filter(Boolean),
        })),
    };
};
