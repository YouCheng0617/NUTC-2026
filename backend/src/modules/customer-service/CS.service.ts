import prisma from "../../lib/prisma.js";
import { createNotification } from "../notification/notification.service.js";

// 1. 會員送出客服問題
export const createCustomerServiceTicket = async (memberId: number, title: string, message: string) => {
    const ticket = await prisma.customerService.create({
        data: {
            member_id: memberId,
            title: title.trim(),
            message: message.trim(),
            status: 0, // 0: 待處理
        }
    });

    // 🌟 客服問題成功送出時，通知該使用者
    await createNotification(
        memberId,
        "CUSTOMER_SERVICE",
        `📨 您的客服問題「${title.trim()}」已成功送出，客服人員將會盡快為您處理！`,
        undefined,
        ticket.id
    );

    return ticket;
};

// 2. 取得使用者自己的客服紀錄列表
export const getUserCustomerServiceTickets = async (memberId: number) => {
    return await prisma.customerService.findMany({
        where: { member_id: memberId },
        orderBy: { created_at: "desc" }
    });
};

// 3. 取得單一客服問題詳情
export const getCustomerServiceTicketById = async (ticketId: number, memberId?: number) => {
    const ticket = await prisma.customerService.findUnique({
        where: { id: ticketId },
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

    if (!ticket) return null;
    // 如果有指定 memberId，驗證是否為本人
    if (memberId !== undefined && ticket.member_id !== memberId) {
        return null;
    }

    return ticket;
};
