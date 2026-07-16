import prisma from "../../../lib/prisma.js";

/*儲存最高遊戲紀錄*/
export const saveGameRecord = async (member_id: number, game_name: string, difficulty: string, score: number) => {
    const existingRecord = await prisma.gameRecord.findUnique({
        where: {
            member_id_game_name_difficulty: {
                member_id,
                game_name,
                difficulty
            }
        }
    });

    if (!existingRecord) {
        return await prisma.gameRecord.create({
            data: {
                member_id: member_id,
                game_name: game_name,
                difficulty: difficulty,
                high_score: score
            }
        });
    }

    const isNewHigher = score > existingRecord.high_score;

    return await prisma.gameRecord.update({
        where: { id: existingRecord.id },
        data: {
            high_score: isNewHigher ? score : existingRecord.high_score
        }
    });
}

/*取得會員的最高遊戲紀錄*/
export const getHighScore = async (member_id: number, game_name: string, difficulty: string) => {
    const record = await prisma.gameRecord.findUnique({
        where: {
            member_id_game_name_difficulty: {
                member_id,
                game_name,
                difficulty
            }
        },
        select: {
            high_score: true,
            last_played_at: true
        }
    });

    return record
};

/*取得會員的最高遊戲紀錄排行榜*/
export const getAllGameRecords = async (game_name: string, difficulty: string, limit: number = 10) => {
    const rankings = await prisma.gameRecord.findMany({
        where: {
            game_name: game_name,
            difficulty: difficulty
        },
        orderBy: {
            high_score: 'desc'
        },
        take: limit,
        include: {
            member: {
                select: {
                    name: true
                }
            }
        }
    });

    return rankings;
}