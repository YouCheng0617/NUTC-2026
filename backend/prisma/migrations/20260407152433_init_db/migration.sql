-- CreateTable
CREATE TABLE "Member" (
    "member_id" SERIAL NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "birthday" TIMESTAMP(3),
    "bio" TEXT,
    "blood_type" TEXT,
    "constellation" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Member_pkey" PRIMARY KEY ("member_id")
);

-- CreateTable
CREATE TABLE "Bottle" (
    "bottle_id" SERIAL NOT NULL,
    "member_id" INTEGER NOT NULL,
    "is_anonymous" BOOLEAN NOT NULL DEFAULT false,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "title" TEXT NOT NULL,
    "view_count" INTEGER NOT NULL DEFAULT 0,
    "status" INTEGER NOT NULL DEFAULT 0,
    "violation_reason" TEXT,

    CONSTRAINT "Bottle_pkey" PRIMARY KEY ("bottle_id")
);

-- CreateTable
CREATE TABLE "Category" (
    "category_id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,

    CONSTRAINT "Category_pkey" PRIMARY KEY ("category_id")
);

-- CreateTable
CREATE TABLE "BottleCategory" (
    "bottle_id" INTEGER NOT NULL,
    "category_id" INTEGER NOT NULL,

    CONSTRAINT "BottleCategory_pkey" PRIMARY KEY ("bottle_id","category_id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Member_email_key" ON "Member"("email");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- AddForeignKey
ALTER TABLE "Bottle" ADD CONSTRAINT "Bottle_member_id_fkey" FOREIGN KEY ("member_id") REFERENCES "Member"("member_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottleCategory" ADD CONSTRAINT "BottleCategory_bottle_id_fkey" FOREIGN KEY ("bottle_id") REFERENCES "Bottle"("bottle_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BottleCategory" ADD CONSTRAINT "BottleCategory_category_id_fkey" FOREIGN KEY ("category_id") REFERENCES "Category"("category_id") ON DELETE RESTRICT ON UPDATE CASCADE;
