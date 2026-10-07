import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';
import { getTodayDateStr } from './petGame.service.js';

/*
 * 翻牌對決中途離開的處罰（按離開房間、或掛機／斷線沒回來被請出）
 * 次數每天（台北時間）歸零；第 N 次照 quitPenalties[N-1]，超過的都照最後一級。
 * 積分扣到 0 為止，禁玩期間不能開房、進房。
 */

const tiers = gameConfig.memoryGame.quitPenalties;

export const applyQuitPenalty = async (memberId: number) => {
    const today = getTodayDateStr();
    return prisma.$transaction(async (tx) => {
        const pet = await tx.pet.upsert({
            where: { member_id: memberId },
            update: {},
            create: { member_id: memberId },
        });

        const count = pet.memory_quit_date === today ? pet.memory_quit_count + 1 : 1;
        const tier = tiers[Math.min(count, tiers.length) - 1]!;
        const deducted = Math.min(Math.max(pet.coin, 0), tier.coin);
        const banUntil = new Date(Date.now() + tier.banMinutes * 60 * 1000);

        await tx.pet.update({
            where: { member_id: memberId },
            data: {
                coin: { decrement: deducted },
                memory_quit_count: count,
                memory_quit_date: today,
                room_ban_until: banUntil,
            },
        });

        return { count, deducted, banMinutes: tier.banMinutes, banUntil };
    });
};

/* 還要禁多久（分鐘，無條件進位）；沒有被禁回傳 0 */
export const getRoomBanMinutesLeft = async (memberId: number) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId }, select: { room_ban_until: true } });
    const ms = pet?.room_ban_until ? pet.room_ban_until.getTime() - Date.now() : 0;
    return ms > 0 ? Math.ceil(ms / 60000) : 0;
};
