import prisma from "../../lib/prisma.js";

/*新增留言*/
export const createComment = async (bottleId: number, memberId: number, content: string) => {
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
            content: content
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
        likeCount: 0
    }
};

/*取得留言*/
export const getCommentsByBottleId = async (bottleId: number, memberId: number) => {
    const comments = await prisma.comment.findMany({
        where: {
            bottle_id: bottleId,
            parent_id: null
        },
        orderBy: { createdAt: 'asc' },
        include: {
            member: {
                select: {
                    name: true
                }
            },
            likes: memberId ? {
                where: {
                    member_id: memberId
                }
            } : false,
            _count: {
                select: { likes: true }
            },
            replies: {
                orderBy: { createdAt: 'asc' },
                include: {
                    member: { select: { name: true } },
                    _count: { select: { likes: true } },
                    likes: memberId ? { where: { member_id: memberId } } : false,
                }
            }
        }
    });

    return comments.map(comments => ({
        ...comments,
        likeCount: comments._count.likes,
        isLiked: comments.likes ? comments.likes.length > 0 : false,
        _count: undefined,
        likes: undefined,

        replies: comments.replies.map(reply => ({
            ...reply,
            likeCount: reply._count.likes,
            isLiked: reply.likes ? reply.likes.length > 0 : false,
            _count: undefined,
            likes: undefined,
        }))
    }))
};

export const likeComment = async (commentId: number, memberId: number) => {
    const commentHad = await prisma.comment.findUnique({
        where: { id: commentId },
    });

    if (!commentHad) {
        throw new Error("留言不存在");
    }

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
        return { isLiked: true, message: "已按讚" }
    }
};

export const createReply = async (bottleId: number, memberId: number, content: string, parentId: number) => {
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
            parent_id: parentId
        },
        include: {
            member: { select: { name: true } }
        }
    });

    return newReply;
};