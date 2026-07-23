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
export const getCommentsByBottleId = async (bottleId: number) => {
    const comments = await prisma.comment.findMany({
        where: { bottle_id: bottleId },
        orderBy: { createdAt: 'asc' },
        include: {
            member: {
                select: {
                    name: true
                }
            },
            _count: {
                select: { likes: true }
            }
        }
    });

    return comments.map(comments => ({
        ...comments,
        likeCount: comments._count.likes,
        _count: undefined
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