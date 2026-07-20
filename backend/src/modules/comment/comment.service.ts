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

    return newComment;
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
            }
        }
    });

    return comments;
};

export const likeComment = async (commentId: number, memberId: number) => {

};