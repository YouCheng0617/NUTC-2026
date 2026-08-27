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
export const interactPet = async (memberId: number, actionType: 'FEED' | 'PURIFY' | 'PET') => {
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