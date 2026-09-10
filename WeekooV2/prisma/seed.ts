import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  await prisma.item.upsert({
    where: { name: 'Stone Sword' },
    update: {},
    create: {
      name: 'Stone Sword',
      emoji: '🗡️',
      itemType: 'weapon',
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
      itemType: 'pickaxe',
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
      itemType: 'armor',
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
      itemType: 'material',
      price: 10,
      description: 'Raw ore, sells for a bit.',
      rarity: 'Common',
    },
  });

  await prisma.dimension.upsert({
    where: { name: 'Overworld' },
    update: {},
    create: { name: 'Overworld', emoji: '🌍' },
  });

  console.log('Seed complete: starter items + Iron Ore + Overworld dimension.');
}

main()
  .catch((error) => {
    console.error('Seed failed:', error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
