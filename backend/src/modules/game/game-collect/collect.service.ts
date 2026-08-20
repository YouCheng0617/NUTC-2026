import prisma from "../../../lib/prisma.js";
import { createNotification } from "../../notification/notification.service.js";

export interface UnlockPictureResult {
    isNew: boolean;
    picture: {
        id: number;
        title: string;
        description: string | null;
        image_url: string;
        rarity: "NORMAL" | "PREMIUM";
        category: string | null;
        task_requirement: string | null;
    };
    stats: {
        totalCollected: number;
        totalPictures: number;
        collectionRate: string;
    };
}


export async function unlockRandomPictureService(
    memberId: number,
    obtainedFrom: string = "TASK"
): Promise<UnlockPictureResult> {
    // 檢查會員是否存在
    const member = await prisma.member.findUnique({
        where: { member_id: memberId }
    });
    if (!member) {
        throw new Error("找不到此會員");
    }

    // 抽卡機率判定：20% 稀有 (PREMIUM), 80% 普通 (NORMAL)
    const isPremium = Math.random() < 0.2;
    const targetRarity = isPremium ? "PREMIUM" : "NORMAL";

    // 搜尋目標稀有度的啟用中圖片
    let pool = await prisma.picture.findMany({
        where: {
            is_active: true,
            rarity: targetRarity
        }
    });

    // 若該池為空，回退撈取所有啟用中的圖片
    if (pool.length === 0) {
        pool = await prisma.picture.findMany({
            where: { is_active: true }
        });
    }

    if (pool.length === 0) {
        throw new Error("圖鑑資料庫中目前沒有可解鎖的圖片，請稍後再試！");
    }

    // 隨機抽選一張圖片
    const randomIndex = Math.floor(Math.random() * pool.length);
    const selectedPicture = pool[randomIndex];

    if (!selectedPicture) {
        throw new Error("抽選圖片失敗，請稍後再試！");
    }

    // 檢查使用者是否已經擁有該張圖片
    const existingRecord = await prisma.memberPicture.findUnique({
        where: {
            member_id_picture_id: {
                member_id: memberId,
                picture_id: selectedPicture.id
            }
        }
    });

    let isNew = false;
    if (!existingRecord) {
        // 尚未擁有 -> 寫入資料表解鎖
        await prisma.memberPicture.create({
            data: {
                member_id: memberId,
                picture_id: selectedPicture.id,
                obtained_from: obtainedFrom
            }
        });
        isNew = true;

        // 若抽到高級卡片，發送通知
        if (selectedPicture.rarity === "PREMIUM") {
            await createNotification(
                memberId,
                "SYSTEM",
                `恭喜你解鎖了高級圖鑑卡片【${selectedPicture.title}】！🌟`
            ).catch((err) => console.error("發送通知失敗:", err));
        }
    }

    // 計算最新收集進度
    const totalPictures = await prisma.picture.count({ where: { is_active: true } });
    const totalCollected = await prisma.memberPicture.count({
        where: {
            member_id: memberId,
            picture: { is_active: true }
        }
    });

    const rate = totalPictures > 0 ? ((totalCollected / totalPictures) * 100).toFixed(1) : "0.0";

    return {
        isNew,
        picture: {
            id: selectedPicture.id,
            title: selectedPicture.title,
            description: selectedPicture.description,
            image_url: selectedPicture.image_url,
            rarity: selectedPicture.rarity as "NORMAL" | "PREMIUM",
            category: selectedPicture.category,
            task_requirement: selectedPicture.task_requirement
        },
        stats: {
            totalCollected,
            totalPictures,
            collectionRate: `${rate}%`
        }
    };
}


export async function getAllGalleryService(memberId?: number, category?: string) {
    const whereCondition: any = { is_active: true };
    if (category) {
        whereCondition.category = category;
    }

    // 取得所有圖片 (高級排在後，依 ID 排序)
    const pictures = await prisma.picture.findMany({
        where: whereCondition,
        orderBy: [
            { rarity: "asc" },
            { id: "asc" }
        ]
    });

    // 若有登入，查詢使用者的已解鎖圖片清單
    let userUnlockedMap = new Map<number, { obtained_at: Date; obtained_from: string | null }>();
    if (memberId) {
        const userPictures = await prisma.memberPicture.findMany({
            where: { member_id: memberId }
        });
        userPictures.forEach((record) => {
            userUnlockedMap.set(record.picture_id, {
                obtained_at: record.obtained_at,
                obtained_from: record.obtained_from
            });
        });
    }

    // 統計各項數值
    let normalCount = 0;
    let premiumCount = 0;
    let unlockedCount = 0;

    const formattedPictures = pictures.map((pic) => {
        if (pic.rarity === "PREMIUM") premiumCount++;
        else normalCount++;

        const unlockInfo = userUnlockedMap.get(pic.id);
        const isUnlocked = !!unlockInfo;
        if (isUnlocked) unlockedCount++;

        return {
            id: pic.id,
            title: pic.title,
            description: pic.description,
            image_url: pic.image_url,
            rarity: pic.rarity,
            category: pic.category,
            task_requirement: pic.task_requirement,
            is_unlocked: isUnlocked,
            obtained_at: unlockInfo?.obtained_at || null,
            obtained_from: unlockInfo?.obtained_from || null
        };
    });

    const total = pictures.length;
    const rate = total > 0 ? ((unlockedCount / total) * 100).toFixed(1) : "0.0";

    return {
        stats: {
            total,
            normalCount,
            premiumCount,
            unlockedCount,
            lockedCount: total - unlockedCount,
            collectionRate: `${rate}%`
        },
        pictures: formattedPictures
    };
}


export async function getUserUnlockedPicturesService(
    memberId: number,
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

    const records = await prisma.memberPicture.findMany({
        where: whereCondition,
        include: {
            picture: true
        },
        orderBy: {
            obtained_at: "desc"
        }
    });

    const pictures = records.map((r) => ({
        id: r.picture.id,
        title: r.picture.title,
        description: r.picture.description,
        image_url: r.picture.image_url,
        rarity: r.picture.rarity,
        category: r.picture.category,
        task_requirement: r.picture.task_requirement,
        obtained_at: r.obtained_at,
        obtained_from: r.obtained_from
    }));

    return {
        total: pictures.length,
        pictures
    };
}
