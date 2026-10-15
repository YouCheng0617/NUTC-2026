import prisma from "../../lib/prisma.js";
import { getBlockedMemberIds, isBlockedBetween } from "../block/block.service.js";

/*
 * 個人頁面：名字、自介、公開文章、粉絲與追蹤名單
 * - 只列公開文章：匿名、審核中、違規的都不列（不然等於把匿名作者公開了）
 * - 停權、未啟用、註銷中、已註銷的帳號一律當作找不到（NOT_FOUND）；跟看的人有封鎖關係的丟 BLOCKED
 * - 本人開了「隱藏我的追蹤與粉絲」時，別人看不到人數也拿不到名單（FOLLOW_LIST_HIDDEN）
 */

export const BOTTLES_PAGE_SIZE = 6;
export const MEMBERS_PAGE_SIZE = 6;

/*公開文章的條件*/
export const publicBottleWhere = (memberId: number) => ({
    member_id: memberId,
    is_anonymous: false,
    status: 1,
});

/*確認這個人可以被看；不行就丟 NOT_FOUND 或 BLOCKED*/
export const assertVisible = async (targetId: number, viewerId?: number) => {
    const member = await prisma.member.findUnique({
        where: { member_id: targetId },
        select: { member_id: true, name: true, bio: true, birthday: true, gender: true, constellation: true, created_at: true, status: true, hide_follow_lists: true },
    });
    if (!member || member.status !== "ACTIVE") throw new Error("NOT_FOUND");
    if (viewerId && viewerId !== targetId && await isBlockedBetween(viewerId, targetId)) {
        throw new Error("BLOCKED");
    }
    return member;
};

/*本人開了隱藏、而且看的人不是本人*/
export const followListsHidden = (member: { member_id: number; hide_follow_lists: boolean }, viewerId?: number) =>
    member.hide_follow_lists && viewerId !== member.member_id;

export const getProfile = async (targetId: number, viewerId?: number) => {
    const member = await assertVisible(targetId, viewerId);
    const isMe = viewerId === targetId;
    const hidden = followListsHidden(member, viewerId);

    const [bottleCount, followerCount, followingCount, viewerFollows, followsViewer] = await Promise.all([
        prisma.bottle.count({ where: publicBottleWhere(targetId) }),
        prisma.follow.count({ where: { following_id: targetId, follower: { status: "ACTIVE" } } }),
        prisma.follow.count({ where: { follower_id: targetId, following: { status: "ACTIVE" } } }),
        viewerId && !isMe
            ? prisma.follow.findFirst({ where: { follower_id: viewerId, following_id: targetId }, select: { follower_id: true } })
            : null,
        viewerId && !isMe
            ? prisma.follow.findFirst({ where: { follower_id: targetId, following_id: viewerId }, select: { follower_id: true } })
            : null,
    ]);

    /*自己看自己時多帶 Email 給編輯表單用，別人看不到*/
    const privateData = isMe
        ? await prisma.member.findUnique({ where: { member_id: targetId }, select: { email: true } })
        : null;

    return {
        member_id: member.member_id,
        name: member.name,
        bio: member.bio ?? "",
        /*隱私權政策：生日、性別、星座、自介會顯示在個人資料頁*/
        birthday: member.birthday,
        gender: member.gender ?? "",
        constellation: member.constellation ?? "",
        created_at: member.created_at,
        bottle_count: bottleCount,
        follower_count: hidden ? null : followerCount,
        following_count: hidden ? null : followingCount,
        hide_follow_lists: member.hide_follow_lists,
        is_me: isMe,
        is_following: !!viewerFollows,
        follows_me: !!followsViewer,
        ...(privateData ? { private: privateData } : {}),
    };
};

export const getProfileBottles = async (targetId: number, page: number, viewerId?: number) => {
    await assertVisible(targetId, viewerId);

    const [total, bottles] = await Promise.all([
        prisma.bottle.count({ where: publicBottleWhere(targetId) }),
        prisma.bottle.findMany({
            where: publicBottleWhere(targetId),
            orderBy: [{ created_at: "desc" }, { bottle_id: "desc" }], // 同一時間的用 id 排，換頁才不會重複或漏掉
            skip: (page - 1) * BOTTLES_PAGE_SIZE,
            take: BOTTLES_PAGE_SIZE,
            select: {
                bottle_id: true,
                title: true,
                content: true,
                created_at: true,
                categories: { select: { category: { select: { name: true } } } },
                _count: { select: { saves: true, Comment: { where: { is_deleted: false } } } },
            },
        }),
    ]);

    return {
        total,
        pageSize: BOTTLES_PAGE_SIZE,
        bottles: bottles.map(b => ({
            bottle_id: b.bottle_id,
            title: b.title,
            preview: b.content.replace(/\s+/g, " ").trim().slice(0, 120),
            created_at: b.created_at,
            save_count: b._count.saves,
            comment_count: b._count.Comment,
            category_list: b.categories.map(c => c.category?.name).filter(Boolean),
        })),
    };
};

/*粉絲（followers）或追蹤中（following）名單*/
export const getProfileMembers = async (
    targetId: number,
    kind: "followers" | "following",
    page: number,
    viewerId?: number,
) => {
    const target = await assertVisible(targetId, viewerId);
    if (followListsHidden(target, viewerId)) throw new Error("FOLLOW_LIST_HIDDEN");
    const hidden = viewerId ? await getBlockedMemberIds(viewerId) : [];

    const memberFilter = { status: "ACTIVE" as const, member_id: { notIn: hidden } };
    const memberSelect = { select: { member_id: true, name: true, bio: true } };
    const paging = {
        skip: (page - 1) * MEMBERS_PAGE_SIZE,
        take: MEMBERS_PAGE_SIZE,
    };

    /*粉絲名單取 follower 那一側，追蹤名單取 following 那一側*/
    const where = kind === "followers"
        ? { following_id: targetId, follower: memberFilter }
        : { follower_id: targetId, following: memberFilter };
    const [total, members] = await Promise.all([
        prisma.follow.count({ where }),
        kind === "followers"
            // 同一時間追蹤的用對方 id 排，換頁才不會重複或漏掉
            ? prisma.follow.findMany({ where, select: { follower: memberSelect }, orderBy: [{ created_at: "desc" }, { follower_id: "desc" }], ...paging }).then(r => r.map(f => f.follower))
            : prisma.follow.findMany({ where, select: { following: memberSelect }, orderBy: [{ created_at: "desc" }, { following_id: "desc" }], ...paging }).then(r => r.map(f => f.following)),
    ]);

    /*看的人有沒有追蹤名單裡的每個人，前端用來顯示追蹤按鈕*/
    const viewerFollowing = viewerId && members.length
        ? new Set((await prisma.follow.findMany({
            where: { follower_id: viewerId, following_id: { in: members.map(m => m.member_id) } },
            select: { following_id: true },
        })).map(f => f.following_id))
        : new Set<number>();

    return {
        total,
        pageSize: MEMBERS_PAGE_SIZE,
        members: members.map(m => ({
            member_id: m.member_id,
            name: m.name,
            bio: (m.bio ?? "").replace(/\s+/g, " ").trim().slice(0, 60),
            is_me: m.member_id === viewerId,
            is_following: viewerFollowing.has(m.member_id),
        })),
    };
};
