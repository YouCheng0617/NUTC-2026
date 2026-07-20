import prisma from "../../../lib/prisma.js";

const getTodayDate = (): string => {
    const now = new Date();

    const taiwanTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    return taiwanTime.toISOString().split("T")[0] as string;
}

export const createDailyNote = async (member_id: number, content: string) => {
    const today = getTodayDate();

    const existingNote = await prisma.daliyNote.findUnique({
        where: {
            member_id_date: {
                member_id: member_id,
                date: today
            }
        }
    })

    if (existingNote) {
        throw new Error("今天已經有寫便利貼了")
    }

    return await prisma.daliyNote.create({
        data: {
            member_id: member_id,
            content: content,
            date: today
        }
    });

}

export const getDailyNote = async () => {
    const today = getTodayDate();

    return await prisma.daliyNote.findMany({
        where: {
            date: today
        },
        orderBy: {
            created_at: "desc"
        },
        select: {
            id: true,
            content: true,
            created_at: true
        }
    });
}