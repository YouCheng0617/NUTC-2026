import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';

/*
 * 翻牌對決的勝場獎勵
 *   3 勝  卡背自選箱：從清單挑一種卡背套用，勝場拿到的只能選一次
 *   10 勝 小丑皮膚（在 memoryGame.ts 的 recordWin 放進寵物顏色收藏）
 *   30 勝 作者的塗鴉：13 張限定貼圖，沒滿 30 勝送不出去（petServer 的 send_message 檢查）
 *   100 勝 登上王座的神秘動畫：達成那場通知前端播放，之後可以重播
 * 是否解鎖一律看目前的勝場數，不另外存「已解鎖」；選了什麼存在 Pet 上
 */

const cfg = gameConfig.memoryGame;
const R = cfg.rewards;

/* 里程碑一覽（給前端畫進度條用），依勝場由少到多 */
export const MILESTONES = [
    { key: 'card_back_box', wins: R.cardBackBox.wins },
    { key: 'joker_skin', wins: cfg.jokerSkin.winsRequired },
    { key: 'doodle_stickers', wins: R.doodleStickers.wins },
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
            switchable: cardBackSwitchable(),
        },
        jokerSkin: {
            unlocked: wins >= cfg.jokerSkin.winsRequired,
            itemName: cfg.jokerSkin.itemName,
            styles: cfg.jokerSkin.styles,
            selected: pet.memory_joker_style,
            switchable: await jokerStyleSwitchable(memberId),
        },
        doodleStickers: { unlocked: wins >= R.doodleStickers.wins, count: R.doodleStickers.count },
        throne: { unlocked: wins >= R.throneAnimation.wins, seen: pet.memory_throne_seen },
    };
};

/* 卡背能不能隨時換：規則跟小丑配色一樣，兌換碼拿到的隨時能換、勝場拿到的只能選一次。
   目前兌換碼不送卡背，所以一律只能選一次（my-pet 回給前端的 card_back_switchable） */
export const cardBackSwitchable = () => false;

/* PUT /pet-games/memory-rewards/card-back { cardBack }：null = 預設卡背（classic）
   第一次選照常存；選過了（不是 null）就不能再換成別的 */
export const setCardBack = async (memberId: number, rawCardBack: unknown) => {
    const cardBack = rawCardBack ?? 'classic';
    const pet = await getPet(memberId);
    if (pet.memory_wins < R.cardBackBox.wins) throw new Error(`翻牌對決贏滿 ${R.cardBackBox.wins} 場才能打開卡背自選箱喔！`);
    if (!(typeof cardBack === 'string' && (R.cardBackBox.options as readonly string[]).includes(cardBack))) {
        throw new Error('沒有這種卡背');
    }
    if (pet.memory_card_back && pet.memory_card_back !== cardBack && !cardBackSwitchable()) {
        throw new Error('勝場拿到的卡背不能再換喔');
    }
    await prisma.pet.update({ where: { member_id: memberId }, data: { memory_card_back: cardBack } });
    return getMemoryRewards(memberId);
};

/* 30 勝的塗鴉貼圖：聊天代碼是 [[sticker:doodle1]]～[[sticker:doodle13]]，回傳是不是塗鴉貼圖 */
const DOODLE_STICKER_RE = /^\[\[sticker:doodle\d+\]\]$/;
export const isDoodleSticker = (message: string) => DOODLE_STICKER_RE.test(message);

/* 送塗鴉貼圖前檢查：只有送塗鴉時才查資料庫，所以每次都是最新的勝場 */
export const canSendDoodle = async (memberId: number) => {
    const pet = await prisma.pet.findUnique({ where: { member_id: memberId }, select: { memory_wins: true } });
    return !!pet && pet.memory_wins >= R.doodleStickers.wins;
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
