import prisma from "../../../lib/prisma.js";
import { getTodayDateStr } from "../tarot/tarot.service.js";
import { unlockRandomPicturePieceService } from "./collect.service.js";

/**
 * 可以直接顯示給玩家看的錯誤 (喚醒石不足、已領過、未達成...)
 * controller 收到這種錯誤回 400，其他錯誤一律回 500 固定訊息
 */
export class PuzzleError extends Error {}

/**
 * 拼圖每日任務：每天 00:00 (台北時間) 重置，每個任務完成可領 1 顆喚醒石
 */
const PUZZLE_TASKS = [
    { key: "DAILY_SIGN_IN", title: "每日簽到", type: "SIGN_IN", target: 1, reward: 1 },
    { key: "POST_3", title: "漂流初探", type: "POST", target: 3, reward: 1 },
    { key: "POST_6", title: "侃侃而談", type: "POST", target: 6, reward: 1 },
    { key: "POST_10", title: "海洋話匣子", type: "POST", target: 10, reward: 1 }
] as const;

/**
 * 取得台北時間今天 00:00 對應的 Date，用來查「今天發了幾篇」
 */
const getTaipeiDayStart = (todayStr: string): Date => new Date(`${todayStr}T00:00:00+08:00`);

/**
 * 今天 (台北時間) 發了幾篇漂流瓶，被判定違規 (status = 2) 的不算
 */
async function countTodayPosts(memberId: number, todayStr: string): Promise<number> {
    return prisma.bottle.count({
        where: {
            member_id: memberId,
            created_at: { gte: getTaipeiDayStart(todayStr) },
            status: { not: 2 }
        }
    });
}

/**
 * 1. 查詢今日任務進度與領取狀態
 */
export async function getPuzzleTasksService(memberId: number) {
    const today = getTodayDateStr();

    const [member, todayPostCount, claims] = await Promise.all([
        prisma.member.findUnique({
            where: { member_id: memberId },
            select: { awaken_stones: true }
        }),
        countTodayPosts(memberId, today),
        prisma.puzzleTaskClaim.findMany({
            where: { member_id: memberId, date: today },
            select: { task_key: true }
        })
    ]);

    if (!member) {
        throw new PuzzleError("找不到此會員");
    }

    const claimedKeys = new Set(claims.map((c) => c.task_key));

    const tasks = PUZZLE_TASKS.map((task) => {
        /*簽到：有打開頁面就算完成；發文：看今天發了幾篇*/
        const progress = task.type === "SIGN_IN" ? 1 : Math.min(todayPostCount, task.target);
        return {
            key: task.key,
            title: task.title,
            target: task.target,
            progress,
            reward: task.reward,
            completed: progress >= task.target,
            claimed: claimedKeys.has(task.key)
        };
    });

    return {
        date: today,
        awaken_stones: member.awaken_stones,
        today_post_count: todayPostCount,
        tasks
    };
}

/**
 * 2. 領取任務獎勵 (+喚醒石)
 * 同一天同一個任務只能領一次，由 PuzzleTaskClaim 的 unique 限制擋住連點或重送
 */
export async function claimPuzzleTaskService(memberId: number, taskKey: string) {
    const task = PUZZLE_TASKS.find((t) => t.key === taskKey);
    if (!task) {
        throw new PuzzleError("找不到這個任務");
    }

    const today = getTodayDateStr();

    if (task.type === "POST") {
        const todayPostCount = await countTodayPosts(memberId, today);
        if (todayPostCount < task.target) {
            throw new PuzzleError(`任務還沒達成唷！今天已發文 ${todayPostCount} / ${task.target} 篇`);
        }
    }

    try {
        const [, member] = await prisma.$transaction([
            prisma.puzzleTaskClaim.create({
                data: {
                    member_id: memberId,
                    task_key: task.key,
                    date: today,
                    reward: task.reward
                }
            }),
            prisma.member.update({
                where: { member_id: memberId },
                data: { awaken_stones: { increment: task.reward } },
                select: { awaken_stones: true }
            })
        ]);

        return {
            task_key: task.key,
            reward: task.reward,
            awaken_stones: member.awaken_stones
        };
    } catch (error: any) {
        if (error.code === "P2002") {
            throw new PuzzleError("今天已經領過這個任務的獎勵囉！明天 00:00 再來吧～");
        }
        throw error;
    }
}

/*
 * 同一個會員的抽卡要排隊一個一個來：抽卡會先讀拼圖進度再寫回去，
 * 同時抽同一張圖會撞到 MemberPicture 的 unique 限制，或互相蓋掉剛抽到的碎片。
 * 後端是單一 Node process (pm2 單實例)，用記憶體排隊就夠了。
 */
const drawQueues = new Map<number, Promise<unknown>>();

export function withMemberDrawLock<T>(memberId: number, task: () => Promise<T>): Promise<T> {
    const previous = drawQueues.get(memberId) ?? Promise.resolve();
    const run = previous.then(task);
    const tail = run.catch(() => {});
    drawQueues.set(memberId, tail);
    /*排到最後一個跑完就清掉，避免 Map 越長越大*/
    tail.then(() => {
        if (drawQueues.get(memberId) === tail) drawQueues.delete(memberId);
    });
    return run;
}

/**
 * 3. 消耗 1 顆喚醒石抽碎片
 * 先用條件式扣除 (awaken_stones >= 1 才扣)，同時送出多個請求也不會扣成負數；
 * 若抽卡本身失敗 (例如圖庫是空的) 就把喚醒石退回去
 */
export function drawWithAwakenStoneService(memberId: number) {
    return withMemberDrawLock(memberId, async () => {
        const deducted = await prisma.member.updateMany({
            where: { member_id: memberId, awaken_stones: { gte: 1 } },
            data: { awaken_stones: { decrement: 1 } }
        });

        if (deducted.count === 0) {
            throw new PuzzleError("喚醒石不足！完成每日任務就能獲得喚醒石唷～");
        }

        try {
            return await unlockRandomPicturePieceService(memberId, "AWAKEN_STONE");
        } catch (error) {
            await prisma.member.update({
                where: { member_id: memberId },
                data: { awaken_stones: { increment: 1 } }
            });
            throw error;
        }
    });
}

/**
 * 4. 查詢抽卡紀錄 (新到舊，分頁)
 */
export async function getDrawRecordsService(memberId: number, page: number = 1, limit: number = 20) {
    const safeLimit = Math.min(Math.max(Math.floor(limit) || 20, 1), 50);
    const safePage = Math.max(Math.floor(page) || 1, 1);

    const [total, records] = await prisma.$transaction([
        prisma.puzzleDrawRecord.count({ where: { member_id: memberId } }),
        prisma.puzzleDrawRecord.findMany({
            where: { member_id: memberId },
            orderBy: { created_at: "desc" },
            skip: (safePage - 1) * safeLimit,
            take: safeLimit,
            include: {
                picture: {
                    select: { id: true, title: true, image_url: true }
                }
            }
        })
    ]);

    return {
        records: records.map((r) => ({
            id: r.id,
            picture: r.picture,
            piece_number: r.piece_number,
            rarity: r.rarity,
            is_new_piece: r.is_new_piece,
            is_completed_now: r.is_completed_now,
            obtained_from: r.obtained_from,
            created_at: r.created_at
        })),
        pagination: {
            page: safePage,
            limit: safeLimit,
            total,
            totalPages: Math.ceil(total / safeLimit)
        }
    };
}
