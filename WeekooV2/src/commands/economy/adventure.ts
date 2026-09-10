import {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags,
} from 'discord.js';
import type { ChatInputCommandInteraction } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';
import { ensureUserExists } from '../../lib/userRegistry';
import { checkAndResetEnergy, spendEnergy } from '../../lib/energy';
import { addXp } from '../../lib/leveling';
import { computeCombatStats } from '../../lib/combatStats';
import { startBattle, type EnemyWithLoot } from '../../lib/battle';
import { getWalkingScene, getMiningScene } from '../../lib/animations';
import { isInAdventure, setInAdventure } from '../../lib/adventureGuard';
import { ADVENTURE_TIMEOUT_MS } from '../../lib/adventureConstants';

const WALK_ENERGY_COST = 5;
const MINE_ENERGY_COST = 10;
const FIGHT_ENERGY_COST = 10;
const FLEE_ENERGY_COST = 5;
const WEEKOIN = '<:weekoin:1465807554927132883>';

const WALK_ENCOUNTER_LINES = [
  'You found a lost pouch of coins!',
  'A slime bumped into you and dropped loot.',
  'You found gold in the grass.',
];

type AdventureType = 'walk' | 'mine';

interface SessionStats {
  coins: number;
  xp: number;
  items: Map<string, { emoji: string; qty: number }>;
  battlesWon: number;
  battlesLost: number;
  fled: number;
}

function newStats(): SessionStats {
  return { coins: 0, xp: 0, items: new Map(), battlesWon: 0, battlesLost: 0, fled: 0 };
}

function collect(stats: SessionStats, name: string, emoji: string, qty: number): void {
  const existing = stats.items.get(name);
  if (existing) existing.qty += qty;
  else stats.items.set(name, { emoji, qty });
}

function buildLogEmbed(title: string, color: `#${string}`, stats: SessionStats): EmbedBuilder {
  const itemLines =
    stats.items.size > 0
      ? [...stats.items.entries()].map(([name, { emoji, qty }]) => `${emoji} **${name}** x${qty}`).join('\n')
      : 'Nothing collected.';

  return new EmbedBuilder()
    .setColor(color)
    .setTitle(title)
    .addFields(
      { name: '🎒 Session Log', value: itemLines, inline: false },
      {
        name: '📊 Totals',
        value:
          `${WEEKOIN} Coins: **${stats.coins}**\n` +
          `🧪 XP: **${stats.xp}**\n` +
          `⚔️ Battles Won: **${stats.battlesWon}** | Lost: **${stats.battlesLost}** | Fled: **${stats.fled}**`,
        inline: false,
      },
    )
    .setTimestamp();
}

async function pickRandomEnemy(dimensionId: string): Promise<EnemyWithLoot | null> {
  const enemies = await prisma.enemy.findMany({
    where: { dimensionId },
    include: { lootTable: { include: { item: true } } },
  });
  if (enemies.length === 0) return null;
  return enemies[Math.floor(Math.random() * enemies.length)];
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('adventure')
    .setDescription('Go on an adventure!')
    .addSubcommand((sub) => sub.setName('walk').setDescription(`Explore the world (${WALK_ENERGY_COST} Energy)`))
    .addSubcommand((sub) => sub.setName('mine').setDescription(`Mine for resources (${MINE_ENERGY_COST} Energy)`)),

  async execute(interaction) {
    const userId = interaction.user.id;
    const type = interaction.options.getSubcommand() as AdventureType;

    if (await isInAdventure(userId)) {
      await interaction.reply({
        content: "You're already on an adventure! Finish it or click End Adventure first.",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    await ensureUserExists(userId, interaction.user.username);
    await setInAdventure(userId, true);
    await interaction.deferReply();

    const stats = newStats();

    try {
      await runAdventureLoop(interaction, userId, type, stats);
    } finally {
      await setInAdventure(userId, false);
    }
  },
};

async function runAdventureLoop(
  interaction: ChatInputCommandInteraction,
  userId: string,
  type: AdventureType,
  stats: SessionStats,
): Promise<void> {
  const actionCost = type === 'walk' ? WALK_ENERGY_COST : MINE_ENERGY_COST;

  while (true) {
    const energy = await checkAndResetEnergy(userId);
    if (energy < FLEE_ENERGY_COST) {
      await interaction.editReply({
        embeds: [buildLogEmbed(`❌ Exhausted! (${energy}/100 energy)`, '#FF0000', stats)],
        components: [],
      });
      return;
    }

    const user = await prisma.user.findUnique({
      where: { discordId: userId },
      include: { dimension: true, weapon: true, pickaxe: true, armor: true, trinket: true },
    });
    if (!user?.dimension) {
      await interaction.editReply({
        content: 'No dimension configured for your profile. Contact an admin.',
        embeds: [],
        components: [],
      });
      return;
    }
    const dimension = user.dimension;

    const encountered = Math.random() < dimension.battleChance;

    if (encountered) {
      const enemy = await pickRandomEnemy(dimension.id);
      if (!enemy) {
        // No enemies configured for this dimension — treat as a non-event, skip to normal action.
      } else {
        const choice = await promptFightOrFlee(interaction, userId, enemy.name, energy);
        if (choice === 'timeout') {
          await interaction.editReply({
            embeds: [buildLogEmbed('⏳ You wandered off and the adventure ended.', '#808080', stats)],
            components: [],
          });
          return;
        }

        if (choice === 'flee') {
          await spendEnergy(userId, FLEE_ENERGY_COST);
          stats.fled++;
          await interaction.editReply({
            embeds: [new EmbedBuilder().setColor('#808080').setDescription(`🏃 You ran from the **${enemy.name}**!`)],
            components: [],
          });
        } else {
          await spendEnergy(userId, FIGHT_ENERGY_COST);
          const combat = computeCombatStats(user);
          const result = await startBattle(interaction, userId, combat, enemy);

          if (result.won) {
            stats.xp += result.xpGained;
            stats.battlesWon++;
            for (const drop of result.loot) collect(stats, drop.name, drop.emoji, drop.qty);
          } else {
            stats.battlesLost++;
          }
        }

        const shouldContinue = await promptContinueOrEnd(interaction, stats);
        if (!shouldContinue) return;
        continue;
      }
    }

    // --- Normal action (no encounter, or no enemies configured for this dimension) ---
    if (energy < actionCost) {
      await interaction.editReply({
        embeds: [buildLogEmbed(`❌ Not enough energy to ${type} (need ${actionCost}, have ${energy}).`, '#FF0000', stats)],
        components: [],
      });
      return;
    }

    await spendEnergy(userId, actionCost);
    const remainingEnergy = energy - actionCost;

    if (type === 'walk') {
      await runWalkAction(interaction, userId, dimension.name, remainingEnergy, stats);
    } else {
      await runMineAction(interaction, userId, dimension.id, dimension.name, user.baseLuck + (user.pickaxe?.mainStatValue ?? 0), remainingEnergy, stats);
    }

    const shouldContinue = await promptContinueOrEnd(interaction, stats);
    if (!shouldContinue) return;
  }
}

async function runWalkAction(
  interaction: ChatInputCommandInteraction,
  userId: string,
  dimensionName: string,
  remainingEnergy: number,
  stats: SessionStats,
): Promise<void> {
  const walkEmbed = new EmbedBuilder()
    .setColor('#3498DB')
    .setTitle(`🚶 Exploring: ${dimensionName}`)
    .setDescription(`${getWalkingScene(dimensionName, true)}\n\n*Walking through the lands...*`)
    .setFooter({ text: `Energy: ${remainingEnergy}/100` });

  await interaction.editReply({ embeds: [walkEmbed], components: [] });
  await wait(2000);

  const xpGain = 5;
  const coinGain = Math.floor(Math.random() * 20) + 10;
  await prisma.user.update({ where: { discordId: userId }, data: { weekoins: { increment: coinGain } } });
  await addXp(userId, xpGain, interaction);
  stats.coins += coinGain;
  stats.xp += xpGain;

  const encounterMsg = WALK_ENCOUNTER_LINES[Math.floor(Math.random() * WALK_ENCOUNTER_LINES.length)];
  const idleArt = getWalkingScene(dimensionName, false);

  const resultEmbed = new EmbedBuilder()
    .setColor('#00FF00')
    .setTitle('📍 Adventure Result')
    .setDescription(`${idleArt}\n\n**${encounterMsg}**\n\nFound: **${WEEKOIN} ${coinGain}** | **🧪 ${xpGain} XP**`)
    .setFooter({ text: `Energy: ${remainingEnergy}/100` });

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

async function runMineAction(
  interaction: ChatInputCommandInteraction,
  userId: string,
  dimensionId: string,
  dimensionName: string,
  playerLuck: number,
  remainingEnergy: number,
  stats: SessionStats,
): Promise<void> {
  for (const frame of [0, 1, 2] as const) {
    const embed = new EmbedBuilder()
      .setColor('#717171')
      .setTitle(`⛏️ Mining in ${dimensionName}`)
      .setDescription(getMiningScene(dimensionName, frame, true))
      .setFooter({ text: `Energy: ${remainingEnergy}/100` });
    await interaction.editReply({ embeds: [embed], components: [] });
    await wait(800);
  }

  const lootTable = await prisma.miningLoot.findMany({ where: { dimensionId }, include: { item: true } });
  const xpGain = 15;
  const roundDrops: { name: string; emoji: string; qty: number }[] = [];

  for (const drop of lootTable) {
    const adjustedChance = drop.chance + playerLuck * 0.01;
    if (Math.random() <= adjustedChance) {
      const qty = Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1)) + drop.minQty;
      await prisma.inventory.upsert({
        where: { userId_itemId: { userId, itemId: drop.itemId } },
        update: { quantity: { increment: qty } },
        create: { userId, itemId: drop.itemId, quantity: qty },
      });
      collect(stats, drop.item.name, drop.item.emoji, qty);
      roundDrops.push({ name: drop.item.name, emoji: drop.item.emoji, qty });
    }
  }

  await addXp(userId, xpGain, interaction);
  stats.xp += xpGain;

  const resultList =
    roundDrops.length > 0
      ? roundDrops.map(({ name, emoji, qty }) => `+${qty} ${emoji} **${name}**`).join('\n')
      : '💨 *You found nothing but rubble...*';

  const resultEmbed = new EmbedBuilder()
    .setColor('#FFD700')
    .setTitle('⛏️ Mining Complete')
    .setDescription(`${getMiningScene(dimensionName, 2, false)}\n\n**Loot Obtained:**\n${resultList}\n\n**Rewards:**\n🧪 +${xpGain} XP`)
    .setFooter({ text: `Energy: ${remainingEnergy}/100` });

  await interaction.editReply({ embeds: [resultEmbed], components: [] });
}

/** Returns 'fight', 'flee', or 'timeout' (which ends the whole adventure). */
async function promptFightOrFlee(
  interaction: ChatInputCommandInteraction,
  userId: string,
  enemyName: string,
  currentEnergy: number,
): Promise<'fight' | 'flee' | 'timeout'> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('fight')
      .setLabel(`Fight (-${FIGHT_ENERGY_COST}⚡)`)
      .setStyle(ButtonStyle.Danger)
      .setDisabled(currentEnergy < FIGHT_ENERGY_COST),
    new ButtonBuilder().setCustomId('flee').setLabel(`Run (-${FLEE_ENERGY_COST}⚡)`).setStyle(ButtonStyle.Secondary),
  );

  const embed = new EmbedBuilder()
    .setColor('#cc0000')
    .setTitle('⚠️ Monster Encounter!')
    .setDescription(`A wild **${enemyName}** blocks your path. Fight it, or run?`);

  const message = await interaction.editReply({ embeds: [embed], components: [row] });

  const choice = await message
    .awaitMessageComponent({ filter: (btn) => btn.user.id === userId, time: ADVENTURE_TIMEOUT_MS })
    .catch(() => null);

  if (!choice) return 'timeout';
  await choice.deferUpdate();
  return choice.customId === 'fight' ? 'fight' : 'flee';
}

/** Returns true to keep adventuring, false to end (End Adventure clicked or timed out). */
async function promptContinueOrEnd(interaction: ChatInputCommandInteraction, stats: SessionStats): Promise<boolean> {
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('continue').setLabel('Continue').setStyle(ButtonStyle.Primary),
    new ButtonBuilder().setCustomId('end').setLabel('End Adventure').setStyle(ButtonStyle.Secondary),
  );

  const message = await interaction.editReply({ components: [row] });

  const confirmation = await message
    .awaitMessageComponent({ filter: (btn) => btn.user.id === interaction.user.id, time: ADVENTURE_TIMEOUT_MS })
    .catch(() => null);

  if (!confirmation) {
    await interaction.editReply({
      embeds: [buildLogEmbed('⏳ You wandered off and the adventure ended.', '#808080', stats)],
      components: [],
    });
    return false;
  }

  await confirmation.deferUpdate();

  if (confirmation.customId === 'end') {
    await interaction.editReply({
      embeds: [buildLogEmbed('🏁 Adventure Complete', '#00FF00', stats)],
      components: [],
    });
    return false;
  }

  return true;
}

function wait(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default command;
