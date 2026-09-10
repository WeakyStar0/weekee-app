import { SlashCommandBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

const EQUIPMENT_TYPES = ['weapon', 'pickaxe', 'armor', 'trinket'];
const TYPE_LABELS: Record<string, string> = {
  material: '📦 Materials',
  block: '🧱 Blocks',
  consumable: '🍎 Consumables',
};

const command: Command = {
  data: new SlashCommandBuilder().setName('inventory').setDescription('View your items neatly organized.'),

  async execute(interaction) {
    const userId = interaction.user.id;

    const [rows, user] = await Promise.all([
      prisma.inventory.findMany({
        where: { userId, quantity: { gt: 0 } },
        include: { item: { include: { itemType: true } } },
      }),
      prisma.user.findUnique({
        where: { discordId: userId },
        select: { weaponId: true, pickaxeId: true, armorId: true, trinketId: true },
      }),
    ]);

    if (rows.length === 0) {
      await interaction.reply('Your pockets are empty. 💨');
      return;
    }

    const equippedIds = new Set(
      [user?.weaponId, user?.pickaxeId, user?.armorId, user?.trinketId].filter((id): id is string => Boolean(id)),
    );

    const equipmentLines: string[] = [];
    const otherGroups = new Map<string, string[]>();

    for (const row of rows) {
      const typeName = row.item.itemType.name;
      const equippedTag = equippedIds.has(row.item.id) ? ' *(equipped)*' : '';
      const line = `${row.item.emoji} **${row.item.name}** x${row.quantity}${equippedTag}`;

      if (EQUIPMENT_TYPES.includes(typeName)) {
        equipmentLines.push(line);
      } else {
        const list = otherGroups.get(typeName) ?? [];
        list.push(line);
        otherGroups.set(typeName, list);
      }
    }

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`<:star_decor:1468013007748726835> ${interaction.user.username}'s Stash`)
      .setThumbnail(interaction.user.displayAvatarURL());

    if (equipmentLines.length > 0) {
      embed.addFields({ name: '⚔️ Equipment', value: equipmentLines.join('\n'), inline: false });
    }

    for (const type of [...otherGroups.keys()].sort()) {
      embed.addFields({
        name: TYPE_LABELS[type] ?? type.toUpperCase(),
        value: otherGroups.get(type)!.join('\n'),
        inline: true,
      });
    }

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
