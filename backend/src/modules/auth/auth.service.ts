import prisma from "../../lib/prisma.js";
import { signHelper } from "../../lib/signHelper.js";   /*星座計算的工具函式*/
import { hashPassword, comparePassword } from "../../lib/passWord.js"; /*密碼加密與比對的工具函式*/
import { generateToken } from "../../lib/LogIn.js"; /*JWT的工具函式*/
import { sendEmailResetPassword, sendEmailVerification } from "../../lib/mailer.js";
import { createNotification } from "../notification/notification.service.js";
const crypto = await import("crypto");

interface MemberData {
    email: string;
    password: string;
    name: string;
    birthday?: string;
    gender?: string;
    blood_type?: string;
    constellation?: string;
    bio?: string;
}

/*信箱格式檢查*/
const EMAIL_REGEX = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

/*建立信箱驗證憑證並寄出驗證信*/
const issueEmailVerification = async (email: string) => {
    const verifyToken = crypto.randomBytes(32).toString("hex");
    const verifyTokenExpiry = new Date(Date.now() + 30 * 60 * 1000); // 30分鐘後過期

    await prisma.$transaction([
        /*清除該信箱過去申請的驗證憑證*/
        prisma.emailVerification.deleteMany({
            where: { email: email }
        }),
        prisma.emailVerification.create({
            data: {
                email: email,
                token: verifyToken,
                expiresAt: verifyTokenExpiry,
            }
        })
    ]);

    const emailSent = await sendEmailVerification(email, verifyToken);
    if (!emailSent) {
        throw new Error("驗證信發送失敗，請確認信箱是否正確或稍後再試。");
    }

    return verifyToken;
};

/*註冊會員的服務函式*/
export const createMember = async (memberData: MemberData) => {
    /*信箱格式檢查，避免填入假信箱*/
    const email = (memberData.email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(email)) {
        throw new Error("信箱格式錯誤，請填寫可收信的真實電子信箱!");
    }
    memberData.email = email;

    /*檢查email有無重複*/
    const existMember = await prisma.member.findUnique({
        where: {
            email: memberData.email,
        }
    });
    /*如果有就丟出一個錯誤訊息 */
    if (existMember) {
        if (existMember.status === "INACTIVE") {
            throw new Error("此信箱已註冊但尚未驗證，請至信箱收取驗證信，或點選「重新發送驗證信」。");
        }
        throw new Error("此信箱已註冊!");
    }

    let birthday: Date | null = null;
    if (memberData.birthday) {
        birthday = new Date(memberData.birthday);
        if (isNaN(birthday.getTime())) {
            throw new Error("生日格式錯誤，請使用有效的日期格式!");
        } else {
            memberData.constellation = signHelper(birthday);
        }
    }

    /*將密碼加密橫後再傳入--重要!!*/
    const hashedPassword = await hashPassword(memberData.password);
    memberData.password = hashedPassword;

    /*寫入資料庫*/
    const newMember = await prisma.member.create({
        data: {
            email: memberData.email,
            password: memberData.password, /*已定義為加密過的*/
            name: memberData.name,
            birthday: memberData.birthday ? new Date(memberData.birthday) : null,
            gender: memberData.gender ?? "",
            blood_type: memberData.blood_type ?? "",
            constellation: memberData.constellation ?? "",
            bio: memberData.bio ?? "",
            status: "INACTIVE", /*尚未通過信箱驗證，一律為未啟用*/
        }, select: {
            member_id: true,
            email: true,
            name: true,
            birthday: true,
            gender: true,
            blood_type: true,
            constellation: true,
            bio: true,
        }
    });

    /*寄出驗證信，若寄送失敗就把剛建立的帳號收回，讓使用者可以重新註冊*/
    try {
        await issueEmailVerification(newMember.email);
    } catch (error) {
        await prisma.member.delete({
            where: { member_id: newMember.member_id }
        }).catch(err => console.error("回收未驗證帳號失敗:", err));
        throw error;
    }

    return newMember;
};

/*驗證信箱並啟用帳號的服務函式*/
export const verifyEmail = async (token: string) => {
    const verifyRecord = await prisma.emailVerification.findUnique({
        where: { token: token }
    });

    if (!verifyRecord) {
        throw new Error("無效的驗證連結，請重新發送驗證信。");
    }
    if (verifyRecord.expiresAt < new Date()) {
        await prisma.emailVerification.delete({ where: { token: token } });
        throw new Error("驗證連結已過期，請重新發送驗證信。");
    }

    const member = await prisma.member.findUnique({
        where: { email: verifyRecord.email }
    });
    if (!member) {
        throw new Error("找不到對應的會員資料，請重新註冊。");
    }
    if (member.status === "BANNED") {
        throw new Error("此帳號已被封鎖，無法啟用。若有疑問請聯繫客服。");
    }

    /*已經啟用過就直接清掉憑證，不重複發歡迎通知*/
    if (member.status === "ACTIVE") {
        await prisma.emailVerification.delete({ where: { token: token } });
        return { alreadyVerified: true, email: member.email };
    }

    await prisma.$transaction([
        prisma.member.update({
            where: { member_id: member.member_id },
            data: { status: "ACTIVE" }
        }),
        prisma.emailVerification.deleteMany({
            where: { email: verifyRecord.email }
        })
    ]);

    await createNotification(
        member.member_id,
        'SYSTEM',
        `歡迎來到瓶中信，${member.name}！快去投擲你的第一個漂流瓶吧！🌊`
        // actorId 預設為 undefined，代表系統
        // targetId 預設為 undefined
    ).catch(err => console.error("新手通知發送失敗:", err));

    return { alreadyVerified: false, email: member.email };
};

/*重新發送驗證信的服務函式*/
export const resendVerification = async (email: string) => {
    const normalizedEmail = (email ?? "").trim().toLowerCase();
    if (!EMAIL_REGEX.test(normalizedEmail)) {
        throw new Error("信箱格式錯誤，請填寫可收信的真實電子信箱!");
    }

    const member = await prisma.member.findUnique({
        where: { email: normalizedEmail }
    });

    /*查無帳號或已啟用都不透露狀態，避免被拿來探測會員信箱*/
    if (!member || member.status !== "INACTIVE") {
        return false;
    }

    /*同一個信箱 60 秒內只能重寄一次，避免被濫用狂發信*/
    const lastVerification = await prisma.emailVerification.findFirst({
        where: { email: normalizedEmail },
        orderBy: { createdAt: "desc" }
    });
    if (lastVerification && Date.now() - lastVerification.createdAt.getTime() < 60 * 1000) {
        throw new Error("驗證信剛剛才寄出，請稍候 1 分鐘再試。");
    }

    await issueEmailVerification(normalizedEmail);
    return true;
};


/*登入會員的服務函式*/
export const loginMember = async (email: string, password: string) => {
    /*註冊時信箱一律轉小寫，登入時不分大小寫比對*/
    const member = await prisma.member.findFirst({
        where: {
            email: { equals: (email ?? "").trim(), mode: "insensitive" },
        }
    });

    if (!member) {
        throw new Error("信箱或密碼錯誤!");
    }
    if (member.status === "BANNED") {
        throw new Error("此帳號已被封鎖，無法登入！若有疑問請聯繫客服。");
    }
    if (member.status === "INACTIVE") {
        throw new Error("帳號未啟用，請先完成信箱驗證手續。");
    }
    /*如果帳號被鎖定*/
    const nowDate = new Date();
    if (member.locked_time && member.locked_time > nowDate) {
        const diffMs = member.locked_time.getTime() - nowDate.getTime();
        const diffMinutes = Math.ceil(diffMs / (60 * 1000));
        throw new Error(`帳號暫時鎖定中，請 ${diffMinutes} 分鐘後再試。`);
    }

    /*比對密碼*/
    const isPasswordValid = await comparePassword(password, member.password);
    if (!isPasswordValid) {
        /*如果密碼錯誤，增加失敗次數*/
        const failedTimes = (member.logins_failed || 0) + 1;

        await prisma.member.update({
            where: { member_id: member.member_id },
            data: {
                logins_failed: failedTimes,
                locked_time: failedTimes >= 5 ? new Date(Date.now() + 20 * 60 * 1000) : null, // 5次失敗後鎖定20分鐘
            }
        });
        throw new Error(`帳號或密碼錯誤! 剩餘嘗試次數: ${Math.max(0, 5 - failedTimes)}`);
    }

    /*登入成功，重置失敗次數和鎖定時間*/
    await prisma.member.update({
        where: { member_id: member.member_id },
        data: {
            logins_failed: 0,
            locked_time: null,
        }
    });

    const token = generateToken(
        { member_id: member.member_id, email: member.email },
        process.env.JWT_SECRET_KEY!
    );
    const { password: _, ...memberWithoutPassword } = member;

    return {
        message: "登入成功!",
        member: memberWithoutPassword,
        token: token,
    };
};

/*忘記密碼驗證的服務函式*/
export const forgotPassword = async (email: string) => {
    const member = await prisma.member.findUnique({
        where: {
            email: email,
        }
    });
    if (!member) {
        return null;
    }

    const resetToken = crypto.randomBytes(32).toString("hex");
    const resetTokenExpiry = new Date(Date.now() + 20 * 60 * 1000); // 20分鐘後過期

    await prisma.$transaction([
        /*清除該過去申請的Token*/
        prisma.passwordReset.deleteMany({
            where: { email: email }
        }),
        prisma.passwordReset.create({
            data: {
                email: email,
                token: resetToken,
                expiresAt: resetTokenExpiry,
            }
        })
    ]);

    const emailSent = await sendEmailResetPassword(email.toLowerCase(), resetToken);
    if (!emailSent) {
        throw new Error("發送重設密碼郵件失敗，請稍後再試。");
    }

    // 回傳 token 讓 Controller 知道執行成功
    return resetToken;

};

/*重設密碼的服務函式*/
export const resetPassword = async (token: string, newPassword: string) => {
    const resetRecord = await prisma.passwordReset.findUnique({
        where: { token: token }
    });
    if (!resetRecord || resetRecord.expiresAt < new Date()) {
        throw new Error("無效的重設憑證，請重新申請重設。");
    }
    const hashedPassword = await hashPassword(newPassword);

    await prisma.$transaction([
        prisma.member.update({
            where: { email: resetRecord.email },
            data: {
                password: hashedPassword,
                logins_failed: 0,
                locked_time: null,
            }
        }),
        prisma.passwordReset.delete({
            where: { token: token }
        })
    ]);

    return true;
};

/*更改使用者自己資料*/
export const updateMember = async (memberId: number, updateData: Partial<MemberData>) => {
    const dataToUpdate: any = {};
    const updatedFields: string[] = [];
    if (updateData.name !== undefined) {
        dataToUpdate.name = updateData.name;
        updatedFields.push("姓名");
    }
    if (updateData.blood_type !== undefined) {
        dataToUpdate.blood_type = updateData.blood_type;
        updatedFields.push("血型");
    }
    if (updateData.gender !== undefined) {
        dataToUpdate.gender = updateData.gender || null;
        updatedFields.push("性別");
    }
    if (updateData.bio !== undefined) {
        dataToUpdate.bio = updateData.bio;
        updatedFields.push("個人簡介");
    }
    if (updateData.birthday !== undefined) {
        if (updateData.birthday === null || updateData.birthday === "") {
            dataToUpdate.birthday = null;
            dataToUpdate.constellation = "";
            updatedFields.push("生日與星座");
        } else {
            const birthday = new Date(updateData.birthday);
            if (isNaN(birthday.getTime())) {
                throw new Error("生日格式錯誤，請使用有效的日期格式!");
            } else {
                dataToUpdate.birthday = birthday;
                dataToUpdate.constellation = signHelper(birthday);
                updatedFields.push("生日與星座");
            }
        }
    }
    try {
        const updatedMember = await prisma.member.update({
            where: { member_id: memberId },
            data: dataToUpdate,
            select: {
                member_id: true,
                email: true,
                name: true,
                birthday: true,
                gender: true,
                blood_type: true,
                constellation: true,
                bio: true,
            }
        });

        const fieldsText = updatedFields.join("、");
        const notificationContent = `你的個人資料已成功更新（異動項目：${fieldsText}）。`;
        await createNotification(
            memberId,
            'SYSTEM',
            notificationContent
        ).catch(err => console.error("更新資料通知發送失敗:", err));

        return updatedMember;
    } catch (error: any) {
        if (error.code === "P2025") {
            throw new Error("找不到該會員，無法更新資料。");
        }
        throw error;
    }
};

/* 追蹤會員 */
export const followMember = async (followerId: number, followedId: number) => {

    if (followerId === followedId) {
        throw new Error("CANNOT_FOLLOW_SELF");
    }

    const targetMember = await prisma.member.findUnique({
        where: { member_id: followedId },
    })

    if (!targetMember) {
        throw new Error("TARGET_NOT_FOUND");
    }
    const follower = await prisma.member.findUnique({
        where: { member_id: followerId },
        select: { name: true }
    });

    const existingFollow = await prisma.follow.findFirst({
        where: {
            follower_id: followerId,
            following_id: followedId
        }
    });

    if (existingFollow) {
        await prisma.follow.deleteMany({
            where: {
                follower_id: followerId,
                following_id: followedId
            }
        });
        return { isFollowing: false, message: "已取消追蹤" }

    } else {
        await prisma.follow.create({
            data: {
                follower_id: followerId,
                following_id: followedId
            }
        });

        if (follower) {
            await createNotification(
                followedId,
                'NEW_FOLLOWER',
                `${follower.name} 開始追蹤你了！`,
                followerId,
                followerId
            ).catch(err => console.error("追蹤通知發送失敗:", err));
        }

        return { isFollowing: true, message: "追蹤成功" };
    }

};

/*抓取已追蹤名單*/
export const getFollowedMembers = async (memberId: number) => {
    const followingList = await prisma.follow.findMany({
        where: {
            follower_id: memberId
        },
        include: {
            following: {
                select: {
                    member_id: true,
                    name: true,
                    bio: true,
                }
            }
        },
        orderBy: { created_at: 'desc' }
    });

    return followingList.map(item => ({
        follow_time: item.created_at,
        ...item.following
    }));
};
/*抓取追蹤者名單*/
export const getFollowerList = async (memberId: number) => {
    const followerList = await prisma.follow.findMany({
        where: { following_id: memberId },
        include: {
            follower: { // 關聯出追蹤者的資料
                select: {
                    member_id: true,
                    name: true,
                    bio: true,
                }
            }
        },
        orderBy: { created_at: 'desc' }
    });

    return followerList.map(item => ({
        follow_time: item.created_at,
        ...item.follower
    }));
}