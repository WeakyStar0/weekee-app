import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const ITEM_TYPES = ['weapon', 'pickaxe', 'armor', 'trinket', 'material', 'block', 'consumable'];

async function main() {
  for (const name of ITEM_TYPES) {
    await prisma.itemType.upsert({ where: { name }, update: {}, create: { name } });
  }

  await prisma.item.upsert({
    where: { name: 'Stone Sword' },
    update: {},
    create: {
      name: 'Stone Sword',
      emoji: '🗡️',
      itemType: { connect: { name: 'weapon' } },
      mainStatValue: 5,
      price: 50,
      description: 'A basic sword. Better than fists.',
      rarity: 'Common',
    },
  });

  await prisma.item.upsert({
    where: { name: 'Stone Pickaxe' },
    update: {},
    create: {
      name: 'Stone Pickaxe',
      emoji: '⛏️',
      itemType: { connect: { name: 'pickaxe' } },
      mainStatValue: 2,
      price: 50,
      description: 'Mines things. Slowly.',
      rarity: 'Common',
    },
  });

  await prisma.item.upsert({
    where: { name: 'Leather Vest' },
    update: {},
    create: {
      name: 'Leather Vest',
      emoji: '🦺',
      itemType: { connect: { name: 'armor' } },
      mainStatValue: 3,
      price: 50,
      description: 'Better than no vest.',
      rarity: 'Common',
    },
  });

  await prisma.item.upsert({
    where: { name: 'Iron Ore' },
    update: {},
    create: {
      name: 'Iron Ore',
      emoji: '🪨',
      itemType: { connect: { name: 'material' } },
      price: 10,
      description: 'Raw ore, sells for a bit.',
      rarity: 'Common',
    },
  });

  // Example of a drop-only material: exists, ownable, sellable — but never
  // buyable/browsable in the shop. Demonstrates the shopItem flag.
  await prisma.item.upsert({
    where: { name: 'Ancient Shard' },
    update: {},
    create: {
      name: 'Ancient Shard',
      emoji: '🔷',
      itemType: { connect: { name: 'material' } },
      price: 250,
      description: 'Found only on adventures. Cannot be bought.',
      rarity: 'Rare',
      shopItem: false,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Coal' },
    update: {},
    create: {
      name: 'Coal',
      emoji: '⚫',
      itemType: { connect: { name: 'material' } },
      price: 5,
      description: 'Common fuel ore.',
      rarity: 'Common',
    },
  });

  // Battle-only drops: a trophy material and a rare weapon upgrade. Neither
  // is buyable — only obtainable by beating the enemy that drops them.
  await prisma.item.upsert({
    where: { name: 'Slime Goo' },
    update: {},
    create: {
      name: 'Slime Goo',
      emoji: '🟢',
      itemType: { connect: { name: 'material' } },
      price: 15,
      description: 'Sticky residue left behind by a slime.',
      rarity: 'Common',
      shopItem: false,
    },
  });

  await prisma.item.upsert({
    where: { name: 'Slime Blade' },
    update: {},
    create: {
      name: 'Slime Blade',
      emoji: '🔪',
      itemType: { connect: { name: 'weapon' } },
      mainStatValue: 8,
      price: 120,
      description: 'A blade coated in slime residue. Surprisingly sharp.',
      rarity: 'Uncommon',
      shopItem: false,
    },
  });

  const overworld = await prisma.dimension.upsert({
    where: { name: 'Overworld' },
    update: {},
    create: { name: 'Overworld', emoji: '🌍', battleChance: 0.25 },
  });

  const ironOre = await prisma.item.findUniqueOrThrow({ where: { name: 'Iron Ore' } });
  const coal = await prisma.item.findUniqueOrThrow({ where: { name: 'Coal' } });
  await prisma.miningLoot.upsert({
    where: { dimensionId_itemId: { dimensionId: overworld.id, itemId: coal.id } },
    update: {},
    create: { dimensionId: overworld.id, itemId: coal.id, chance: 0.6, minQty: 1, maxQty: 3 },
  });
  await prisma.miningLoot.upsert({
    where: { dimensionId_itemId: { dimensionId: overworld.id, itemId: ironOre.id } },
    update: {},
    create: { dimensionId: overworld.id, itemId: ironOre.id, chance: 0.35, minQty: 1, maxQty: 2 },
  });

  const slime = await prisma.enemy.upsert({
    where: { name: 'Slime' },
    update: {},
    create: {
      name: 'Slime',
      hp: 30,
      damage: 5,
      defense: 0,
      xpDrop: 10,
      dimensionId: overworld.id,
    },
  });

  const slimeGoo = await prisma.item.findUniqueOrThrow({ where: { name: 'Slime Goo' } });
  const slimeBlade = await prisma.item.findUniqueOrThrow({ where: { name: 'Slime Blade' } });
  await prisma.enemyLoot.upsert({
    where: { enemyId_itemId: { enemyId: slime.id, itemId: slimeGoo.id } },
    update: {},
    create: { enemyId: slime.id, itemId: slimeGoo.id, chance: 0.8, minQty: 1, maxQty: 2 },
  });
  await prisma.enemyLoot.upsert({
    where: { enemyId_itemId: { enemyId: slime.id, itemId: slimeBlade.id } },
    update: {},
    create: { enemyId: slime.id, itemId: slimeBlade.id, chance: 0.05, minQty: 1, maxQty: 1 },
  });

  console.log('Seed complete: item types, starter items, mining loot, Slime enemy + loot table.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
