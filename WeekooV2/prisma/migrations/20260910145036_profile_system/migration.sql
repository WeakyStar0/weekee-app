/*
  Warnings:

  - The primary key for the `User` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `coins` on the `User` table. All the data in the column will be lost.
  - You are about to drop the column `id` on the `User` table. All the data in the column will be lost.
  - Added the required column `username` to the `User` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "User_discordId_key";

-- AlterTable
ALTER TABLE "User" DROP CONSTRAINT "User_pkey",
DROP COLUMN "coins",
DROP COLUMN "id",
ADD COLUMN     "armorId" TEXT,
ADD COLUMN     "baseDamage" INTEGER NOT NULL DEFAULT 10,
ADD COLUMN     "baseDefense" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "baseHp" INTEGER NOT NULL DEFAULT 100,
ADD COLUMN     "baseLuck" INTEGER NOT NULL DEFAULT 1,
ADD COLUMN     "baseMagicDamage" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "birthdayDay" INTEGER,
ADD COLUMN     "birthdayMonth" INTEGER,
ADD COLUMN     "description" TEXT NOT NULL DEFAULT 'No description set.',
ADD COLUMN     "dimensionId" TEXT,
ADD COLUMN     "lastEnergyReset" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
ADD COLUMN     "pickaxeId" TEXT,
ADD COLUMN     "trinketId" TEXT,
ADD COLUMN     "username" TEXT NOT NULL,
ADD COLUMN     "weaponId" TEXT,
ADD COLUMN     "weekoins" INTEGER NOT NULL DEFAULT 0,
ADD CONSTRAINT "User_pkey" PRIMARY KEY ("discordId");

-- CreateTable
CREATE TABLE "Item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '❔',
    "itemType" TEXT NOT NULL,
    "mainStatValue" INTEGER NOT NULL DEFAULT 0,
    "statModifierType" TEXT,
    "price" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Item_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "Inventory_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Dimension" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "emoji" TEXT NOT NULL DEFAULT '🌍',

    CONSTRAINT "Dimension_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Item_name_key" ON "Item"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_userId_itemId_key" ON "Inventory"("userId", "itemId");

-- CreateIndex
CREATE UNIQUE INDEX "Dimension_name_key" ON "Dimension"("name");

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_weaponId_fkey" FOREIGN KEY ("weaponId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_pickaxeId_fkey" FOREIGN KEY ("pickaxeId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_armorId_fkey" FOREIGN KEY ("armorId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_trinketId_fkey" FOREIGN KEY ("trinketId") REFERENCES "Item"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "User" ADD CONSTRAINT "User_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("discordId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Inventory" ADD CONSTRAINT "Inventory_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
