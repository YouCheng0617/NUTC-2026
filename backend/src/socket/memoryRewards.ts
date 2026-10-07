import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';

/*
 * 翻牌對決的勝場獎勵
 *   3 勝  卡背自選箱：從清單挑一種卡背套用，隨時可換
 *   10 勝 小丑皮膚（在 memoryGame.ts 的 recordWin 放進寵物顏色收藏）
 *   30 勝 披風皇冠：國王裝或皇后裝擇一，隨時可換、也可以不穿
 *   100 勝 登上王座的神秘動畫：達成那場通知前端播放，之後可以重播
 * 是否解鎖一律看目前的勝場數，不另外存「已解鎖」；選了什麼存在 Pet 上
 */

const cfg = gameConfig.memoryGame;
const R = cfg.rewards;

/* 里程碑一覽（給前端畫進度條用），依勝場由少到多 */
export const MILESTONES = [
    { key: 'card_back_box', wins: R.cardBackBox.wins },
    { key: 'joker_skin', wins: cfg.jokerSkin.winsRequired },
    { key: 'royal_outfit', wins: R.royalOutfit.wins },
    { key: 'throne_animation', wins: R.throneAnimation.wins },
].sort((a, b) => a.wins - b.wins);

/* 這一場剛好跨過哪些里程碑（勝場從 before 變成 after） */
export const milestonesReached = (before: number, after: number) =>
    MILESTONES.filter(m => before < m.wins && after >= m.wins).map(m => m.key);

const getPet = async (memberId: number) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId } });
    return pet ?? prisma.pet.create({ data: { member_id: memberId } });
};

/* GET /pet-games/memory-rewards */
export const getMemoryRewards = async (memberId: number) => {
    const pet = await getPet(memberId);
    const wins = pet.memory_wins;
    const next = MILESTONES.find(m => wins < m.wins) ?? null;
    return {
        wins,
        milestones: MILESTONES.map(m => ({ ...m, unlocked: wins >= m.wins })),
        next: next && { ...next, remaining: next.wins - wins },
        cardBack: {
            unlocked: wins >= R.cardBackBox.wins,
            options: R.cardBackBox.options,
            selected: pet.memory_card_back,
        },
        jokerSkin: { unlocked: wins >= cfg.jokerSkin.winsRequired, itemName: cfg.jokerSkin.itemName },
        royalOutfit: {
            unlocked: wins >= R.royalOutfit.wins,
            options: R.royalOutfit.options,
            selected: pet.memory_royal_outfit,
        },
        throne: { unlocked: wins >= R.throneAnimation.wins, seen: pet.memory_throne_seen },
    };
};

/* PUT /pet-games/memory-rewards/card-back { cardBack }：null = 換回預設卡背 */
export const setCardBack = async (memberId: number, cardBack: unknown) => {
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.cardBackBox.wins) throw new Error(`翻牌對決贏滿 ${R.cardBackBox.wins} 場才能打開卡背自選箱喔！`);
    if (cardBack !== null && !(typeof cardBack === 'string' && (R.cardBackBox.options as readonly string[]).includes(cardBack))) {
        throw new Error('沒有這種卡背');
    }
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_card_back: cardBack as string | null } });
    return getMemoryRewards(memberId);
};

/* PUT /pet-games/memory-rewards/royal-outfit { outfit }：king / queen，null = 不穿 */
export const setRoyalOutfit = async (memberId: number, outfit: unknown) => {
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.royalOutfit.wins) throw new Error(`翻牌對決贏滿 ${R.royalOutfit.wins} 場才能穿上披風皇冠喔！`);
    if (outfit !== null && !(typeof outfit === 'string' && (R.royalOutfit.options as readonly string[]).includes(outfit))) {
        throw new Error('只能選國王裝或皇后裝');
    }
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_royal_outfit: outfit as string | null } });
    return getMemoryRewards(memberId);
};

/* POST /pet-games/memory-rewards/throne-seen：前端播完王座動畫後呼叫，下次就不會自動再播 */
export const markThroneSeen = async (memberId: number) => {
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.throneAnimation.wins) throw new Error(`翻牌對決贏滿 ${R.throneAnimation.wins} 場才會解鎖王座動畫`);
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_throne_seen: true } });
    return getMemoryRewards(memberId);
};
