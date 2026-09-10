import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

const SELLABLE_TYPES = ['block', 'material'];
const WEEKOIN = '<:weekoin:1465807554927132883>';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sellall')
    .setDescription('Sell all your blocks and materials in one go.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    try {
      const rows = await prisma.inventory.findMany({
        where: { userId, quantity: { gt: 0 }, item: { itemType: { in: SELLABLE_TYPES } } },
        include: { item: true },
      });

      if (rows.length === 0) {
        await interaction.reply({
          content: "You don't have any blocks or materials to sell!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      let totalCoins = 0;
      let totalItems = 0;
      const breakdown: string[] = [];

      for (const row of rows) {
        const value = row.item.price * row.quantity;
        totalCoins += value;
        totalItems += row.quantity;
        breakdown.push(`${row.item.emoji} **${row.item.name}** x${row.quantity} → \`${value.toLocaleString()}\``);
      }

      await prisma.$transaction([
        prisma.inventory.deleteMany({
          where: { userId, item: { itemType: { in: SELLABLE_TYPES } } },
        }),
        prisma.user.update({ where: { discordId: userId }, data: { weekoins: { increment: totalCoins } } }),
      ]);

      const embed = new EmbedBuilder()
        .setColor('#00FF00')
        .setTitle('💰 Bulk Sale Complete')
        .setDescription(`You sold **${totalItems}** items and earned **${WEEKOIN} ${totalCoins.toLocaleString()}** Weekoins!`)
        .addFields({ name: 'Inventory Breakdown', value: breakdown.join('\n').slice(0, 1024) })
        .setFooter({ text: 'Weekoo Market' })
        .setTimestamp();

      await interaction.reply({ embeds: [embed] });
    } catch (error) {
      console.error('sellall execute error:', error);
      await interaction.reply({ content: 'The market is currently overwhelmed. Try again later.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
