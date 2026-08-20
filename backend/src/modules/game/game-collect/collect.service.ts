import prisma from "../../../lib/prisma.js";
import { createNotification } from "../../notification/notification.service.js";

export interface UnlockPieceResult {
    isNewPiece: boolean; // 是否為新抽到的碎片 (false 代表抽到重複的碎片)
    drawnPiece: number; // 本次抽到的碎片編號 (1~9)
    isCompleted: boolean; // 該拼圖是否已全數集齊 (9/9)
    isCompletedNow: boolean; // 是否在本次抽卡剛好完成整張拼圖
    picture: {
        id: number;
        title: string;
        description: string | null;
        image_url: string;
        total_pieces: number;
        rarity: "NORMAL" | "PREMIUM";
        category: string | null;
        task_requirement: string | null;
    };
    puzzleProgress: {
        unlocked_pieces: number[]; // 目前已擁有的碎片清單 (例如: [1, 3, 5, 8])
        piece_count: number; // 目前碎片數 (例如: 4)
        total_pieces: number; // 碎片總數 (9)
        progressRate: string; // 該張拼圖完成率 (例如: "44.4%")
    };
    inventory: {
        normal_fragments: number; // 當前普通碎片餘額
        premium_fragments: number; // 當前高級碎片餘額
        normal_chests: number; // 普通寶箱數
        premium_chests: number; // 高級寶箱數
    };
    stats: {
        completedPuzzles: number; // 已完整拼出的總圖鑑數
        totalPuzzles: number; // 全系統拼圖總數
        overallCompletionRate: string; // 整體拼圖完成百分比
    };
}

/**
 * 1. 隨機抽選/獲得拼圖碎片 (95% 普通, 5% 高級，並獲得 1~9 號碎片，每抽一張碎片相應碎片庫存+1)
 * @param memberId 會員 ID
 * @param obtainedFrom 來源說明 (例如: 'TASK', 'CHEST', 'DAILY_SIGNIN')
 * @param fixedRarity 指定稀有度 (開寶箱時使用)
 */
export async function unlockRandomPicturePieceService(
    memberId: number,
    obtainedFrom: string = "TASK",
    fixedRarity?: "NORMAL" | "PREMIUM"
): Promise<UnlockPieceResult> {
    const member = await prisma.member.findUnique({
        where: { member_id: memberId }
    });
    if (!member) {
        throw new Error("找不到此會員");
    }

    // 1. 稀有度判定：若有指定則使用指定稀有度，否則 95% 普通 / 5% 高級
    let targetRarity: "NORMAL" | "PREMIUM";
    if (fixedRarity) {
        targetRarity = fixedRarity;
    } else {
        const isPremium = Math.random() < 0.05;
        targetRarity = isPremium ? "PREMIUM" : "NORMAL";
    }

    // 搜尋目標稀有度的啟用中拼圖
    let pool = await prisma.picture.findMany({
        where: {
            is_active: true,
            rarity: targetRarity
        }
    });

    if (pool.length === 0) {
        pool = await prisma.picture.findMany({
            where: { is_active: true }
        });
    }

    if (pool.length === 0) {
        throw new Error("拼圖資料庫中目前沒有可解鎖的圖片，請稍後再試！");
    }

    // 2. 隨機抽選一張拼圖
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedPicture = pool[randomIndex];

    if (!selectedPicture) {
        throw new Error("抽選拼圖失敗，請稍後再試！");
    }

    // 3. 隨機抽選該拼圖的 1~9 其中一塊碎片
    const totalPieces = selectedPicture.total_pieces || 9;
    const drawnPiece = Math.floor(Math.random() * totalPieces) + 1; // 1 ~ 9

    // 4. 查詢使用者在該張拼圖的收集進度
    const existingRecord = await prisma.memberPicture.findUnique({
        where: {
            member_id_picture_id: {
                member_id: memberId,
                picture_id: selectedPicture.id
            }
        }
    });

    let isNewPiece = false;
    let isCompletedNow = false;
    let updatedPieces: number[] = [];

    if (!existingRecord) {
        isNewPiece = true;
        updatedPieces = [drawnPiece];
        const isCompleted = updatedPieces.length >= totalPieces;

        await prisma.memberPicture.create({
            data: {
                member_id: memberId,
                picture_id: selectedPicture.id,
                unlocked_pieces: updatedPieces,
                piece_count: 1,
                is_completed: isCompleted,
                completed_at: isCompleted ? new Date() : null,
                obtained_from: obtainedFrom
            }
        });

        if (isCompleted) {
            isCompletedNow = true;
        }
    } else {
        updatedPieces = [...existingRecord.unlocked_pieces];

        if (!updatedPieces.includes(drawnPiece)) {
            isNewPiece = true;
            updatedPieces.push(drawnPiece);
            updatedPieces.sort((a, b) => a - b);

            const isCompleted = updatedPieces.length >= totalPieces;
            if (isCompleted && !existingRecord.is_completed) {
                isCompletedNow = true;
            }

            await prisma.memberPicture.update({
                where: { id: existingRecord.id },
                data: {
                    unlocked_pieces: updatedPieces,
                    piece_count: updatedPieces.length,
                    is_completed: isCompleted,
                    completed_at: isCompleted && !existingRecord.is_completed ? new Date() : existingRecord.completed_at,
                    obtained_from: obtainedFrom
                }
            });
        } else {
            isNewPiece = false;
        }
    }

    // 5. 碎片庫存累計 (+1 個普通或高級碎片)
    const updatedMember = await prisma.member.update({
        where: { member_id: memberId },
        data: {
            normal_fragments: selectedPicture.rarity === "NORMAL" ? { increment: 1 } : undefined,
            premium_fragments: selectedPicture.rarity === "PREMIUM" ? { increment: 1 } : undefined
        },
        select: {
            normal_fragments: true,
            premium_fragments: true,
            normal_chests: true,
            premium_chests: true
        }
    });

    // 若剛好完成整張拼圖，發送系統恭賀通知
    if (isCompletedNow) {
        await createNotification(
            memberId,
            "SYSTEM",
            `🎉 恭喜你成功集齊【${selectedPicture.title}】的全部 9 片拼圖！已解鎖完整圖鑑！`
        ).catch((err) => console.error("發送拼圖完成通知失敗:", err));
    }

    // 6. 計算總體進度統計
    const totalPuzzles = await prisma.picture.count({ where: { is_active: true } });
    const completedPuzzles = await prisma.memberPicture.count({
        where: {
            member_id: memberId,
            is_completed: true,
            picture: { is_active: true }
        }
    });

    const overallRate = totalPuzzles > 0 ? ((completedPuzzles / totalPuzzles) * 100).toFixed(1) : "0.0";
    const singlePuzzleRate = ((updatedPieces.length / totalPieces) * 100).toFixed(1);

    return {
        isNewPiece,
        drawnPiece,
        isCompleted: updatedPieces.length >= totalPieces,
        isCompletedNow,
        picture: {
            id: selectedPicture.id,
            title: selectedPicture.title,
            description: selectedPicture.description,
            image_url: selectedPicture.image_url,
            total_pieces: totalPieces,
            rarity: selectedPicture.rarity as "NORMAL" | "PREMIUM",
            category: selectedPicture.category,
            task_requirement: selectedPicture.task_requirement
        },
        puzzleProgress: {
            unlocked_pieces: updatedPieces,
            piece_count: updatedPieces.length,
            total_pieces: totalPieces,
            progressRate: `${singlePuzzleRate}%`
        },
        inventory: updatedMember,
        stats: {
            completedPuzzles,
            totalPuzzles,
            overallCompletionRate: `${overallRate}%`
        }
    };
}

/**
 * 2. 碎片兌換寶箱服務
 * 規則：
 *  - 類型 1: 10 個普通碎片 換 1 個普通寶箱
 *  - 類型 2: 30 個普通碎片 換 1 個高級寶箱
 *  - 類型 3: 1 個高級碎片 換 10 個普通寶箱
 *  - 類型 4: 5 個高級碎片 換 1 個高級寶箱
 */
export async function exchangeChestService(
    memberId: number,
    exchangeType: 1 | 2 | 3 | 4,
    times: number = 1
) {
    if (times <= 0 || !Number.isInteger(times)) {
        throw new Error("兌換次數必須為大於 0 的整數");
    }

    const member = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: {
            normal_fragments: true,
            premium_fragments: true,
            normal_chests: true,
            premium_chests: true
        }
    });

    if (!member) {
        throw new Error("找不到此會員");
    }

    let costNormal = 0;
    let costPremium = 0;
    let gainNormalChest = 0;
    let gainPremiumChest = 0;
    let exchangeDesc = "";

    switch (exchangeType) {
        case 1: // 10 普通碎片 -> 1 普通寶箱
            costNormal = 10 * times;
            gainNormalChest = 1 * times;
            exchangeDesc = `消耗 ${costNormal} 個普通碎片，兌換 ${gainNormalChest} 個普通寶箱`;
            break;
        case 2: // 30 普通碎片 -> 1 高級寶箱
            costNormal = 30 * times;
            gainPremiumChest = 1 * times;
            exchangeDesc = `消耗 ${costNormal} 個普通碎片，兌換 ${gainPremiumChest} 個高級寶箱`;
            break;
        case 3: // 1 高級碎片 -> 10 普通寶箱
            costPremium = 1 * times;
            gainNormalChest = 10 * times;
            exchangeDesc = `消耗 ${costPremium} 個高級碎片，兌換 ${gainNormalChest} 個普通寶箱`;
            break;
        case 4: // 5 高級碎片 -> 1 高級寶箱
            costPremium = 5 * times;
            gainPremiumChest = 1 * times;
            exchangeDesc = `消耗 ${costPremium} 個高級碎片，兌換 ${gainPremiumChest} 個高級寶箱`;
            break;
        default:
            throw new Error("未知的兌換類型，請輸入 1, 2, 3 或 4");
    }

    // 檢查碎片餘額是否足夠
    if (costNormal > 0 && member.normal_fragments < costNormal) {
        throw new Error(`普通碎片不足！需要 ${costNormal} 個，目前僅有 ${member.normal_fragments} 個`);
    }
    if (costPremium > 0 && member.premium_fragments < costPremium) {
        throw new Error(`高級碎片不足！需要 ${costPremium} 個，目前僅有 ${member.premium_fragments} 個`);
    }

    // 扣除碎片並增加寶箱
    const updatedMember = await prisma.member.update({
        where: { member_id: memberId },
        data: {
            normal_fragments: costNormal > 0 ? { decrement: costNormal } : undefined,
            premium_fragments: costPremium > 0 ? { decrement: costPremium } : undefined,
            normal_chests: gainNormalChest > 0 ? { increment: gainNormalChest } : undefined,
            premium_chests: gainPremiumChest > 0 ? { increment: gainPremiumChest } : undefined
        },
        select: {
            normal_fragments: true,
            premium_fragments: true,
            normal_chests: true,
            premium_chests: true
        }
    });

    return {
        exchangeType,
        times,
        exchangeDesc,
        inventory: updatedMember
    };
}

/**
 * 3. 開啟寶箱服務 (普通寶箱開出普通拼圖碎片，高級寶箱開出高級拼圖碎片)
 * @param memberId 會員 ID
 * @param chestType 寶箱類型 ('NORMAL' | 'PREMIUM')
 * @param count 開啟數量 (預設 1 個)
 */
export async function openChestService(
    memberId: number,
    chestType: "NORMAL" | "PREMIUM",
    count: number = 1
) {
    if (count <= 0 || !Number.isInteger(count)) {
        throw new Error("開啟數量必須為大於 0 的整數");
    }
    if (count > 50) {
        throw new Error("單次最多開啟 50 個寶箱");
    }

    const member = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: {
            normal_chests: true,
            premium_chests: true
        }
    });
    if (!member) {
        throw new Error("找不到此會員");
    }

    if (chestType === "NORMAL" && member.normal_chests < count) {
        throw new Error(`普通寶箱數量不足！需要 ${count} 個，目前僅有 ${member.normal_chests} 個`);
    }
    if (chestType === "PREMIUM" && member.premium_chests < count) {
        throw new Error(`高級寶箱數量不足！需要 ${count} 個，目前僅有 ${member.premium_chests} 個`);
    }

    // 先扣除寶箱
    await prisma.member.update({
        where: { member_id: memberId },
        data: {
            normal_chests: chestType === "NORMAL" ? { decrement: count } : undefined,
            premium_chests: chestType === "PREMIUM" ? { decrement: count } : undefined
        }
    });

    // 依序抽取碎片 (必定開出對應稀有度)
    const results: UnlockPieceResult[] = [];
    for (let i = 0; i < count; i++) {
        const pieceResult = await unlockRandomPicturePieceService(
            memberId,
            `CHEST_${chestType}`,
            chestType
        );
        results.push(pieceResult);
    }

    // 取得最新庫存
    const latestInventory = await getUserInventoryService(memberId);

    return {
        chestType,
        count,
        results,
        inventory: latestInventory
    };
}

/**
 * 4. 取得使用者碎片與寶箱庫存
 */
export async function getUserInventoryService(memberId: number) {
    const member = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: {
            normal_fragments: true,
            premium_fragments: true,
            normal_chests: true,
            premium_chests: true
        }
    });
    if (!member) {
        throw new Error("找不到此會員");
    }
    return member;
}

/**
 * 5. 取得全圖拼圖圖鑑清單 (包含使用者每張拼圖的 1~9 碎片進度)
 */
export async function getAllGalleryService(memberId?: number, category?: string) {
    const whereCondition: any = { is_active: true };
    if (category) {
        whereCondition.category = category;
    }

    const pictures = await prisma.picture.findMany({
        where: whereCondition,
        orderBy: [
            { rarity: "asc" },
            { id: "asc" }
        ]
    });

    let userProgressMap = new Map<number, {
        unlocked_pieces: number[];
        piece_count: number;
        is_completed: boolean;
        completed_at: Date | null;
        obtained_from: string | null;
    }>();

    if (memberId) {
        const userPictures = await prisma.memberPicture.findMany({
            where: { member_id: memberId }
        });
        userPictures.forEach((record) => {
            userProgressMap.set(record.picture_id, {
                unlocked_pieces: record.unlocked_pieces,
                piece_count: record.piece_count,
                is_completed: record.is_completed,
                completed_at: record.completed_at,
                obtained_from: record.obtained_from
            });
        });
    }

    let normalCount = 0;
    let premiumCount = 0;
    let completedCount = 0;
    let inProgressCount = 0;

    const formattedPictures = pictures.map((pic) => {
        if (pic.rarity === "PREMIUM") premiumCount++;
        else normalCount++;

        const progress = userProgressMap.get(pic.id);
        const unlockedPieces = progress?.unlocked_pieces || [];
        const isCompleted = progress?.is_completed || false;
        const totalPieces = pic.total_pieces || 9;

        if (isCompleted) {
            completedCount++;
        } else if (unlockedPieces.length > 0) {
            inProgressCount++;
        }

        const singleRate = ((unlockedPieces.length / totalPieces) * 100).toFixed(1);

        return {
            id: pic.id,
            title: pic.title,
            description: pic.description,
            image_url: pic.image_url,
            total_pieces: totalPieces,
            rarity: pic.rarity,
            category: pic.category,
            task_requirement: pic.task_requirement,
            user_progress: {
                unlocked_pieces: unlockedPieces,
                piece_count: unlockedPieces.length,
                total_pieces: totalPieces,
                is_completed: isCompleted,
                progress_rate: `${singleRate}%`,
                completed_at: progress?.completed_at || null,
                obtained_from: progress?.obtained_from || null
            }
        };
    });

    const total = pictures.length;
    const overallRate = total > 0 ? ((completedCount / total) * 100).toFixed(1) : "0.0";

    return {
        stats: {
            total,
            normalCount,
            premiumCount,
            completedCount,
            inProgressCount,
            unstartedCount: total - completedCount - inProgressCount,
            completionRate: `${overallRate}%`
        },
        pictures: formattedPictures
    };
}

/**
 * 6. 取得特定使用者已收集的拼圖清單
 */
export async function getUserUnlockedPicturesService(
    memberId: number,
    status: "ALL" | "COMPLETED" | "IN_PROGRESS" = "ALL",
    rarity?: "NORMAL" | "PREMIUM",
    category?: string
) {
    const whereCondition: any = {
        member_id: memberId,
        picture: {
            is_active: true,
            ...(rarity ? { rarity } : {}),
            ...(category ? { category } : {})
        }
    };

    if (status === "COMPLETED") {
        whereCondition.is_completed = true;
    } else if (status === "IN_PROGRESS") {
        whereCondition.is_completed = false;
    }

    const records = await prisma.memberPicture.findMany({
        where: whereCondition,
        include: {
            picture: true
        },
        orderBy: [
            { is_completed: "desc" },
            { updated_at: "desc" }
        ]
    });

    const pictures = records.map((r) => {
        const totalPieces = r.picture.total_pieces || 9;
        const progressRate = ((r.unlocked_pieces.length / totalPieces) * 100).toFixed(1);

        return {
            id: r.picture.id,
            title: r.picture.title,
            description: r.picture.description,
            image_url: r.picture.image_url,
            rarity: r.picture.rarity,
            category: r.picture.category,
            task_requirement: r.picture.task_requirement,
            unlocked_pieces: r.unlocked_pieces,
            piece_count: r.piece_count,
            total_pieces: totalPieces,
            is_completed: r.is_completed,
            progress_rate: `${progressRate}%`,
            completed_at: r.completed_at,
            obtained_from: r.obtained_from,
            updated_at: r.updated_at
        };
    });

    return {
        total: pictures.length,
        completedCount: pictures.filter((p) => p.is_completed).length,
        inProgressCount: pictures.filter((p) => !p.is_completed).length,
        pictures
    };
}
