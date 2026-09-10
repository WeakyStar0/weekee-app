import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import type { Item, ItemType } from '@prisma/client';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';
import { isInAdventure } from '../../lib/adventureGuard';

const ITEMS_PER_PAGE = 5;
type SortType = 'price' | 'power' | 'rarity' | 'name';
type ShopItem = Item & { itemType: ItemType };

const RARITY_ORDER: Record<string, number> = { Legendary: 1, Epic: 2, Rare: 3, Uncommon: 4, Common: 5 };
const RARITY_EMOJI: Record<string, string> = {
  Legendary: '🟠',
  Epic: '🟣',
  Rare: '🔵',
  Uncommon: '🟢',
  Common: '⚪',
};

function sortItems(items: ShopItem[], sortType: SortType): ShopItem[] {
  const sorted = [...items];
  switch (sortType) {
    case 'price':
      return sorted.sort((a, b) => b.price - a.price);
    case 'name':
      return sorted.sort((a, b) => a.name.localeCompare(b.name));
    case 'power':
      return sorted.sort((a, b) => b.mainStatValue - a.mainStatValue);
    case 'rarity':
      return sorted.sort((a, b) => (RARITY_ORDER[a.rarity] ?? 5) - (RARITY_ORDER[b.rarity] ?? 5));
  }
}

function statLabel(item: ShopItem): string {
  switch (item.itemType.name) {
    case 'weapon':
      return `⚔️ DMG: +${item.mainStatValue}`;
    case 'armor':
      return `🛡️ DEF: +${item.mainStatValue}`;
    case 'pickaxe':
      return `🍀 LCK: +${item.mainStatValue}`;
    case 'trinket':
      return `🔮 ${(item.statModifierType ?? '').toUpperCase()}: +${item.mainStatValue}%`;
    default:
      return `📦 Type: ${item.itemType.name}`;
  }
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('shop')
    .setDescription('Browse the Weekoo Store.')
    .addStringOption((option) =>
      option
        .setName('type')
        .setDescription('Filter by item type')
        .setRequired(false)
        .addChoices(
          { name: '⚔️ Weapons', value: 'weapon' },
          { name: '⛏️ Pickaxes', value: 'pickaxe' },
          { name: '🛡️ Armor', value: 'armor' },
          { name: '🍎 Consumables', value: 'consumable' },
          { name: '📦 Materials', value: 'material' },
          { name: '💍 Trinkets', value: 'trinket' },
        ),
    ),

  async execute(interaction) {
    if (await isInAdventure(interaction.user.id)) {
      await interaction.reply({ content: "You can't shop while on an adventure!", flags: MessageFlags.Ephemeral });
      return;
    }

    let currentPage = 0;
    let currentSort: SortType = 'price';
    const filterType = interaction.options.getString('type');

    let items = sortItems(
      await prisma.item.findMany({
        where: {
          isLocked: false,
          shopItem: true,
          ...(filterType ? { itemType: { name: filterType } } : {}),
        },
        include: { itemType: true },
      }),
      currentSort,
    );

    const generateEmbed = (page: number) => {
      const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1;
      const start = page * ITEMS_PER_PAGE;
      const pageItems = items.slice(start, start + ITEMS_PER_PAGE);

      const embed = new EmbedBuilder()
        .setColor('#2b2d31')
        .setTitle(filterType ? `🛒 ${filterType.toUpperCase()} STORE` : '🛒 WEEKOO GENERAL STORE')
        .setDescription(`Sorted by: \`${currentSort.toUpperCase()}\` \nUse \`/buy item:<name>\` to purchase.`)
        .setFooter({ text: `Page ${page + 1} / ${totalPages} • ${items.length} Items in stock` });

      if (pageItems.length === 0) {
        embed.setDescription('No items found in this category.');
      } else {
        for (const item of pageItems) {
          const rarityEmoji = RARITY_EMOJI[item.rarity] ?? '⚪';
          embed.addFields({
            name: `${rarityEmoji} ${item.name}`,
            value: `> \`${statLabel(item)}\` — **Price:** 🪙 \`${item.price.toLocaleString()}\`\n> *${item.description}*`,
            inline: false,
          });
        }
      }
      return embed;
    };

    const generateRows = (page: number) => {
      const totalPages = Math.ceil(items.length / ITEMS_PER_PAGE) || 1;

      const navRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('prev').setLabel('⬅️').setStyle(ButtonStyle.Secondary).setDisabled(page === 0),
        new ButtonBuilder()
          .setCustomId('next')
          .setLabel('➡️')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(page >= totalPages - 1),
      );

      const sortRow = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder()
          .setCustomId('sort_price')
          .setLabel('🪙 Price')
          .setStyle(currentSort === 'price' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sort_power')
          .setLabel('⚡ Power')
          .setStyle(currentSort === 'power' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sort_rarity')
          .setLabel('💎 Rarity')
          .setStyle(currentSort === 'rarity' ? ButtonStyle.Primary : ButtonStyle.Secondary),
        new ButtonBuilder()
          .setCustomId('sort_name')
          .setLabel('📝 A-Z')
          .setStyle(currentSort === 'name' ? ButtonStyle.Primary : ButtonStyle.Secondary),
      );

      return [navRow, sortRow];
    };

    const response = await interaction.reply({
      embeds: [generateEmbed(currentPage)],
      components: generateRows(currentPage),
    });

    const collector = response.createMessageComponentCollector({ time: 300_000 });

    collector.on('collect', async (i) => {
      if (i.user.id !== interaction.user.id) {
        await i.reply({ content: 'Run /shop to browse yourself!', flags: MessageFlags.Ephemeral });
        return;
      }

      if (i.customId === 'next') currentPage++;
      else if (i.customId === 'prev') currentPage--;
      else if (i.customId.startsWith('sort_')) {
        currentSort = i.customId.split('_')[1] as SortType;
        items = sortItems(items, currentSort);
        currentPage = 0;
      }

      await i.update({ embeds: [generateEmbed(currentPage)], components: generateRows(currentPage) });
    });

    collector.on('end', () => {
      interaction.editReply({ components: [] }).catch(() => null);
    });
  },
};

export default command;
