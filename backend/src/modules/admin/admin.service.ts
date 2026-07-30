import prisma from "../../lib/prisma.js";

export const getAllMembers = async () => {
    const members = await prisma.member.findMany({
        select: {
            member_id: true,
            email: true,
            name: true,
            gender: true,
            constellation: true,
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
};

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
};

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
                    status: true, // 順便看這個發文者是不是被停權了
                    gender: true,
                }
            },
            categories: {
                include: {
                    category: true
                }
            },
            _count: {
                select: {
                    likes: true,
                    saves: true,
                    Comment: true
                }
            }
        }
    });
    return bottles.map(bottles => {
        const { author, categories, _count, ...bottleData } = bottles;
        return {
            ...bottleData,
            member_name: author?.name || "匿名使用者",
            member_email: author?.email || "匿名使用者",
            member_gender: author?.gender || "保密",
            member_status: author?.status || "ACTIVE",
            categories: categories.map(c => c.category.name || "未知類別"),
            like_count: _count.likes,
            save_count: _count.saves,
            comment_count: _count.Comment
        }
    });
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
};

export const deleteBottleByAdmin = async (bottle_id: number) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottle_id }
    });
    if (!bottle) {
        throw new Error("BOTTLE_NOT_FOUND");
    }
    await prisma.bottle.delete({
        where: { bottle_id: bottle_id }
    });
    return true;
};

/*To 未來的me 記得要加上防呆功能，具體怎麼防呆你知道的*/
export const deleteMemberByAdmin = async (member_id: number) => {
    const member = await prisma.member.findUnique({
        where: { member_id: member_id }
    });

    if (!member) {
        throw new Error("MEMBER_NOT_FOUND");
    }

    await prisma.member.delete({
        where: { member_id: member_id }
    });
    return true;
};

export const getReportedBottles = async () => {
    const reportedBottles = await prisma.bottleReport.findMany({
        orderBy: [
            {
                bottle: {
                    status: "asc"
                }
            },
            { created_at: "desc" }
        ],
        include: {
            reporter: {
                select: {
                    name: true,
                    email: true
                }
            },
            bottle: {
                select: {
                    bottle_id: true,
                    title: true,
                    content: true,
                    status: true,
                    author: {
                        select: { name: true, email: true }
                    }
                }
            }
        }
    });

    return reportedBottles
}