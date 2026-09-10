import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

const command: Command = {
  data: new SlashCommandBuilder().setName('inventory').setDescription('View your items neatly organized.'),

  async execute(interaction) {
    const rows = await prisma.inventory.findMany({
      where: { userId: interaction.user.id, quantity: { gt: 0 } },
      include: { item: { include: { itemType: true } } },
    });

    if (rows.length === 0) {
      await interaction.reply('Your pockets are empty. 💨');
      return;
    }

    const groups = new Map<string, string[]>();
    for (const row of rows) {
      const type = row.item.itemType.name;
      const list = groups.get(type) ?? [];
      list.push(`${row.item.emoji} **${row.item.name}** x${row.quantity}`);
      groups.set(type, list);
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`<:star_decor:1468013007748726835> ${interaction.user.username}'s Stash`)
      .setThumbnail(interaction.user.displayAvatarURL());

    for (const type of [...groups.keys()].sort()) {
      embed.addFields({ name: type.toUpperCase(), value: groups.get(type)!.join('\n'), inline: false });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
