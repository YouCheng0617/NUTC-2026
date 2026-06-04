import prisma from "../../lib/prisma.js";
import { PrismaClient } from "../../generated/prisma/index.js";
const prismaClient = new PrismaClient();
import dotenv from "dotenv";

export const getMybottles = async (memberId: number) => {
    const myBottles = await prismaClient.bottle.findMany({
        where: {
            member_id: memberId,
        },
        orderBy: {
            created_at: "desc",
        }
    });

    return myBottles;
}