import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';

export const renamePet = async (memberId: number, newName: string) => {

    const trimmedName = newName.trim();
    if (!trimmedName) {
        throw new Error("寵物名字不能為空白！");
    }
    if (trimmedName.length > 10) {
        throw new Error("寵物名字不能超過10個字！");
    }

    const pet = await prisma.pet.findUnique({
        where: { member_id: memberId },
    });

    if (!pet) {
        throw new Error("找不到該會員的寵物！");
    }
    if (pet.is_named) {
        throw new Error("寵物已經命名過了，無法再次命名！");
    }

    return await prisma.pet.update({
        where: { member_id: memberId },
        data: {
            pet_name: trimmedName,
            is_named: true
        }
    });
};
// 財富自由兌換的冷卻與每日次數：放在記憶體即可，不需要動到資料表
const moneyExchangeLog = new Map<number, { last: number; date: string; count: number }>();
// 跳動音符收集的冷卻（上次收集的時間戳）
const musicNoteLog = new Map<number, number>();

export type PetActionType = keyof typeof gameConfig.actions;

// 查詢是否已購買某個特效
const ownsEffect = async (petId: number, effect: string) => {
    return !!(await prisma.petInventory.findUnique({
        where: { pet_id_category_item_name: { pet_id: petId, category: 'background_effects', item_name: effect } }
    }));
};

export const interactPet = async (memberId: number, actionType: PetActionType) => {
    const action = gameConfig.actions[actionType];
    if (!action) {
        throw new Error("無效的互動類型！");
    }

    const pet = await prisma.pet.findUnique({
        where: { member_id: memberId },
    })
    if (!pet) {
        throw new Error("找不到該會員的寵物！");
    }
    const now = new Date();

    // 財富自由兌換走自己的限制：不佔用餵食／清潔／撫摸的冷卻欄位
    if (actionType === 'MONEY_EXCHANGE') {
        const { dailyLimit } = gameConfig.moneyGame;

        // 沒買財富自由特效的人不可能玩這個小遊戲
        if (!(await ownsEffect(pet.pet_id, 'money'))) {
            throw new Error("尚未擁有財富自由特效，無法兌換！");
        }

        // 以下檢查與寫入冷卻之間沒有 await，同一個人同時送多個請求也不會重複通過
        const today = now.toISOString().slice(0, 10);
        const log = moneyExchangeLog.get(memberId) ?? { last: 0, date: today, count: 0 };
        if (log.date !== today) { log.date = today; log.count = 0; }

        const waited = (now.getTime() - log.last) / 1000;
        if (waited < action.cdSeconds) {
            throw new Error(`兌換冷卻中！還需等待 ${Math.ceil(action.cdSeconds - waited)} 秒。`);
        }
        if (dailyLimit > 0 && log.count >= dailyLimit) {
            throw new Error(`今天的兌換次數已用完（每天 ${dailyLimit} 次），明天再來！`);
        }

        log.last = now.getTime();
        log.count += 1;
        moneyExchangeLog.set(memberId, log);

        return await prisma.pet.update({
            where: { member_id: memberId },
            data: { coin: { increment: action.reward } }
        });
    }

    // 跳動音符：點飄浮音符 +15（0.5 秒冷卻）、商店買音符 -1，都沒有次數限制
    if (actionType === 'MUSIC_NOTE' || actionType === 'MUSIC_BUY_NOTE') {
        if (!(await ownsEffect(pet.pet_id, 'music'))) {
            throw new Error("尚未擁有跳動音符特效！");
        }

        if (actionType === 'MUSIC_NOTE') {
            // 檢查與寫入冷卻之間沒有 await，同時送多個請求也只會通過一個
            const waited = (now.getTime() - (musicNoteLog.get(memberId) ?? 0)) / 1000;
            if (waited < action.cdSeconds) {
                throw new Error("收集太快了，請稍等一下！");
            }
            musicNoteLog.set(memberId, now.getTime());

            return await prisma.pet.update({
                where: { member_id: memberId },
                data: { coin: { increment: action.reward } }
            });
        }

        // 買音符：帶條件扣款，金幣不夠就不會扣成負數
        const cost = -action.reward;
        const { count } = await prisma.pet.updateMany({
            where: { member_id: memberId, coin: { gte: cost } },
            data: { coin: { decrement: cost } }
        });
        if (count === 0) {
            throw new Error(`積分不足 ${cost} 分！`);
        }
        return await prisma.pet.findUniqueOrThrow({ where: { member_id: memberId } });
    }

    let lastActionTime: Date;
    let updateField: Record<string, any> = {};

    switch (actionType) {
        case 'FEED':
            lastActionTime = pet.last_feed_time;
            updateField = { last_feed_time: now };
            break;
        case 'PURIFY':
            lastActionTime = pet.last_purify_time;
            updateField = { last_purify_time: now };
            break;
        case 'PET':
            lastActionTime = pet.last_pet_time;
            updateField = { last_pet_time: now };
            break;
    }

    const diffSeconds = (now.getTime() - lastActionTime.getTime()) / 1000;
    if (diffSeconds < action.cdSeconds) {
        const remaining = Math.ceil(action.cdSeconds - diffSeconds);
        throw new Error(`冷卻中！還需等待 ${remaining} 秒才能再次執行。`);
    }

    return await prisma.pet.update({
        where: { member_id: memberId },
        data: {
            coin: { increment: action.reward },
            ...updateField
        }
    })
};
export const buyShopItem = async (
    memberId: number,
    category: 'pet_color' | 'background_color' | 'background_effects',
    itemName: string
) => {

    const pet = await prisma.pet.findUnique({
        where: { member_id: memberId },
        include: { PetInventory: true }
    });
    if (!pet) {
        throw new Error("找不到該會員的寵物！");
    }

    const defaultFreeItems = {
        pet_color: 'snow',
        background_color: 'sky',
        background_effects: 'none'
    };

    const isDefaultItem = defaultFreeItems[category] === itemName;
    const isAlreadyOwned = pet.PetInventory.some(
        item => item.category === category && item.item_name === itemName
    );
    if (isDefaultItem || isAlreadyOwned) {
        return await prisma.pet.update({
            where: { member_id: memberId },
            data: { [category]: itemName },
            include: { PetInventory: true }
        });
    }

    const categoryConfig = gameConfig.shop[category] as Record<string, number>;
    if (!categoryConfig || !(itemName in categoryConfig)) {
        throw new Error("無效的商品！");
    }

    const price = categoryConfig?.[itemName]
    if (price === undefined) {
        throw new Error("找不到該商品或價格未設定！");
    }
    if (pet.coin < price) {
        throw new Error(`金幣不足！購買此商品需要 ${price} 金幣，您目前只有 ${pet.coin} 金幣。`);
    }

    return await prisma.$transaction(async (tx) => {
        await tx.petInventory.create({
            data: {
                pet_id: pet.pet_id,
                category: category,
                item_name: itemName
            }
        });

        return await tx.pet.update({
            where: { member_id: memberId },
            data: {
                coin: { decrement: price },
                [category]: itemName
            },
            include: { PetInventory: true }
        });

    });

};
export const getMyPetWithInventory = async (memberId: number) => {
    let pet = await prisma.pet.findUnique({
        where: { member_id: memberId },
        include: { PetInventory: true }
    });

    if (!pet) {
        pet = await prisma.pet.create({
            data: { member_id: memberId },
            include: { PetInventory: true }
        });
    }

    const todayStr = getTodayDateStr(new Date());
    const lastSignInStr = pet.last_sign_in_date ? getTodayDateStr(pet.last_sign_in_date) : null;
    const is_signed_in_today = lastSignInStr === todayStr;

    return {
        ...pet,
        is_signed_in_today
    };
};

export const getPetCoin = async (memberId: number) => {
    let pet = await prisma.pet.findUnique({
        where: { member_id: memberId },
        select: { coin: true }
    });

    if (!pet) {
        pet = await prisma.pet.create({
            data: { member_id: memberId },
            select: { coin: true }
        });
    }

    return { coin: pet.coin };
};

/**
 * 輔助函式：取得台北時區 YYYY-MM-DD 日期字串
 */
function getTodayDateStr(date: Date = new Date()): string {
    const formatter = new Intl.DateTimeFormat('zh-TW', {
        timeZone: 'Asia/Taipei',
        year: 'numeric',
        month: '2-digit',
        day: '2-digit'
    });
    // formatted: "2026/08/20"
    return formatter.format(date).replace(/\//g, '-');
}

/**
 * 輔助函式：計算兩個 YYYY-MM-DD 字串相差天數 (date2 - date1)
 */
function getDayDiff(dateStr1: string, dateStr2: string): number {
    const d1 = new Date(`${dateStr1}T00:00:00+08:00`).getTime();
    const d2 = new Date(`${dateStr2}T00:00:00+08:00`).getTime();
    return Math.round((d2 - d1) / (1000 * 60 * 60 * 24));
}

/**
 * 每日簽到服務
 */
export const signInPetService = async (memberId: number) => {
    let pet = await prisma.pet.findUnique({
        where: { member_id: memberId }
    });

    if (!pet) {
        pet = await prisma.pet.create({
            data: { member_id: memberId }
        });
    }

    const now = new Date();
    const todayStr = getTodayDateStr(now);
    const lastSignInStr = pet.last_sign_in_date ? getTodayDateStr(pet.last_sign_in_date) : null;

    // 1. 檢查今日是否已簽到
    if (lastSignInStr === todayStr) {
        throw new Error("今天已經簽到過囉！明天再來領取獎勵吧～");
    }

    // 2. 計算連續簽到天數 (7天一週期循環)
    let newStreak = 1;
    if (lastSignInStr) {
        const diffDays = getDayDiff(lastSignInStr, todayStr);
        if (diffDays === 1) {
            // 昨天有簽到 -> 連續簽到 +1 (若滿 7 天則回歸第 1 天)
            newStreak = (pet.sign_in_streak % gameConfig.signIn.cycleDays) + 1;
        } else {
            // 斷簽 -> 重設為第 1 天
            newStreak = 1;
        }
    }

    // 3. 取得今日獎勵 (每滿 7 天即第 7、14 天為 200 金幣，其餘 100 金幣)
    const isBonus = newStreak % 7 === 0;
    const rewardConfig = gameConfig.signIn.rewards.find(r => r.day === newStreak) || {
        day: newStreak,
        coin: isBonus ? 200 : 100
    };

    // 4. 更新資料庫
    const updatedPet = await prisma.pet.update({
        where: { member_id: memberId },
        data: {
            coin: { increment: rewardConfig.coin },
            last_sign_in_date: now,
            sign_in_streak: newStreak,
            total_sign_in_days: { increment: 1 }
        },
        include: { PetInventory: true }
    });

    return {
        message: isBonus ? `🎉 恭喜達成第 ${newStreak} 天連續簽到！獲得大獎 200 金幣！` : `✨ 今日簽到成功！獲得 ${rewardConfig.coin} 金幣！`,
        rewardCoin: rewardConfig.coin,
        streak: newStreak,
        totalSignInDays: updatedPet.total_sign_in_days,
        isBonus,
        pet: updatedPet
    };
};

/**
 * 取得簽到狀態與 14 天獎勵預覽
 */
export const getSignInStatusService = async (memberId: number) => {
    let pet = await prisma.pet.findUnique({
        where: { member_id: memberId }
    });

    if (!pet) {
        pet = await prisma.pet.create({
            data: { member_id: memberId }
        });
    }

    const now = new Date();
    const todayStr = getTodayDateStr(now);
    const lastSignInStr = pet.last_sign_in_date ? getTodayDateStr(pet.last_sign_in_date) : null;
    const is_signed_in_today = lastSignInStr === todayStr;

    // 計算當前連續天數有效值
    let currentStreak = pet.sign_in_streak;
    if (lastSignInStr && !is_signed_in_today) {
        const diffDays = getDayDiff(lastSignInStr, todayStr);
        if (diffDays > 1) {
            // 已斷簽，下次簽到將為第 1 天
            currentStreak = 0;
        }
    }

    // 組裝 14 天簽到清單
    const schedule = gameConfig.signIn.rewards.map(item => {
        let status: 'COMPLETED' | 'AVAILABLE_TODAY' | 'UPCOMING' = 'UPCOMING';
        if (is_signed_in_today) {
            if (item.day <= currentStreak) status = 'COMPLETED';
        } else {
            if (item.day <= currentStreak) status = 'COMPLETED';
            else if (item.day === (currentStreak % gameConfig.signIn.cycleDays) + 1) status = 'AVAILABLE_TODAY';
        }

        return {
            day: item.day,
            coin: item.coin,
            status
        };
    });

    return {
        is_signed_in_today,
        current_streak: currentStreak,
        total_sign_in_days: pet.total_sign_in_days,
        last_sign_in_date: pet.last_sign_in_date,
        today_date: todayStr,
        schedule
    };
};
// 每日任務對應的欄位：做過互動的時間 (interactPet 會更新) 與領獎時間
const dailyTaskFields = {
    pet: { doneField: 'last_pet_time', claimField: 'last_pet_task_claim' },
    feed: { doneField: 'last_feed_time', claimField: 'last_feed_task_claim' },
    clean: { doneField: 'last_purify_time', claimField: 'last_clean_task_claim' }
} as const;

export type DailyTaskKey = keyof typeof dailyTaskFields;

/**
 * 取得今天三個每日任務的狀態 (是否完成、是否已領)
 */
export const getDailyTaskStatusService = async (memberId: number) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId } });
    if (!pet) {
        throw new Error("找不到該會員的寵物！");
    }

    const todayStr = getTodayDateStr();
    const tasks = Object.fromEntries(
        (Object.keys(dailyTaskFields) as DailyTaskKey[]).map(key => {
            const { doneField, claimField } = dailyTaskFields[key];
            const claimedAt = pet[claimField];
            return [key, {
                reward: gameConfig.dailyTasks[key].reward,
                done: getTodayDateStr(pet[doneField]) === todayStr,
                claimed: !!claimedAt && getTodayDateStr(claimedAt) === todayStr
            }];
        })
    );

    return { date: todayStr, tasks };
};

/**
 * 領取每日任務獎勵：今天要真的做過該互動，而且今天還沒領過
 */
export const claimDailyTaskService = async (memberId: number, task: DailyTaskKey) => {
    const { doneField, claimField } = dailyTaskFields[task];
    const reward = gameConfig.dailyTasks[task].reward;

    const pet = await prisma.pet.findUnique({ where: { member_id: memberId } });
    if (!pet) {
        throw new Error("找不到該會員的寵物！");
    }

    const now = new Date();
    const todayStr = getTodayDateStr(now);
    const todayStart = new Date(`${todayStr}T00:00:00+08:00`);

    // 任務完成與否以伺服器記錄的互動時間為準，前端的進度不算數
    if (getTodayDateStr(pet[doneField]) !== todayStr) {
        throw new Error("今天還沒完成這個任務喔！");
    }

    // 帶條件更新：只有今天還沒領過才會成功，同時送多個請求也只會領到一次
    const { count } = await prisma.pet.updateMany({
        where: {
            member_id: memberId,
            OR: [{ [claimField]: null }, { [claimField]: { lt: todayStart } }]
        },
        data: {
            coin: { increment: reward },
            [claimField]: now
        }
    });
    if (count === 0) {
        throw new Error("今天已經領過這個任務的獎勵囉！明天再來～");
    }

    const updatedPet = await prisma.pet.findUniqueOrThrow({ where: { member_id: memberId } });
    return {
        message: `🎉 領取成功！獲得 ${reward} 金幣！`,
        rewardCoin: reward,
        coin: updatedPet.coin
    };
};
