import { prisma } from './prisma';

export async function isInAdventure(userId: string): Promise<boolean> {
  const user = await prisma.user.findUnique({ where: { discordId: userId }, select: { inAdventure: true } });
  return user?.inAdventure ?? false;
}

export async function setInAdventure(userId: string, value: boolean): Promise<void> {
  await prisma.user.update({ where: { discordId: userId }, data: { inAdventure: value } });
}
