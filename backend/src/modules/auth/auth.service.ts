import prisma from "../../lib/prisma.js";
import { signHelper } from "../../lib/signHelper.js";   /*星座計算的工具函式*/
import { hashPassword, comparePassword } from "../../lib/passWord.js"; /*密碼加密與比對的工具函式*/
import { generateToken } from "../../lib/LogIn.js"; /*JWT的工具函式*/


interface MemberData {
    email: string;
    password: string;
    name: string;
    birthday?: string;
    blood_type?: string;
    constellation?: string;
    bio?: string;
}

/*註冊會員的服務函式*/
export const createMember = async (memberData: MemberData) => {
    /*檢查email有無重複*/
    const existMember = await prisma.member.findUnique({
        where: {
            email: memberData.email,
        }
    });
    /*如果有就丟出一個錯誤訊息 */
    if (existMember) {
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
            blood_type: memberData.blood_type ?? "",
            constellation: memberData.constellation ?? "",
            bio: memberData.bio ?? "",
        }, select: {
            member_id: true,
            email: true,
            name: true, birthday: true,
            blood_type: true,
            constellation: true,
            bio: true,
        }
    })
    return newMember;
};


/*登入會員的服務函式*/
export const loginMember = async (email: string, password: string) => {
    const member = await prisma.member.findUnique({
        where: {
            email: email,
        }
    });

    if (!member) {
        throw new Error("信箱或密碼錯誤!");
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

    const token = generateToken({ id: member.member_id, email: member.email }, process.env.JWT_SECRET_KEY || "default_secret_key");
    const { password: _, ...memberWithoutPassword } = member;

    return {
        message: "登入成功!",
        member: memberWithoutPassword,
        token: token,
    };
}