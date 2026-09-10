import { prisma } from './prisma';
import type { User } from '@prisma/client';

const STARTER_ITEM_NAMES = ['Stone Sword', 'Stone Pickaxe', 'Leather Vest'];
const DEFAULT_DIMENSION_NAME = 'Overworld';

/**
 * Ensures a user row exists. Brand-new users get the starter kit (if the
 * starter items exist in the DB — seed them via `prisma/seed.ts`) and are
 * placed in the default dimension (needed for /adventure to know which
 * enemies/loot tables apply).
 */
export async function ensureUserExists(discordId: string, username: string): Promise<User> {
  const existing = await prisma.user.findUnique({ where: { discordId } });
  if (existing) return existing;

  const defaultDimension = await prisma.dimension.findUnique({ where: { name: DEFAULT_DIMENSION_NAME } });

  const user = await prisma.user.create({
    data: { discordId, username, dimensionId: defaultDimension?.id },
  });

  try {
    const starters = await prisma.item.findMany({
      where: { name: { in: STARTER_ITEM_NAMES } },
      include: { itemType: true },
    });

    if (starters.length === 0) return user;

    let weaponId: string | null = null;
    let pickaxeId: string | null = null;
    let armorId: string | null = null;

    for (const item of starters) {
      await prisma.inventory.upsert({
        where: { userId_itemId: { userId: discordId, itemId: item.id } },
        update: { quantity: { increment: 1 } },
        create: { userId: discordId, itemId: item.id, quantity: 1 },
      });

      if (item.itemType.name === 'weapon') weaponId = item.id;
      if (item.itemType.name === 'pickaxe') pickaxeId = item.id;
      if (item.itemType.name === 'armor') armorId = item.id;
    }

    const updated = await prisma.user.update({
      where: { discordId },
      data: { weaponId, pickaxeId, armorId },
    });

    console.log(`[Registry] Starter kit issued to new user: ${username}`);
    return updated;
  } catch (error) {
    console.error('[Registry] Failed to issue starter kit:', error);
    return user;
  }
}
