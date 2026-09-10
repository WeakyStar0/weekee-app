import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';
import { ensureUserExists } from '../../lib/userRegistry';
import { addXp } from '../../lib/leveling';

const BASE_REWARD = 100;
const FLAT_XP = 20;
const MS_PER_HOUR = 60 * 60 * 1000;
const COOLDOWN = 24 * MS_PER_HOUR;
const STREAK_EXPIRY = 48 * MS_PER_HOUR;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('daily')
    .setDescription('Claim your daily reward and build your streak!'),

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      const userData = await ensureUserExists(userId, interaction.user.username);

      const now = Date.now();
      const timeDiff = userData.lastDaily ? now - userData.lastDaily.getTime() : Infinity;

      if (timeDiff < COOLDOWN) {
        const remaining = COOLDOWN - timeDiff;
        const hours = Math.floor(remaining / MS_PER_HOUR);
        const minutes = Math.floor((remaining % MS_PER_HOUR) / (60 * 1000));
        await interaction.reply({
          content: `⏳ You're too early! Come back in **${hours}h ${minutes}m**.`,
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let currentStreak = userData.streak;
      let streakBroken = false;
      if (timeDiff >= STREAK_EXPIRY) {
        currentStreak = 1;
        streakBroken = true;
      } else {
        currentStreak += 1;
      }

      const coinBonus = (currentStreak - 1) * 2;
      const totalCoins = BASE_REWARD + coinBonus;

      await prisma.user.update({
        where: { discordId: userId },
        data: { weekoins: { increment: totalCoins }, lastDaily: new Date(), streak: currentStreak },
      });

      const embed = new EmbedBuilder()
        .setColor(streakBroken ? '#FFA500' : '#00FF00')
        .setTitle(streakBroken ? '💔 Streak Broken' : '🔥 Daily Claimed')
        .setDescription(`You claimed **${totalCoins}** Weekoins!`)
        .addFields(
          { name: 'Coins', value: `${BASE_REWARD} + ${coinBonus} bonus`, inline: true },
          { name: 'XP', value: `+${FLAT_XP} XP`, inline: true },
          { name: 'Streak', value: `${currentStreak} Days`, inline: true },
        );

      await interaction.reply({ embeds: [embed] });
      await addXp(userId, FLAT_XP, interaction);
    } catch (error) {
      console.error('daily execute error:', error);
      if (!interaction.replied) {
        await interaction.reply({ content: 'Failed to process daily.', flags: MessageFlags.Ephemeral });
      }
    }
  },
};

export default command;
