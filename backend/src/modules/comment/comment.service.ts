import prisma from "../../lib/prisma.js";
import { createNotification } from "../notification/notification.service.js";
import { getBlockedMemberIds, isBlockedBetween } from "../block/block.service.js";
import { isWithinEditWindow } from "../../lib/editWindow.js";
/*新增留言*/
export const createComment = async (bottleId: number, memberId: number, content: string, isAnonymous: boolean = false) => {
    // 防呆：確認瓶子存不存在，以及狀態是不是可以被留言的 (例如: 1 通過)
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId }
    });

    // 有封鎖關係時當作瓶子不存在，不讓對方知道被封鎖
    if (!bottle || await isBlockedBetween(memberId, bottle.member_id)) {
        throw new Error("瓶子不存在");
    }
    if (bottle.status !== 1) {
        throw new Error("瓶子狀態不允許留言");
    }

    const newComment = await prisma.comment.create({
        data: {
            bottle_id: bottleId,
            member_id: memberId,
            content: content,
            is_anonymous: isAnonymous
        },
        include: {
            member: {
                select: {
                    name: true
                }
            }
        }
    });

    // 🔔 通知瓶子作者有人留言（自己留在自己瓶子不通知；匿名留言時 actor 不帶，所以要自己擋）
    if (bottle.member_id && bottle.member_id !== memberId) {
        const commenterName = isAnonymous ? "有人" : (newComment.member?.name || "未知使用者");

        await createNotification(
            bottle.member_id,
            'COMMENT_REPLY',
            `${commenterName} 在你的漂流瓶留言了！`,
            isAnonymous ? undefined : memberId,
            bottleId
        ).catch(err => console.error("留言通知發送失敗:", err));
    }

    return {
        ...newComment,
        member_name: newComment.is_anonymous ? "匿名使用者" : newComment.member?.name,
        member: undefined,
        likeCount: 0
    }
};

/*取得留言*/
export const getCommentsByBottleId = async (bottleId: number, memberId: number | undefined) => {
    // 有封鎖關係的人的瓶子，留言一律不回傳
    if (memberId) {
        const bottle = await prisma.bottle.findUnique({
            where: { bottle_id: bottleId },
            select: { member_id: true }
        });
        if (bottle && await isBlockedBetween(memberId, bottle.member_id)) {
            return [];
        }
    }

    // 🌟 1. 動態組裝子回覆 (replies) 的 include 物件
    const replyInclude: any = {
        member: { select: { name: true } },
        _count: { select: { likes: true } }
    };
    if (memberId) {
        replyInclude.likes = { where: { member_id: memberId } };
    }

    // 🌟 2. 動態組裝主留言 (comments) 的 include 物件
    const commentInclude: any = {
        member: { select: { name: true } },
        _count: { select: { likes: true } },
        replies: {
            orderBy: { createdAt: 'asc' },
            include: replyInclude
        }
    };
    if (memberId) {
        commentInclude.likes = { where: { member_id: memberId } };
    }

    // 🌟 3. 執行查詢
    const comments = await prisma.comment.findMany({
        where: {
            bottle_id: bottleId,
            parent_id: null
        },
        orderBy: { createdAt: 'asc' },
        include: commentInclude
    });

    // 🌟 4. 有封鎖關係的人的留言與回覆也不回傳（匿名的也一樣，用真正的 member_id 判斷）
    const blockedIds = memberId ? await getBlockedMemberIds(memberId) : [];
    const visibleComments = blockedIds.length === 0
        ? comments
        : comments
            .filter((comment: any) => !blockedIds.includes(comment.member_id))
            .map((comment: any) => ({
                ...comment,
                replies: comment.replies?.filter((reply: any) => !blockedIds.includes(reply.member_id)) || []
            }));

    // 🌟 5. 被刪除的主留言：底下還有回覆才留個位置，沒有就整則拿掉
    const withoutEmptyDeleted = visibleComments.filter(
        (comment: any) => !comment.is_deleted || (comment.replies?.length ?? 0) > 0
    );

    // 🌟 6. 整理回傳格式
    //   is_mine：讓前端知道哪些是自己的（匿名留言不回傳 member_id，前端沒辦法自己判斷）
    return withoutEmptyDeleted.map((comment: any) => {
        if (comment.is_deleted) {
            return {
                id: comment.id,
                bottle_id: comment.bottle_id,
                parent_id: null,
                createdAt: comment.createdAt,
                is_deleted: true,
                is_anonymous: true,
                content: "",
                member_id: null,
                member_name: "已刪除的留言",
                is_mine: false,
                likeCount: 0,
                isLiked: false,
                replies: comment.replies.map((reply: any) => formatComment(reply, memberId))
            };
        }
        return {
            ...formatComment(comment, memberId),
            replies: comment.replies?.map((reply: any) => formatComment(reply, memberId)) || []
        };
    });
};

const formatComment = (comment: any, memberId: number | undefined) => ({
    ...comment,
    // 匿名留言不回傳留言者 ID，避免被反查身分
    member_id: comment.is_anonymous ? null : comment.member_id,
    member_name: comment.is_anonymous ? "匿名使用者" : comment.member?.name,
    is_mine: memberId !== undefined && comment.member_id === memberId,
    likeCount: comment._count?.likes ?? 0,
    isLiked: comment.likes ? comment.likes.length > 0 : false,
    _count: undefined,
    likes: undefined,
    member: undefined,
    replies: undefined,
});

/* 修改留言：只有本人、只在留言後 20 分鐘內 */
export const updateComment = async (commentId: number, memberId: number, content: string) => {
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { member_id: true, createdAt: true, is_deleted: true }
    });
    if (!comment || comment.is_deleted) {
        throw new Error("COMMENT_NOT_FOUND");
    }
    if (comment.member_id !== memberId) {
        throw new Error("FORBIDDEN_NOT_AUTHOR");
    }
    if (!isWithinEditWindow(comment.createdAt)) {
        throw new Error("EDIT_WINDOW_EXPIRED");
    }

    return await prisma.comment.update({
        where: { id: commentId },
        data: { content: content.trim(), edited_at: new Date() },
        select: { id: true, content: true, edited_at: true }
    });
};

/* 刪除留言：只有本人；主留言底下有回覆時只標記刪除，保留別人的回覆 */
export const deleteComment = async (commentId: number, memberId: number) => {
    const comment = await prisma.comment.findUnique({
        where: { id: commentId },
        select: { member_id: true, parent_id: true, is_deleted: true, _count: { select: { replies: true } } }
    });
    if (!comment || comment.is_deleted) {
        throw new Error("COMMENT_NOT_FOUND");
    }
    if (comment.member_id !== memberId) {
        throw new Error("FORBIDDEN_NOT_AUTHOR");
    }

    if (comment.parent_id === null && comment._count.replies > 0) {
        await prisma.$transaction([
            prisma.comment.update({
                where: { id: commentId },
                data: { is_deleted: true, content: "" }
            }),
            // 按讚紀錄一起清掉，避免之後還能按讚或發通知
            prisma.commentLike.deleteMany({ where: { comment_id: commentId } })
        ]);
        return { softDeleted: true };
    }

    await prisma.comment.delete({ where: { id: commentId } });
    return { softDeleted: false };
};

export const likeComment = async (commentId: number, memberId: number) => {
    const commentHad = await prisma.comment.findUnique({
        where: { id: commentId },
        select: {
            id: true,
            member_id: true,
            bottle_id: true,
            is_deleted: true,
        }
    });

    if (!commentHad || commentHad.is_deleted) {
        throw new Error("留言不存在");
    }

    const liker = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: { name: true }
    });

    const commentLiked = await prisma.commentLike.findUnique({
        where: {
            member_id_comment_id: {
                member_id: memberId,
                comment_id: commentId
            }
        }
    });

    if (commentLiked) {
        await prisma.commentLike.delete({
            where: { id: commentLiked.id }
        });
        return { isLiked: false, message: "已取消按讚" }
    } else {
        await prisma.commentLike.create({
            data: {
                member_id: memberId,
                comment_id: commentId
            }
        });

        if (commentHad.member_id) {
            const likerName = liker?.name || "未知使用者";


            // target_id 一律放瓶子 id，前端靠它跳到該篇貼文
            await createNotification(
                commentHad.member_id,
                'COMMENT_LIKE',
                `${likerName} 按了你的留言讚！`,
                memberId,
                commentHad.bottle_id,
                { dedupe: true }
            ).catch(err => console.error("留言按讚通知發送失敗:", err));
        }

        return { isLiked: true, message: "已按讚" }
    }
};

export const createReply = async (bottleId: number, memberId: number, content: string, parentId: number, isAnonymous: boolean = false) => {
    // 🛡️ 防呆 1：確認主留言是否存在
    const parentComment = await prisma.comment.findUnique({
        where: { id: parentId }
    });

    if (!parentComment || parentComment.is_deleted) {
        throw new Error("要回覆的留言不存在");
    }

    // 🛡️ 防呆 2：確認該留言確實屬於這個漂流瓶
    if (parentComment.bottle_id !== bottleId) {
        throw new Error("該留言不屬於此漂流瓶，無法回覆");
    }

    // 🛡️ 防呆 3：防止無限巢狀，限制只能回覆「主留言」
    if (parentComment.parent_id !== null) {
        throw new Error("只能回覆主留言，無法針對子留言進行回覆");
    }

    // 🛡️ 防呆 4：與瓶子作者有封鎖關係時，當作留言不存在
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId },
        select: { member_id: true }
    });
    if (!bottle || await isBlockedBetween(memberId, bottle.member_id)) {
        throw new Error("要回覆的留言不存在");
    }

    const newReply = await prisma.comment.create({
        data: {
            bottle_id: bottleId,
            member_id: memberId,
            content: content,
            parent_id: parentId,
            is_anonymous: isAnonymous
        },
        include: {
            member: { select: { name: true } }
        }
    });

    if (parentComment.member_id && parentComment.member_id !== memberId) {
        // 根據是否匿名決定文案
        const replierName = isAnonymous ? "有人" : (newReply.member?.name || "未知使用者");

        await createNotification(
            parentComment.member_id,
            'COMMENT_REPLY',
            `${replierName} 回覆了你的留言！`,
            isAnonymous ? undefined : memberId,
            bottleId
        ).catch(err => console.error("留言回覆通知發送失敗:", err));
    }

    // 🔔 瓶子作者也要知道底下有新回覆（作者就是被回覆的人或回覆者本人時不重複通知）
    if (bottle.member_id && bottle.member_id !== parentComment.member_id && bottle.member_id !== memberId) {
        const replierName = isAnonymous ? "有人" : (newReply.member?.name || "未知使用者");

        await createNotification(
            bottle.member_id,
            'COMMENT_REPLY',
            `${replierName} 在你的漂流瓶回覆了一則留言！`,
            isAnonymous ? undefined : memberId,
            bottleId
        ).catch(err => console.error("瓶子作者回覆通知發送失敗:", err));
    }

    return {
        ...newReply,
        member_name: newReply.is_anonymous ? "匿名使用者" : newReply.member?.name,
        member: undefined,
        likeCount: 0
    };
};