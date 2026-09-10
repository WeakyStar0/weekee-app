import { prisma } from './prisma';

const ENERGY_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour

/**
 * If a full cooldown has passed since the user's last reset, refills energy
 * to 100 and returns the fresh value. Otherwise returns their current energy.
 */
export async function checkAndResetEnergy(userId: string): Promise<number> {
  const user = await prisma.user.findUnique({
    where: { discordId: userId },
    select: { energy: true, lastEnergyReset: true },
  });
  if (!user) return 0;

  const elapsed = Date.now() - user.lastEnergyReset.getTime();
  if (elapsed >= ENERGY_COOLDOWN_MS) {
    await prisma.user.update({
      where: { discordId: userId },
      data: { energy: 100, lastEnergyReset: new Date() },
    });
    return 100;
  }

  return user.energy;
}
