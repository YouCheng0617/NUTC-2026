import prisma from "../../lib/prisma.js";
import { getBlockedMemberIds } from "../block/block.service.js";
import { assertVisible, followListsHidden, publicBottleWhere } from "../profile/profile.service.js";

/*
 * 別人的個人頁（瓶子詳情點作者名字進來的那一頁）
 * 可見性沿用 profile 模組：匿名瓶不列、停權／註銷當作找不到、封鎖丟 BLOCKED、隱藏名單丟 FOLLOW_LIST_HIDDEN
 */

/*一次最多回這麼多瓶，避免發文很多的人整包撈出來*/
const BOTTLES_LIMIT = 200;

export const getMemberProfile = async (targetId: number, viewerId: number) => {
    const member = await assertVisible(targetId, viewerId);
    const hidden = followListsHidden(member, viewerId);

    const [bottleCount, followerCount, followingCount] = await Promise.all([
        prisma.bottle.count({ where: publicBottleWhere(targetId) }),
        hidden ? null : prisma.follow.count({ where: { following_id: targetId, follower: { status: "ACTIVE" } } }),
        hidden ? null : prisma.follow.count({ where: { follower_id: targetId, following: { status: "ACTIVE" } } }),
    ]);

    /*只回這些欄位：email、生日、性別、電話都不給*/
    return {
        member_id: member.member_id,
        name: member.name,
        bio: member.bio ?? "",
        constellation: member.constellation ?? "",
        bottle_count: bottleCount,
        follower_count: followerCount,
        following_count: followingCount,
        hide_follow_lists: member.hide_follow_lists,
    };
};

/*格式跟 /bottles/random 的 bottles[] 一樣；這裡只有公開瓶，作者欄位不必再判斷匿名*/
export const getMemberBottles = async (targetId: number, viewerId: number) => {
    await assertVisible(targetId, viewerId);

    const bottles = await prisma.bottle.findMany({
        where: publicBottleWhere(targetId),
        orderBy: [{ created_at: "desc" }, { bottle_id: "desc" }],
        take: BOTTLES_LIMIT,
        include: {
            author: { select: { member_id: true, name: true, gender: true } },
            _count: { select: { likes: true, saves: true } },
            categories: { include: { category: true } },
            PollOption: { select: { id: true, text: true, _count: { select: { votes: true } } } },
            PollVote: { where: { member_id: viewerId }, select: { option_id: true } },
        },
    });

    return bottles.map(bottle => ({
        bottle_id: bottle.bottle_id,
        title: bottle.title,
        content: bottle.content,
        author_id: bottle.author.member_id,
        author_name: bottle.author.name,
        author_gender: bottle.author.gender ?? null,
        created_at: bottle.created_at,
        edited_at: bottle.edited_at,
        like_count: bottle._count.likes,
        save_count: bottle._count.saves,
        view_count: bottle.view_count,
        category_list: bottle.categories.map(c => c.category?.name || "未知類別"),
        poll_options: bottle.PollOption.map(opt => ({
            option_id: opt.id,
            text: opt.text,
            vote_count: opt._count.votes,
        })),
        user_voted_option_id: bottle.PollVote[0]?.option_id ?? null,
    }));
};

/*粉絲（followers）或追蹤中（following）名單，只回 member_id 和 name*/
export const getMemberFollowList = async (targetId: number, kind: "followers" | "following", viewerId: number) => {
    const target = await assertVisible(targetId, viewerId);
    if (followListsHidden(target, viewerId)) throw new Error("FOLLOW_LIST_HIDDEN");

    /*已註銷、停權的不列；跟看的人有封鎖關係的也不列*/
    const blocked = await getBlockedMemberIds(viewerId);
    const memberFilter = { status: "ACTIVE" as const, member_id: { notIn: blocked } };
    const select = { member_id: true, name: true };

    return kind === "followers"
        ? (await prisma.follow.findMany({
            where: { following_id: targetId, follower: memberFilter },
            select: { follower: { select } },
            orderBy: [{ created_at: "desc" }, { follower_id: "desc" }],
        })).map(f => f.follower)
        : (await prisma.follow.findMany({
            where: { follower_id: targetId, following: memberFilter },
            select: { following: { select } },
            orderBy: [{ created_at: "desc" }, { following_id: "desc" }],
        })).map(f => f.following);
};
