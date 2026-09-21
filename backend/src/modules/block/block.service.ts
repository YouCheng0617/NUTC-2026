import prisma from "../../lib/prisma.js";

/*
 * 封鎖功能
 * 封鎖是雙向的：我看不到對方的文章，對方也看不到我的文章。
 * 封鎖時不發送任何通知，被封鎖的人不會知道自己被封鎖。
 */

/*取得與某會員有封鎖關係的所有會員 ID（我封鎖的 + 封鎖我的），查文章時用來排除*/
export const getBlockedMemberIds = async (memberId?: number): Promise<number[]> => {
    if (!memberId) {
        return [];
    }

    const blocks = await prisma.block.findMany({
        where: {
            OR: [
                { blocker_id: memberId },
                { blocked_id: memberId }
            ]
        },
        select: { blocker_id: true, blocked_id: true }
    });

    const ids = blocks.map(b => b.blocker_id === memberId ? b.blocked_id : b.blocker_id);
    return [...new Set(ids)];
};

/*判斷兩個會員之間是否有封鎖關係（任一方封鎖對方都算）*/
export const isBlockedBetween = async (memberA: number, memberB: number) => {
    const block = await prisma.block.findFirst({
        where: {
            OR: [
                { blocker_id: memberA, blocked_id: memberB },
                { blocker_id: memberB, blocked_id: memberA }
            ]
        },
        select: { blocker_id: true }
    });
    return !!block;
};

/*封鎖會員*/
export const blockMember = async (blockerId: number, blockedId: number) => {
    if (blockerId === blockedId) {
        throw new Error("CANNOT_BLOCK_SELF");
    }

    const target = await prisma.member.findUnique({
        where: { member_id: blockedId },
        select: { member_id: true }
    });
    if (!target) {
        throw new Error("TARGET_NOT_FOUND");
    }

    // 封鎖的同時解除雙方的追蹤關係（不發通知）
    await prisma.$transaction([
        prisma.block.upsert({
            where: {
                blocker_id_blocked_id: {
                    blocker_id: blockerId,
                    blocked_id: blockedId
                }
            },
            update: {},
            create: {
                blocker_id: blockerId,
                blocked_id: blockedId
            }
        }),
        prisma.follow.deleteMany({
            where: {
                OR: [
                    { follower_id: blockerId, following_id: blockedId },
                    { follower_id: blockedId, following_id: blockerId }
                ]
            }
        })
    ]);

    return true;
};

/*解除封鎖*/
export const unblockMember = async (blockerId: number, blockedId: number) => {
    await prisma.block.deleteMany({
        where: {
            blocker_id: blockerId,
            blocked_id: blockedId
        }
    });
    return true;
};

/*取得我的封鎖名單（只列出我封鎖的人，不會列出封鎖我的人）*/
export const getMyBlockList = async (memberId: number) => {
    const blockList = await prisma.block.findMany({
        where: { blocker_id: memberId },
        include: {
            blocked: {
                select: {
                    member_id: true,
                    name: true,
                    bio: true,
                }
            }
        },
        orderBy: { created_at: 'desc' }
    });

    return blockList.map(item => ({
        block_time: item.created_at,
        ...item.blocked
    }));
};
