-- Both tables are empty at this point, so these constraints apply cleanly.
CREATE UNIQUE INDEX "EnemyLoot_enemyId_itemId_key" ON "EnemyLoot"("enemyId", "itemId");
CREATE UNIQUE INDEX "MiningLoot_dimensionId_itemId_key" ON "MiningLoot"("dimensionId", "itemId");
