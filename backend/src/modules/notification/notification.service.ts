import prisma from '../../lib/prisma.js';

export const createNotification = async (
    memberId: number,     // 誰要收到通知
    type: string,         // 通知類型
    content: string,      // 顯示的文字
    actorId?: number,     // 誰觸發的 (可選)
    targetId?: number     // 導向的目標 ID (可選)
) => {
    // 防呆：自己發出的動作（例如自己按自己讚）不通知自己
    if (memberId === actorId) return null;

    return await prisma.notification.create({
        data: {
            member_id: memberId,
            actor_id: actorId ?? null,
            type: type,
            content: content,
            target_id: targetId ?? null
        }
    });
};

// 1. 取得使用者的通知列表 (最新排前面)
export const getUserNotifications = async (memberId: number) => {
    return await prisma.notification.findMany({
        where: { member_id: memberId },
        orderBy: { created_at: 'desc' },
        take: 30 // 每次抓最近 30 條，避免資料太大
    });
};

// 2. 標記單筆通知為已讀
export const markNotificationAsRead = async (notificationId: number, memberId: number) => {
    return await prisma.notification.updateMany({
        where: {
            id: notificationId,
            member_id: memberId // 防呆：只能改自己的通知
        },
        data: { is_read: true }
    });
};

// 3. 一鍵全部標記為已讀
export const markAllNotificationsAsRead = async (memberId: number) => {
    return await prisma.notification.updateMany({
        where: { member_id: memberId, is_read: false },
        data: { is_read: true }
    });
};