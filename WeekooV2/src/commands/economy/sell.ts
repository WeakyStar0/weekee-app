import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';
import { isInAdventure } from '../../lib/adventureGuard';

const SELLABLE_TYPES = ['block', 'material'];
const WEEKOIN = '<:weekoin:1465807554927132883>';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('sell')
    .setDescription('Sell your blocks and materials for Weekoins.')
    .addStringOption((opt) =>
      opt.setName('item').setDescription('The item you want to sell').setRequired(true).setAutocomplete(true),
    )
    .addIntegerOption((opt) =>
      opt.setName('amount').setDescription('How many to sell? (leave empty to sell all)').setMinValue(1),
    ),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
      const rows = await prisma.inventory.findMany({
        where: {
          userId: interaction.user.id,
          quantity: { gt: 0 },
          item: { itemType: { name: { in: SELLABLE_TYPES } } },
        },
        include: { item: { include: { itemType: true } } },
      });
      const choices = rows.filter((row) => row.item.name.toLowerCase().includes(focused));
      await interaction.respond(
        choices.slice(0, 25).map((row) => ({
          name: `${row.item.name} (${row.item.itemType.name})`,
          value: row.item.name,
        })),
      );
    } catch (error) {
      console.error('sell autocomplete error:', error);
    }
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const itemName = interaction.options.getString('item', true);
    const amountInput = interaction.options.getInteger('amount');

    if (await isInAdventure(userId)) {
      await interaction.reply({ content: "You can't sell while on an adventure!", flags: MessageFlags.Ephemeral });
      return;
    }

    try {
      const item = await prisma.item.findUnique({ where: { name: itemName }, include: { itemType: true } });
      if (!item) {
        await interaction.reply({ content: "I don't know what that item is.", flags: MessageFlags.Ephemeral });
        return;
      }

      if (!SELLABLE_TYPES.includes(item.itemType.name)) {
        await interaction.reply({
          content: '❌ You can only sell **Blocks** and **Materials**. Equipment cannot be sold here.',
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const result = await prisma.$transaction(async (tx) => {
        const inv = await tx.inventory.findUnique({ where: { userId_itemId: { userId, itemId: item.id } } });
        const owned = inv?.quantity ?? 0;
        if (owned <= 0) {
          return { error: "You don't have any of that to sell!" };
        }

        let finalAmount: number;
        let feedbackNote = '';
        if (!amountInput) {
          finalAmount = owned;
        } else if (amountInput > owned) {
          finalAmount = owned;
          feedbackNote = `(You only had **${owned}**, so I sold them all)`;
        } else {
          finalAmount = amountInput;
        }

        const totalPay = item.price * finalAmount;

        await tx.inventory.update({
          where: { userId_itemId: { userId, itemId: item.id } },
          data: { quantity: { decrement: finalAmount } },
        });
        await tx.user.update({ where: { discordId: userId }, data: { weekoins: { increment: totalPay } } });
        await tx.inventory.deleteMany({ where: { userId, itemId: item.id, quantity: { lte: 0 } } });

        return { error: null, finalAmount, totalPay, feedbackNote };
      });

      if (result.error) {
        await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply(
        `💰 Sold **${result.finalAmount}x ${item.emoji} ${item.name}** for **${WEEKOIN} ${result.totalPay!.toLocaleString()}**!\n${result.feedbackNote}`,
      );
    } catch (error) {
      console.error('sell execute error:', error);
      await interaction.reply({ content: 'The market is closed due to a database error.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
