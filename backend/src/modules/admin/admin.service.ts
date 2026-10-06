import prisma from "../../lib/prisma.js";
import { createNotification } from "../notification/notification.service.js";
import { deleteCSImages } from "../customer-service/CS.upload.js";
import { notifyReporters, resolvePendingReports, notifyBottleApproved } from "../bottle/bottle.service.js";

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
    const before = await prisma.member.findUnique({
        where: { member_id },
        select: { status: true }
    });
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

    // 🔔 停權期間登不進來，通知沒意義；只在恢復正常時通知
    if (newStatus === "ACTIVE" && before && before.status !== "ACTIVE") {
        await createNotification(
            member_id,
            'SYSTEM',
            '你的帳號已恢復正常，歡迎回到心情漂流瓶！'
        ).catch(err => console.error("帳號恢復通知發送失敗:", err));
    }

    return updatedMember;
};

// 變更會員權限 (升為管理員 / 取消管理員)
export const changeMemberRole = async (member_id: number, newRole: "USER" | "ADMIN") => {
    const member = await prisma.member.findUnique({
        where: { member_id },
        select: { member_id: true, role: true }
    });
    if (!member) {
        throw new Error("MEMBER_NOT_FOUND");
    }

    const updatedMember = await prisma.member.update({
        where: { member_id },
        data: { role: newRole },
        select: {
            member_id: true,
            email: true,
            name: true,
            role: true,
        }
    });

    // 🔔 權限真的有變才通知
    if (member.role !== newRole) {
        await createNotification(
            member_id,
            'SYSTEM',
            newRole === "ADMIN"
                ? '你已被設為管理員，可以使用後台管理功能了。'
                : '你的管理員權限已被取消。'
        ).catch(err => console.error("權限變更通知發送失敗:", err));
    }

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
    // 先記下原本的狀態，本來就是違規的瓶子再下架一次不要重複通知
    const before = await prisma.bottle.findUnique({
        where: { bottle_id },
        select: { status: true }
    });
    const updatedBottle = await prisma.bottle.update({
        where: { bottle_id },
        data: {
            status: newStatus,
            violation_reason: newStatus === 2 ? violationReason || null : null,
        }
    });
    if (newStatus === 2 && before?.status !== 2 && updatedBottle.member_id) {
        // 組合通知文案，如果有填寫違規原因就一併附上
        const reasonText = violationReason ? ` 原因：${violationReason}` : '請留意社群規範。';
        const message = `你的漂流瓶已被系統下架。${reasonText}`;

        await createNotification(
            updatedBottle.member_id,
            'SYSTEM_ALERT',
            message,
            undefined,
            bottle_id
        ).catch(err => console.error("下架通知發送失敗:", err));
    }

    // 🔔 檢舉成立，通知檢舉人
    if (newStatus === 2 && before?.status !== 2) {
        await resolvePendingReports(bottle_id).catch(err => console.error("檢舉結果處理失敗:", err));
    }

    // 🔔 審核通過或恢復上架，通知作者
    if (newStatus === 1) {
        await notifyBottleApproved(updatedBottle.member_id, bottle_id, before?.status, Boolean(updatedBottle.edited_at));
    }

    return updatedBottle;
};

export const deleteBottleByAdmin = async (bottle_id: number) => {
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottle_id }
    });
    if (!bottle) {
        throw new Error("BOTTLE_NOT_FOUND");
    }
    // 刪瓶子會連帶刪掉檢舉紀錄 (Cascade)，所以要先記下還在等結果的檢舉人
    const pendingReports = await prisma.bottleReport.findMany({
        where: { bottle_id: bottle_id, status: 0 },
        select: { member_id: true }
    });

    await prisma.bottle.delete({
        where: { bottle_id: bottle_id }
    });

    // 🔔 檢舉成立，通知檢舉人
    await notifyReporters(pendingReports.map(r => r.member_id), bottle_id);

    if (bottle.member_id) {
        await createNotification(
            bottle.member_id,
            'SYSTEM_ALERT',
            '你的漂流瓶因為違反社群規範，已被管理員強制刪除。',
            undefined,
            bottle_id // 讓前端點了會顯示「已被刪除」
        ).catch(err => console.error("強制刪除通知發送失敗:", err));
    }

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

export const getAllComments = async () => {
    const comments = await prisma.comment.findMany({
        orderBy: {
            createdAt: "desc"
        },
        include: {
            member: {
                select: {
                    name: true,
                    email: true,
                    gender: true,
                    status: true,
                }
            },
            bottle: {
                select: {
                    title: true,
                    status: true,
                }
            }
        }
    });

    return comments.map(comment => {
        const { member, bottle, ...commentData } = comment;
        return {
            ...commentData,
            member_name: member?.name || "匿名使用者",
            member_email: member?.email || "未知信箱",
            member_gender: member?.gender || "保密",
            member_status: member?.status || "ACTIVE",
            bottle_title: bottle?.title || "未知標題",
            bottle_status: bottle?.status || 0,
            is_anonymous: commentData?.is_anonymous || false
        };
    });
}

// ==========================================
// 客服管理 (Customer Service for Admin)
// ==========================================

// 1. 獲取全站客服問題列表 (管理員)
export const getAllCustomerServiceTickets = async (status?: number) => {
    const where: any = {};
    if (status !== undefined && !isNaN(status)) {
        where.status = status;
    }

    const tickets = await prisma.customerService.findMany({
        where,
        orderBy: {
            created_at: "desc"
        },
        include: {
            member: {
                select: {
                    member_id: true,
                    name: true,
                    email: true,
                    gender: true,
                    status: true,
                }
            }
        }
    });

    return tickets.map(ticket => {
        const { member, ...ticketData } = ticket;
        return {
            ...ticketData,
            member_name: member?.name || "未知會員",
            member_email: member?.email || "未知信箱",
            member_gender: member?.gender || "保密",
            member_status: member?.status || "ACTIVE",
        };
    });
};

// 2. 獲取單筆客服問題詳情 (管理員)
export const getCustomerServiceTicketForAdmin = async (id: number) => {
    const ticket = await prisma.customerService.findUnique({
        where: { id },
        include: {
            member: {
                select: {
                    member_id: true,
                    name: true,
                    email: true,
                    gender: true,
                    status: true,
                }
            }
        }
    });

    if (!ticket) return null;

    const { member, ...ticketData } = ticket;
    return {
        ...ticketData,
        member_name: member?.name || "未知會員",
        member_email: member?.email || "未知信箱",
        member_gender: member?.gender || "保密",
        member_status: member?.status || "ACTIVE",
    };
};

// 3. 管理員回覆客服問題 (並發送通知給使用者)
export const replyCustomerServiceTicket = async (ticketId: number, reply: string, status: number = 2) => {
    const updatedTicket = await prisma.customerService.update({
        where: { id: ticketId },
        data: {
            reply: reply.trim(),
            status: status, // 預設 2: 已回覆/結案
            updated_at: new Date()
        },
        include: {
            member: {
                select: {
                    member_id: true,
                    name: true,
                    email: true
                }
            }
        }
    });

    // 🌟 回覆時通知該使用者
    if (updatedTicket.member_id) {
        const preview = reply.trim().length > 35 ? reply.trim().substring(0, 35) + "..." : reply.trim();
        await createNotification(
            updatedTicket.member_id,
            "CUSTOMER_SERVICE_REPLY",
            `💬 管理員已回覆您的客服問題「${updatedTicket.title}」：${preview}`,
            undefined,
            updatedTicket.id
        );
    }

    return updatedTicket;
};

// 4. 管理員更新客服問題狀態
export const updateCustomerServiceStatus = async (ticketId: number, status: number) => {
    const before = await prisma.customerService.findUnique({
        where: { id: ticketId },
        select: { status: true }
    });
    const updatedTicket = await prisma.customerService.update({
        where: { id: ticketId },
        data: {
            status,
            updated_at: new Date()
        }
    });

    // 🔔 狀態真的有變才通知（改回待處理不通知）
    if (before && before.status !== status && (status === 1 || status === 2)) {
        await createNotification(
            updatedTicket.member_id,
            "CUSTOMER_SERVICE",
            status === 1
                ? `🛠️ 您的客服問題「${updatedTicket.title}」正在處理中，請耐心等候。`
                : `✅ 您的客服問題「${updatedTicket.title}」已結案。`,
            undefined,
            updatedTicket.id
        ).catch(err => console.error("客服狀態通知發送失敗:", err));
    }

    return updatedTicket;
};

// 5. 管理員刪除客服紀錄
export const deleteCustomerServiceTicket = async (ticketId: number) => {
    const deleted = await prisma.customerService.delete({
        where: { id: ticketId }
    });
    // 一併刪除該筆客服的附件圖片
    await deleteCSImages(deleted.images);
    return deleted;
};

