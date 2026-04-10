import prisma from "../../lib/prisma.js";
import { signHelper } from "../../lib/signHelper.js";

export const createMember = async (MemberData: any) => {
    /*檢查email有無重複*/
    const existMember = await prisma.member.findUnique({
        where: {
            email: MemberData.email,
        }
    });
    /*如果有就丟出一個錯誤訊息 */
    if (existMember) {
        throw new Error("此信箱已註冊!");
    }

    let birthday: Date | null = null;
    if (MemberData.birthday) {
        birthday = new Date(MemberData.birthday);
        if (isNaN(birthday.getTime())) {
            throw new Error("生日格式錯誤，請使用有效的日期格式!");
        } else {
            MemberData.constellation = signHelper(birthday);
        }
    }

    /*寫入資料庫*/
    const newMember = await prisma.member.create({
        data: {
            email: MemberData.email,
            password: MemberData.password,
            name: MemberData.name,
            birthday: MemberData.birthday ? new Date(MemberData.birthday) : null,
            blood_type: MemberData.blood_type,
            constellation: MemberData.constellation,
            bio: MemberData.bio,
        }
    })
    return newMember;
};