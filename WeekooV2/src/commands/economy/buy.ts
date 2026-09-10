import { SlashCommandBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

const WEEKOIN = '<:weekoin:1465807554927132883>';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('buy')
    .setDescription('Purchase an item from the shop.')
    .addStringOption((opt) =>
      opt.setName('item').setDescription('Select an item to buy').setRequired(true).setAutocomplete(true),
    )
    .addIntegerOption((opt) => opt.setName('amount').setDescription('How many to buy?').setMinValue(1)),

  async autocomplete(interaction) {
    const focused = interaction.options.getFocused().toLowerCase();
    try {
      const items = await prisma.item.findMany({
        where: { isLocked: false, shopItem: true },
        select: { name: true },
      });
      const filtered = items.map((i) => i.name).filter((name) => name.toLowerCase().includes(focused));
      await interaction.respond(filtered.slice(0, 25).map((name) => ({ name, value: name })));
    } catch (error) {
      console.error('buy autocomplete error:', error);
    }
  },

  async execute(interaction) {
    const userId = interaction.user.id;
    const itemName = interaction.options.getString('item', true);
    const quantity = interaction.options.getInteger('amount') ?? 1;

    try {
      const item = await prisma.item.findUnique({ where: { name: itemName } });
      if (!item) {
        await interaction.reply({
          content: "I don't recognize that item. Please select one from the list!",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      // Autocomplete only suggests isLocked:false + shopItem:true items, but a
      // free-typed name can bypass suggestions — enforce it here too.
      if (item.isLocked || !item.shopItem) {
        await interaction.reply({
          content: "That item isn't available for purchase.",
          flags: MessageFlags.Ephemeral,
        });
        return;
      }

      const totalPrice = item.price * quantity;

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.findUnique({ where: { discordId: userId } });
        const balance = user?.weekoins ?? 0;
        if (balance < totalPrice) {
          return { error: `You need ${WEEKOIN} ${totalPrice.toLocaleString()} but you only have ${WEEKOIN} ${balance.toLocaleString()}.` };
        }

        const existing = await tx.inventory.findUnique({
          where: { userId_itemId: { userId, itemId: item.id } },
        });
        const currentOwned = existing?.quantity ?? 0;
        if (currentOwned + quantity > item.maxInventory) {
          return { error: `You can only have **${item.maxInventory}** of this. You already own **${currentOwned}**.` };
        }

        await tx.user.update({ where: { discordId: userId }, data: { weekoins: { decrement: totalPrice } } });
        await tx.inventory.upsert({
          where: { userId_itemId: { userId, itemId: item.id } },
          update: { quantity: { increment: quantity } },
          create: { userId, itemId: item.id, quantity },
        });

        return { error: null };
      });

      if (result.error) {
        await interaction.reply({ content: result.error, flags: MessageFlags.Ephemeral });
        return;
      }

      await interaction.reply(`🛒 You bought **${quantity}x ${item.emoji} ${item.name}**!`);
    } catch (error) {
      console.error('buy execute error:', error);
      await interaction.reply({ content: 'The store is having technical difficulties.', flags: MessageFlags.Ephemeral });
    }
  },
};

export default command;
