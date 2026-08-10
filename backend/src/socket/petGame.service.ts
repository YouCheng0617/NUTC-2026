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

    return pet;
};