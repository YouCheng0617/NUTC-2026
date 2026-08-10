import prisma from "../../lib/prisma.js";
import { createNotification } from "../notification/notification.service.js";
/*新增留言*/
export const createComment = async (bottleId: number, memberId: number, content: string, isAnonymous: boolean = false) => {
    // 防呆：確認瓶子存不存在，以及狀態是不是可以被留言的 (例如: 1 通過)
    const bottle = await prisma.bottle.findUnique({
        where: { bottle_id: bottleId }
    });

    if (!bottle) {
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

    return {
        ...newComment,
        member_name: newComment.is_anonymous ? "匿名使用者" : newComment.member?.name,
        member: undefined,
        likeCount: 0
    }
};

/*取得留言*/
export const getCommentsByBottleId = async (bottleId: number, memberId: number | undefined) => {
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

    // 🌟 4. 整理回傳格式
    return comments.map((comment: any) => ({
        ...comment,
        member_name: comment.is_anonymous ? "匿名使用者" : comment.member?.name,
        likeCount: comment._count?.likes ?? 0,
        isLiked: comment.likes ? comment.likes.length > 0 : false,
        _count: undefined,
        likes: undefined,
        member: undefined,

        replies: comment.replies?.map((reply: any) => ({
            ...reply,
            member_name: reply.is_anonymous ? "匿名使用者" : reply.member?.name,
            likeCount: reply._count?.likes ?? 0,
            isLiked: reply.likes ? reply.likes.length > 0 : false,
            _count: undefined,
            likes: undefined,
            member: undefined,
        })) || []
    }));
};

export const likeComment = async (commentId: number, memberId: number) => {
    const commentHad = await prisma.comment.findUnique({
        where: { id: commentId },
        select: {
            id: true,
            member_id: true,
            bottle_id: true,
        }
    });

    if (!commentHad) {
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


            const targetId = commentHad.bottle_id || commentId;

            await createNotification(
                commentHad.member_id,
                'COMMENT_LIKE',
                `${likerName} 按了你的留言讚！`,
                memberId,
                targetId
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

    if (!parentComment) {
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

    return {
        ...newReply,
        member_name: newReply.is_anonymous ? "匿名使用者" : newReply.member?.name,
        member: undefined,
        likeCount: 0
    };
};