import prisma from "../../lib/prisma.js";

export const getAllMembers = async () => {
    const members = await prisma.member.findMany({
        select: {
            member_id: true,
            email: true,
            name: true,
            role: true,
            status: true,
            created_at: true,
            _count: {
                select: {
                    bottles: true,
                    bottleLikes: true,
                    bottleSaves: true,
                }
            }
        },
        orderBy: {
            created_at: "desc",
        }
    });
    return members;
}

export const changeMemberStatus = async (member_id: number, newStatus: "ACTIVE" | "INACTIVE" | "BANNED") => {
    const updatedMember = await prisma.member.update({
        where: { member_id },
        data: { status: newStatus },
        select: {
            member_id: true,
            email: true,
            name: true,
            status: true,
        }
    });
    return updatedMember;
}

export const getAllBottlesForAdmin = async () => {
    const bottles = await prisma.bottle.findMany({
        orderBy: {
            created_at: "desc" // 最新的瓶子排前面
        },
        include: {
            // 🌟 完美對接你的 schema：關聯名稱叫做 author
            author: {
                select: {
                    name: true,
                    email: true,
                    status: true // 順便看這個發文者是不是被停權了
                }
            },
            // 📊 管理員福利：順便統計這篇文的互動數據
            _count: {
                select: {
                    likes: true,
                    saves: true,
                    Comment: true
                }
            }
        }
    });
    return bottles;
};

export const updateBottleStatus = async (bottle_id: number, newStatus: number, violationReason?: string) => {
    const updatedBottle = await prisma.bottle.update({
        where: { bottle_id },
        data: {
            status: newStatus,
            violation_reason: newStatus === 2 ? violationReason || null : null,
        }
    });
    return updatedBottle;
}