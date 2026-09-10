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

  await prisma.dimension.upsert({
    where: { name: 'Overworld' },
    update: {},
    create: { name: 'Overworld', emoji: '🌍' },
  });

  console.log('Seed complete: item types + starter items + Iron Ore + Ancient Shard + Overworld dimension.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
