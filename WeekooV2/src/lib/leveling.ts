import type { ChatInputCommandInteraction } from 'discord.js';
import { EmbedBuilder } from 'discord.js';
import { prisma } from './prisma';

/**
 * XP required to go from `level` to `level + 1`.
 * Formula carried over from V1: 100 + 0.04x³ + 0.8x² + 2x + 0.5, x = level - 1.
 */
export function getXpNeeded(level: number): number {
  const x = level - 1;
  const result = 100 + 0.04 * x ** 3 + 0.8 * x ** 2 + 2 * x + 0.5;
  return Math.floor(result);
}

/** Total XP a user has accumulated across all completed levels plus current progress. */
export function getTotalXp(level: number, currentXp: number): number {
  let total = 0;
  for (let i = 1; i < level; i++) {
    total += getXpNeeded(i);
  }
  return total + currentXp;
}

/**
 * Adds XP to a user, handles level-up rollover, persists to DB, and
 * announces a level-up via followUp if an interaction is provided.
 */
export async function addXp(
  userId: string,
  xpToAdd: number,
  interaction?: ChatInputCommandInteraction,
): Promise<void> {
  const user = await prisma.user.findUnique({ where: { discordId: userId } });
  if (!user) return;

  let { level, xp } = user;
  xp += xpToAdd;

  let leveledUp = false;
  let xpNeeded = getXpNeeded(level);
  while (xp >= xpNeeded) {
    xp -= xpNeeded;
    level++;
    leveledUp = true;
    xpNeeded = getXpNeeded(level);
  }

  await prisma.user.update({ where: { discordId: userId }, data: { level, xp } });

  if (leveledUp && interaction) {
    const embed = new EmbedBuilder()
      .setColor('#FFD700')
      .setTitle('🎉 LEVEL UP!')
      .setThumbnail(interaction.user.displayAvatarURL())
      .setDescription(`Congratulations <@${userId}>!\nYou reached **Level ${level}**!`)
      .setFooter({ text: `Next level in ${xpNeeded - xp} XP` });

    try {
      await interaction.followUp({ embeds: [embed] });
    } catch (error) {
      console.error('addXp: failed to send level-up announcement:', error);
    }
  }
}
