import crypto from 'crypto';
import { Prisma } from '../generated/prisma/index.js';
import prisma from '../lib/prisma.js';
import { gameConfig } from './gameConfig.js';

/*
 * 寵物遊戲兌換碼
 * 後台建立：自訂積分＋任意組合的皮膚（pet_color，包含不在商店賣的小丑海兔）、背景（background_color）、特效（background_effects），
 * 可設到期時間、最多幾個人能用；每個帳號同一個碼只能兌換一次。
 */

export const REWARD_CATEGORIES = ['pet_color', 'background_color', 'background_effects'] as const;
type Category = typeof REWARD_CATEGORIES[number];
export interface RewardItem { category: Category; item: string }

const MAX_COIN = 1_000_000;
const CODE_PATTERN = /^[A-Z0-9_-]{4,20}$/;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // 拿掉容易看錯的 0/O、1/I

export const normalizeCode = (code: unknown) => (typeof code === 'string' ? code.trim().toUpperCase() : '');

export const generateCode = (length = 10) =>
    Array.from({ length }, () => CODE_ALPHABET[crypto.randomInt(CODE_ALPHABET.length)]).join('');

/* 商品必須是商店裡要花錢買的東西（經典雪兔、無特效這種一開始就有的免費項目不能拿來發）；
   小丑海兔是翻牌對決獎勵、商店沒賣，但後台可以用兌換碼送 */
const isValidItem = (x: any): x is RewardItem => {
    if (!x || !REWARD_CATEGORIES.includes(x.category) || typeof x.item !== 'string') return false;
    if (x.category === 'pet_color' && x.item === gameConfig.memoryGame.jokerSkin.itemName) return true;
    const prices = gameConfig.shop[x.category as Category] as Record<string, number>;
    return Object.prototype.hasOwnProperty.call(prices, x.item) && prices[x.item]! > 0;
};

export interface CreateCodeInput {
    code?: string; title?: string; coin?: number; items?: unknown;
    maxUses?: number | null; expiresAt?: string | null; createdBy: number;
}

/* 建立、修改共用的欄位檢查 */
const parseSettings = (input: Omit<CreateCodeInput, 'createdBy'>) => {
    const title = typeof input.title === 'string' ? input.title.trim().slice(0, 50) : '';
    if (!title) throw new Error('請輸入活動名稱');

    const coin = Number(input.coin ?? 0);
    if (!Number.isInteger(coin) || coin < 0 || coin > MAX_COIN) throw new Error(`積分要是 0 ~ ${MAX_COIN} 的整數`);

    const rawItems = Array.isArray(input.items) ? input.items : [];
    if (!rawItems.every(isValidItem)) throw new Error('有選到不存在的商品，請重新整理後再選一次');
    // 同一個商品選兩次只算一次
    const items = [...new Map(rawItems.map((x: RewardItem) => [`${x.category}:${x.item}`, { category: x.category, item: x.item }])).values()];
    if (coin === 0 && items.length === 0) throw new Error('至少要給積分或一樣道具');

    let maxUses: number | null = null;
    if (input.maxUses !== undefined && input.maxUses !== null && String(input.maxUses) !== '') {
        maxUses = Number(input.maxUses);
        if (!Number.isInteger(maxUses) || maxUses < 1) throw new Error('使用人數上限要是 1 以上的整數，不限人數請留空');
    }

    let expiresAt: Date | null = null;
    if (input.expiresAt) {
        expiresAt = new Date(input.expiresAt);
        if (isNaN(expiresAt.getTime())) throw new Error('到期時間格式錯誤');
        if (expiresAt.getTime() <= Date.now()) throw new Error('到期時間要在現在之後');
    }

    const custom = normalizeCode(input.code);
    if (custom && !CODE_PATTERN.test(custom)) throw new Error('兌換碼只能用英文、數字、- 或 _，長度 4 ~ 20');

    return { title, coin, items, maxUses, expiresAt, custom };
};

export const createRedeemCode = async (input: CreateCodeInput) => {
    const { title, coin, items, maxUses, expiresAt, custom } = parseSettings(input);

    // 沒指定就自動產生，撞號就重抽
    for (let attempt = 0; attempt < 5; attempt++) {
        const code = custom || generateCode();
        try {
            return await prisma.redeemCode.create({
                data: {
                    code, title, reward_coin: coin, reward_items: items as unknown as Prisma.InputJsonValue,
                    max_uses: maxUses, expires_at: expiresAt, created_by: input.createdBy,
                },
            });
        } catch (error) {
            if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
                if (custom) throw new Error('這個兌換碼已經有人用了，換一個吧');
                continue;
            }
            throw error;
        }
    }
    throw new Error('產生兌換碼失敗，請再試一次');
};

/*
 * 修改兌換碼設定
 * - 名稱、到期時間、獎勵隨時可改（已兌換的人不會補發或收回）
 * - 人數上限不能低於已兌換人數
 * - 兌換碼本身只有還沒人用過才能改，避免已經公布的碼失效
 */
export const updateRedeemCode = async (id: number, input: Omit<CreateCodeInput, 'createdBy'>) => {
    const existing = await prisma.redeemCode.findUnique({ where: { id } });
    if (!existing) throw new Error('找不到這個兌換碼');

    const { title, coin, items, maxUses, expiresAt, custom } = parseSettings(input);
    const code = custom || existing.code;
    const codeChanged = code !== existing.code;
    if (codeChanged && existing.used_count > 0) throw new Error('已經有人兌換過，兌換碼本身不能改（其他設定可以改）');
    if (maxUses !== null && maxUses < existing.used_count) {
        throw new Error(`已經有 ${existing.used_count} 人兌換，人數上限不能低於 ${existing.used_count}`);
    }

    try {
        // 條件更新：送出修改的同時如果剛好有人兌換，上限、改碼的檢查以資料庫當下的人數為準
        const result = await prisma.redeemCode.updateMany({
            where: {
                id,
                ...(codeChanged ? { used_count: 0 } : {}),
                ...(maxUses !== null ? { used_count: { lte: maxUses } } : {}),
            },
            data: {
                code, title, reward_coin: coin, reward_items: items as unknown as Prisma.InputJsonValue,
                max_uses: maxUses, expires_at: expiresAt,
            },
        });
        if (result.count === 0) throw new Error('剛好有人兌換，人數已經變了，請重新整理後再改一次');
    } catch (error) {
        if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
            throw new Error('這個兌換碼已經有人用了，換一個吧');
        }
        throw error;
    }
    return prisma.redeemCode.findUnique({ where: { id } });
};

/* 狀態給後台顯示：active / disabled / expired / used_up */
export const codeState = (c: { is_active: boolean; expires_at: Date | null; max_uses: number | null; used_count: number }) => {
    if (!c.is_active) return 'disabled';
    if (c.expires_at && c.expires_at.getTime() <= Date.now()) return 'expired';
    if (c.max_uses !== null && c.used_count >= c.max_uses) return 'used_up';
    return 'active';
};

export const listRedeemCodes = async () => {
    const codes = await prisma.redeemCode.findMany({ orderBy: { created_at: 'desc' } });
    return codes.map(c => ({ ...c, state: codeState(c) }));
};

export const setRedeemCodeActive = async (id: number, isActive: boolean) => {
    const row = await prisma.redeemCode.findUnique({ where: { id }, select: { id: true } });
    if (!row) throw new Error('找不到這個兌換碼');
    return prisma.redeemCode.update({ where: { id }, data: { is_active: isActive } });
};

/* 只有還沒人用過的碼可以刪除；用過的請改用停用，保留紀錄 */
export const deleteRedeemCode = async (id: number) => {
    const row = await prisma.redeemCode.findUnique({ where: { id }, select: { used_count: true } });
    if (!row) throw new Error('找不到這個兌換碼');
    if (row.used_count > 0) throw new Error('已經有人兌換過，不能刪除，請改用停用');
    await prisma.redeemCode.delete({ where: { id } });
};

export const listRedeemCodeUses = (id: number) =>
    prisma.redeemCodeUse.findMany({
        where: { code_id: id },
        orderBy: { created_at: 'desc' },
        include: { member: { select: { member_id: true, name: true, email: true } } },
    });

/* ---------- 玩家兌換 ---------- */

export const redeemCode = async (memberId: number, rawCode: unknown) => {
    const code = normalizeCode(rawCode);
    if (!code) throw new Error('請輸入兌換碼');

    return prisma.$transaction(async (tx) => {
        const row = await tx.redeemCode.findUnique({ where: { code } });
        // 不存在、停用都回同一句，避免被拿來試哪些碼存在
        if (!row || !row.is_active) throw new Error('兌換碼無效，請確認有沒有打錯');
        if (row.expires_at && row.expires_at.getTime() <= Date.now()) throw new Error('這個兌換碼已經過期了');

        const used = await tx.redeemCodeUse.findUnique({
            where: { code_id_member_id: { code_id: row.id, member_id: memberId } },
            select: { id: true },
        });
        if (used) throw new Error('你已經兌換過這個兌換碼了');

        // 名額用條件更新搶，避免最後一個名額被兩個人同時拿走
        const claimed = await tx.redeemCode.updateMany({
            where: {
                id: row.id,
                ...(row.max_uses !== null ? { used_count: { lt: row.max_uses } } : {}),
            },
            data: { used_count: { increment: 1 } },
        });
        if (claimed.count === 0) throw new Error('這個兌換碼的名額已經用完了');

        await tx.redeemCodeUse.create({ data: { code_id: row.id, member_id: memberId } });

        const pet = await tx.pet.upsert({
            where: { member_id: memberId },
            update: row.reward_coin > 0 ? { coin: { increment: row.reward_coin } } : {},
            create: { member_id: memberId, coin: row.reward_coin },
            include: { PetInventory: true },
        });

        const items = (Array.isArray(row.reward_items) ? row.reward_items : []) as unknown as RewardItem[];
        const owned = new Set(pet.PetInventory.map(i => `${i.category}:${i.item_name}`));
        const granted = items.map(x => ({ ...x, alreadyOwned: owned.has(`${x.category}:${x.item}`) }));
        const toAdd = granted.filter(x => !x.alreadyOwned);
        if (toAdd.length) {
            await tx.petInventory.createMany({
                data: toAdd.map(x => ({ pet_id: pet.pet_id, category: x.category, item_name: x.item })),
                skipDuplicates: true,
            });
        }

        return {
            title: row.title,
            coin: row.reward_coin,
            items: granted,
            totalCoin: pet.coin,
        };
    });
};
