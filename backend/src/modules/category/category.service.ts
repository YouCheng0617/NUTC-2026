import prisma from "../../lib/prisma.js";

export const createCategory = async (name: string) => {
    const trimmedName = name?.trim();
    if (!trimmedName) {
        throw new Error("CATEGORY_NAME_EMPTY");
    }

    const existingCategory = await prisma.category.findUnique({
        where: { name: trimmedName }
    });
    if (existingCategory) {
        throw new Error("CATEGORY_ALREADY_EXISTS");
    }

    const category = await prisma.category.create({
        data: {
            name: trimmedName
        }
    });
    return category;
};
