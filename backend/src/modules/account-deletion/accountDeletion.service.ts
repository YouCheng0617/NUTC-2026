import crypto from "crypto";
import prisma from "../../lib/prisma.js";
import { comparePassword, hashPassword } from "../../lib/passWord.js";
import { sendEmailAccountDeletion, sendEmailDeletionScheduled, sendEmailAccountDeleted } from "../../lib/mailer.js";
import { deleteCSImages } from "../customer-service/CS.upload.js";
import { forgotPassword } from "../auth/auth.service.js";

/*
 * 註銷帳號流程
 * 1. 登入後輸入密碼申請 → 寄確認信（確認 / 這不是我），連結 24 小時有效
 * 2. 確認 → 帳號變成 PENDING_DELETION，所有裝置登出，7 天後悔期
 *    這不是我 → 取消申請、所有裝置登出、寄重設密碼信，申請 IP 留給後台查
 * 3. 後悔期內不能登入，只能點信裡的取消連結 → 回到 ACTIVE
 *    找不到信：用正確帳密登入時會重寄取消連結（有冷卻與次數上限）
 * 4. 排程每小時檢查，到期就清除個資；發過的瓶子與留言保留，作者改成「已註銷使用者」
 */

export const DELETION_STATUS = {
    WAITING_EMAIL: 0, // 等待信箱確認
    GRACE_PERIOD: 1, // 後悔期中
    CANCELLED: 2, // 本人取消
    NOT_ME: 3, // 不是本人申請
    DELETED: 4, // 已註銷
} as const;

const CONFIRM_LINK_TTL = 24 * 60 * 60 * 1000; // 確認信 24 小時有效
const GRACE_PERIOD = 7 * 24 * 60 * 60 * 1000; // 後悔期 7 天
const RESEND_COOLDOWN = 10 * 60 * 1000; // 取消連結 10 分鐘內只寄一封
const MAX_RESENDS = 5; // 整個後悔期最多重寄 5 次
export const DELETED_MEMBER_NAME = "已註銷使用者";

const newToken = () => crypto.randomBytes(32).toString("hex");

/*信箱只露出前兩個字，讓使用者知道信寄去哪*/
const maskEmail = (email: string) => {
    const [name, domain] = email.split("@");
    return `${(name ?? "").slice(0, 2)}***@${domain}`;
};

/*申請註銷：驗證密碼後寄確認信*/
export const requestDeletion = async (memberId: number, password: string, requestIp: string) => {
    const member = await prisma.member.findUnique({ where: { member_id: memberId } });
    if (!member || member.status !== "ACTIVE") {
        throw new Error("目前的帳號狀態無法申請註銷。");
    }
    if (!(await comparePassword(password, member.password))) {
        throw new Error("密碼錯誤，請重新輸入。");
    }

    const token = newToken();
    const request = await prisma.$transaction(async (tx) => {
        /*之前還沒確認的申請一律作廢，只留最新這一封信有效*/
        await tx.accountDeletionRequest.deleteMany({
            where: { member_id: memberId, status: DELETION_STATUS.WAITING_EMAIL }
        });
        return tx.accountDeletionRequest.create({
            data: {
                member_id: memberId,
                token,
                request_ip: requestIp,
                expires_at: new Date(Date.now() + CONFIRM_LINK_TTL),
            }
        });
    });

    const sent = await sendEmailAccountDeletion(member.email, token, requestIp).catch(() => false);
    if (!sent) {
        await prisma.accountDeletionRequest.delete({ where: { id: request.id } }).catch(() => { });
        throw new Error("確認信寄送失敗，請稍後再試。");
    }

    return { email: maskEmail(member.email) };
};

/*點信裡的「確認註銷」*/
export const confirmDeletion = async (token: string) => {
    const request = await prisma.accountDeletionRequest.findUnique({
        where: { token },
        include: { member: { select: { email: true, status: true } } },
    });
    if (!request || request.status !== DELETION_STATUS.WAITING_EMAIL) {
        throw new Error("連結已失效或已使用過。");
    }
    if (request.expires_at < new Date()) {
        throw new Error("確認連結已過期（24 小時），帳號不會被註銷。如仍要註銷請重新申請。");
    }
    if (request.member.status !== "ACTIVE") {
        throw new Error("目前的帳號狀態無法註銷，若有疑問請聯繫客服。");
    }

    const now = new Date();
    const scheduledAt = new Date(now.getTime() + GRACE_PERIOD);
    const cancelToken = newToken();

    await prisma.$transaction([
        prisma.accountDeletionRequest.update({
            where: { id: request.id },
            data: {
                status: DELETION_STATUS.GRACE_PERIOD,
                token: cancelToken, // 換成取消用的連結，原本的確認連結失效
                expires_at: scheduledAt,
                scheduled_at: scheduledAt,
                cancel_mail_sent_at: now,
            }
        }),
        prisma.member.update({
            where: { member_id: request.member_id },
            data: { status: "PENDING_DELETION", tokens_valid_after: now }, // 所有裝置登出
        }),
    ]);

    await sendEmailDeletionScheduled(request.member.email, cancelToken, scheduledAt)
        .catch(err => console.error("註銷排程通知寄送失敗:", err));

    return { scheduledAt };
};

/*點信裡的「這不是我」：取消申請、所有裝置登出、寄重設密碼信*/
export const denyDeletion = async (token: string) => {
    const request = await prisma.accountDeletionRequest.findUnique({
        where: { token },
        include: { member: { select: { email: true } } },
    });
    /*連結過期也照樣處理，帳號安全比較重要*/
    if (!request || request.status !== DELETION_STATUS.WAITING_EMAIL) {
        throw new Error("連結已失效或已使用過。");
    }

    await prisma.$transaction([
        prisma.accountDeletionRequest.update({
            where: { id: request.id },
            data: { status: DELETION_STATUS.NOT_ME, token: newToken() },
        }),
        prisma.member.update({
            where: { member_id: request.member_id },
            data: { tokens_valid_after: new Date() },
        }),
    ]);

    console.warn(`⚠️ [註銷申請] 會員 ${request.member_id} 回報非本人申請，申請 IP：${request.request_ip}`);

    let resetMailSent = true;
    try {
        await forgotPassword(request.member.email);
    } catch (err) {
        console.error("非本人註銷申請：重設密碼信寄送失敗:", err);
        resetMailSent = false;
    }
    return { resetMailSent };
};

/*把後悔期中的申請取消，帳號回到正常*/
const cancelGracePeriod = async (requestId: number, memberId: number) => {
    await prisma.$transaction([
        prisma.accountDeletionRequest.update({
            where: { id: requestId },
            data: { status: DELETION_STATUS.CANCELLED, token: newToken() },
        }),
        prisma.member.updateMany({
            where: { member_id: memberId, status: "PENDING_DELETION" },
            data: { status: "ACTIVE" },
        }),
    ]);
};

/*點信裡的「取消註銷」*/
export const cancelDeletionByLink = async (token: string) => {
    const request = await prisma.accountDeletionRequest.findUnique({ where: { token } });
    if (!request || request.status !== DELETION_STATUS.GRACE_PERIOD) {
        throw new Error("連結已失效，帳號可能已經取消註銷或已完成註銷。");
    }
    await cancelGracePeriod(request.id, request.member_id);
};

/*
 * 後悔期內用正確帳密登入時呼叫：重寄取消連結
 * 只有知道密碼的人才觸發得到，加上冷卻與次數上限，避免被拿來轟炸信箱
 */
export const resendCancelLink = async (memberId: number) => {
    const request = await prisma.accountDeletionRequest.findFirst({
        where: { member_id: memberId, status: DELETION_STATUS.GRACE_PERIOD },
        orderBy: { created_at: "desc" },
        include: { member: { select: { email: true } } },
    });
    if (!request?.scheduled_at) {
        return { scheduledAt: null, result: "NOT_FOUND" as const };
    }
    const scheduledAt = request.scheduled_at;

    const lastSent = request.cancel_mail_sent_at?.getTime() ?? 0;
    const waitMs = lastSent + RESEND_COOLDOWN - Date.now();
    if (waitMs > 0) {
        return { scheduledAt, result: "COOLDOWN" as const, waitMinutes: Math.ceil(waitMs / 60000) };
    }
    if (request.cancel_mail_resends >= MAX_RESENDS) {
        return { scheduledAt, result: "LIMIT" as const };
    }

    /*先記次數再寄，同時送出的兩個請求只會有一個搶到*/
    const claimed = await prisma.accountDeletionRequest.updateMany({
        where: { id: request.id, cancel_mail_resends: request.cancel_mail_resends, cancel_mail_sent_at: request.cancel_mail_sent_at },
        data: { cancel_mail_sent_at: new Date(), cancel_mail_resends: { increment: 1 } },
    });
    if (claimed.count === 0) {
        return { scheduledAt, result: "COOLDOWN" as const, waitMinutes: Math.ceil(RESEND_COOLDOWN / 60000) };
    }

    const sent = await sendEmailDeletionScheduled(request.member.email, request.token, scheduledAt).catch(() => false);
    return { scheduledAt, result: sent ? "SENT" as const : "SEND_FAILED" as const };
};

/*
 * 正式註銷：清除個資，保留發過的內容
 * 刪除：個人資料、寵物與道具、收藏、追蹤、封鎖、通知、便利貼、拼圖、塔羅、遊戲紀錄、客服單（含圖片）
 * 保留：漂流瓶、留言、按讚、投票、檢舉紀錄（作者改顯示「已註銷使用者」）
 */
const anonymizeMember = async (memberId: number, requestId: number) => {
    const member = await prisma.member.findUnique({
        where: { member_id: memberId },
        select: { email: true, status: true, CustomerService: { select: { images: true } } },
    });
    if (!member || member.status !== "PENDING_DELETION") return false;

    /*最後一封信要在清掉信箱前寄*/
    await sendEmailAccountDeleted(member.email);

    const unusablePassword = await hashPassword(newToken());
    const csImages = member.CustomerService.flatMap(cs => cs.images);
    const me = { member_id: memberId };

    await prisma.$transaction([
        prisma.blacklistedToken.deleteMany({ where: me }),
        prisma.bottleSave.deleteMany({ where: me }),
        prisma.follow.deleteMany({ where: { OR: [{ follower_id: memberId }, { following_id: memberId }] } }),
        prisma.block.deleteMany({ where: { OR: [{ blocker_id: memberId }, { blocked_id: memberId }] } }),
        prisma.gameBlock.deleteMany({ where: { OR: [{ blocker_id: memberId }, { blocked_id: memberId }] } }),
        /*別人收到的通知裡寫著這個人的名字，一起刪*/
        prisma.notification.deleteMany({ where: { OR: [{ member_id: memberId }, { actor_id: memberId }] } }),
        prisma.daliyNote.deleteMany({ where: me }),
        prisma.pet.deleteMany({ where: me }),
        prisma.memberPicture.deleteMany({ where: me }),
        prisma.puzzleTaskClaim.deleteMany({ where: me }),
        prisma.puzzleDrawRecord.deleteMany({ where: me }),
        prisma.tarotRecord.deleteMany({ where: me }),
        prisma.gameRecord.deleteMany({ where: me }),
        prisma.redeemCodeUse.deleteMany({ where: me }),
        prisma.customerService.deleteMany({ where: me }),
        prisma.emailVerification.deleteMany({ where: { email: member.email } }),
        prisma.passwordReset.deleteMany({ where: { email: member.email } }),
        /*IP 也算個資，註銷後一起清掉*/
        prisma.accountDeletionRequest.updateMany({ where: me, data: { request_ip: null } }),
        prisma.accountDeletionRequest.update({ where: { id: requestId }, data: { status: DELETION_STATUS.DELETED } }),
        prisma.member.update({
            where: me,
            data: {
                /*信箱換掉，原信箱之後可以重新註冊*/
                email: `deleted-${memberId}@deleted.invalid`,
                password: unusablePassword,
                name: DELETED_MEMBER_NAME,
                birthday: null,
                gender: null,
                phone: null,
                bio: "",
                blood_type: "",
                constellation: "",
                role: "USER",
                status: "DELETED",
                tokens_valid_after: new Date(),
                logins_failed: 0,
                locked_time: null,
                normal_fragments: 0,
                premium_fragments: 0,
                normal_chests: 0,
                premium_chests: 0,
                awaken_stones: 0,
                puzzle_last_sign_in_date: null,
                puzzle_sign_in_streak: 0,
                puzzle_total_sign_in_days: 0,
            }
        }),
    ]);

    await deleteCSImages(csImages);
    return true;
};

/*排程呼叫：處理後悔期已到的申請*/
export const executeDueDeletions = async () => {
    const due = await prisma.accountDeletionRequest.findMany({
        where: {
            status: DELETION_STATUS.GRACE_PERIOD,
            scheduled_at: { lte: new Date() },
            member: { status: "PENDING_DELETION" }, // 期間被管理員停權的不處理
        },
        select: { id: true, member_id: true },
    });

    let count = 0;
    for (const request of due) {
        try {
            if (await anonymizeMember(request.member_id, request.id)) count++;
        } catch (err) {
            console.error(`❌ 註銷會員 ${request.member_id} 失敗:`, err);
        }
    }
    return count;
};
