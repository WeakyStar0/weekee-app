-- AlterTable
ALTER TABLE "Dimension" ADD COLUMN     "battleChance" DOUBLE PRECISION NOT NULL DEFAULT 0.25;

-- AlterTable
ALTER TABLE "User" ADD COLUMN     "inAdventure" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "Enemy" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT NOT NULL DEFAULT '',
    "hp" INTEGER NOT NULL,
    "damage" INTEGER NOT NULL,
    "defense" INTEGER NOT NULL,
    "xpDrop" INTEGER NOT NULL DEFAULT 0,
    "dimensionId" TEXT NOT NULL,

    CONSTRAINT "Enemy_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EnemyLoot" (
    "id" TEXT NOT NULL,
    "enemyId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "chance" DOUBLE PRECISION NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "EnemyLoot_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MiningLoot" (
    "id" TEXT NOT NULL,
    "dimensionId" TEXT NOT NULL,
    "itemId" TEXT NOT NULL,
    "chance" DOUBLE PRECISION NOT NULL,
    "minQty" INTEGER NOT NULL DEFAULT 1,
    "maxQty" INTEGER NOT NULL DEFAULT 1,

    CONSTRAINT "MiningLoot_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Enemy_name_key" ON "Enemy"("name");

-- AddForeignKey
ALTER TABLE "Enemy" ADD CONSTRAINT "Enemy_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemyLoot" ADD CONSTRAINT "EnemyLoot_enemyId_fkey" FOREIGN KEY ("enemyId") REFERENCES "Enemy"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EnemyLoot" ADD CONSTRAINT "EnemyLoot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningLoot" ADD CONSTRAINT "MiningLoot_dimensionId_fkey" FOREIGN KEY ("dimensionId") REFERENCES "Dimension"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MiningLoot" ADD CONSTRAINT "MiningLoot_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "Item"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
