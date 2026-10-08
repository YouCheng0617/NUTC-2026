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
        jokerSkin: {
            unlocked: wins >= cfg.jokerSkin.winsRequired,
            itemName: cfg.jokerSkin.itemName,
            styles: cfg.jokerSkin.styles,
            selected: pet.memory_joker_style,
            switchable: await jokerStyleSwitchable(memberId),
        },
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

/* PUT /pet-games/memory-rewards/royal-outfit { outfit }：king / queen / none（前端用 "none" 表示不穿，null 也當不穿）
   資料庫存 "none" 而不是 null：null 留給「從沒選過」，前端才知道要不要把這台裝置以前的選擇補存上來 */
export const setRoyalOutfit = async (memberId: number, rawOutfit: unknown) => {
    const outfit = rawOutfit === null ? 'none' : rawOutfit;
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.royalOutfit.wins) throw new Error(`翻牌對決贏滿 ${R.royalOutfit.wins} 場才能穿上披風皇冠喔！`);
    if (!(typeof outfit === 'string' && (outfit === 'none' || (R.royalOutfit.options as readonly string[]).includes(outfit)))) {
        throw new Error('只能選國王裝或皇后裝');
    }
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_royal_outfit: outfit } });
    return getMemoryRewards(memberId);
};

/* 進連線房間時檢查玩家資料裡的服裝（前端 slug_game.js 的 getPlayerData 會夾帶 outfit）：
   沒贏滿 30 場、或不是 king / queen，就當作沒穿，避免自己改資料穿上國王裝給別人看 */
export const allowedOutfit = async (memberId: number, outfit: unknown): Promise<string | undefined> => {
    if (typeof outfit !== 'string' || !(R.royalOutfit.options as readonly string[]).includes(outfit)) return undefined;
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId }, select: { memory_wins: true } });
    return pet && pet.memory_wins >= R.royalOutfit.wins ? outfit : undefined;
};

/* 有沒有小丑海兔：背包裡有（勝場拿到或兌換碼送的）就算；
   勝場已經滿了但背包還沒有（例如滿 10 勝之後還沒再贏過），順便補發 */
export const ensureJokerSkin = async (memberId: number) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId }, select: { pet_id: true, memory_wins: true } });
    if (!pet) return false;
    const key = { pet_id: pet.pet_id, category: 'pet_color', item_name: cfg.jokerSkin.itemName };
    if (await prisma.petInventory.findUnique({ where: { pet_id_category_item_name: key } })) return true;
    if (pet.memory_wins < cfg.jokerSkin.winsRequired) return false;
    await prisma.petInventory.upsert({ where: { pet_id_category_item_name: key }, update: {}, create: key });
    return true;
};

/* 小丑海兔的配色只認 a～d，其他值當作沒帶（前端會用預設的 a） */
export const allowedJokerStyle = (style: unknown) =>
    typeof style === 'string' && (cfg.jokerSkin.styles as readonly string[]).includes(style) ? style : undefined;

/* 小丑配色能不能隨時換：用過任何一個「獎勵裡有小丑海兔皮膚」的兌換碼就能換（勝場、兌換碼都拿過也算）；
   只靠勝場拿到、或還沒有小丑海兔的，只能選一次 */
export const jokerStyleSwitchable = async (memberId: number) => {
    const uses = await prisma.redeemCodeUse.findMany({ where: { member_id: memberId }, select: { code: { select: { reward_items: true } } } });
    return uses.some(u => Array.isArray(u.code.reward_items) && (u.code.reward_items as any[]).some(
        x => x && x.category === 'pet_color' && x.item === cfg.jokerSkin.itemName,
    ));
};

/* 進連線房間時用的配色：配色已經鎖定（勝場拿到、選過了）就一律用帳號存的，不然用送來的 */
export const roomJokerStyle = async (memberId: number, style: unknown) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId }, select: { memory_joker_style: true } });
    if (pet?.memory_joker_style && !(await jokerStyleSwitchable(memberId))) return pet.memory_joker_style;
    return allowedJokerStyle(style);
};

/* PUT /pet-games/memory-rewards/joker-style { jokerStyle }：a 黑桃 / b 紅心 / c 方塊 / d 梅花
   背包裡有小丑海兔才能選（勝場拿到或兌換碼送的都算） */
export const setJokerStyle = async (memberId: number, rawStyle: unknown) => {
    const pet = await getPet(memberId);
    if (!(await ensureJokerSkin(memberId))) throw new Error(`翻牌對決贏滿 ${cfg.jokerSkin.winsRequired} 場才能拿到小丑海兔喔！`);
    const style = allowedJokerStyle(rawStyle);
    if (!style) throw new Error('小丑海兔只有黑桃、紅心、方塊、梅花四種配色');
    // 勝場拿到的只能選一次：選過了（不是 null）而且換成別的，就擋下來；第一次選照常存
    if (pet.memory_joker_style && pet.memory_joker_style !== style && !(await jokerStyleSwitchable(memberId))) {
        throw new Error('勝場拿到的小丑海兔配色不能再換喔');
    }
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_joker_style: style } });
    return getMemoryRewards(memberId);
};

/* POST /pet-games/memory-rewards/throne-seen：前端播完王座動畫後呼叫，下次就不會自動再播 */
export const markThroneSeen = async (memberId: number) => {
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.throneAnimation.wins) throw new Error(`翻牌對決贏滿 ${R.throneAnimation.wins} 場才會解鎖王座動畫`);
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_throne_seen: true } });
    return getMemoryRewards(memberId);
};
