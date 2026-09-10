import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

const MAX_ENERGY = 100;
const COOLDOWN_MS = 60 * 60 * 1000;

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('energy')
    .setDescription('Check your current energy and time until the next reset.'),

  async execute(interaction) {
    const user = await prisma.user.findUnique({
      where: { discordId: interaction.user.id },
      select: { energy: true, lastEnergyReset: true },
    });

    let currentEnergy: number;
    let timeString: string;

    if (!user) {
      currentEnergy = MAX_ENERGY;
      timeString = 'Ready now!';
    } else {
      const elapsed = Date.now() - user.lastEnergyReset.getTime();
      if (elapsed >= COOLDOWN_MS) {
        currentEnergy = MAX_ENERGY;
        timeString = 'Ready to reset!';
      } else {
        currentEnergy = user.energy;
        const remaining = COOLDOWN_MS - elapsed;
        const hours = Math.floor(remaining / (1000 * 60 * 60));
        const minutes = Math.floor((remaining % (1000 * 60 * 60)) / (1000 * 60));
        timeString = `${hours}h ${minutes}m`;
      }
    }

    const percentage = currentEnergy / MAX_ENERGY;
    const filledBlocks = Math.round(percentage * 10);
    const emptyBlocks = 10 - filledBlocks;
    const bar = '🟩'.repeat(filledBlocks) + '⬛'.repeat(emptyBlocks);

    const embed = new EmbedBuilder()
      .setColor('#FFFF00')
      .setTitle('⚡ Your Energy')
      .setAuthor({ name: interaction.user.username, iconURL: interaction.user.displayAvatarURL() })
      .addFields(
        { name: 'Current Energy', value: `${bar} \`${currentEnergy} / ${MAX_ENERGY}\``, inline: false },
        { name: 'Time Until Full Reset', value: `\`${timeString}\``, inline: false },
      )
      .setTimestamp();

    await interaction.reply({ embeds: [embed], flags: MessageFlags.Ephemeral });
  },
};

export default command;
