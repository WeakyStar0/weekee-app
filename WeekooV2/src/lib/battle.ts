import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from 'discord.js';
import type { RepliableInteraction } from 'discord.js';
import type { Enemy, EnemyLoot, Item } from '@prisma/client';
import { prisma } from './prisma';
import { addXp } from './leveling';
import { spendEnergy } from './energy';
import { ADVENTURE_TIMEOUT_MS } from './adventureConstants';

export interface PlayerCombatStats {
  maxHp: number;
  totalDmg: number;
  totalDef: number;
}

export interface BattleLootLine {
  name: string;
  emoji: string;
  qty: number;
}

export interface BattleResult {
  won: boolean;
  timedOut: boolean;
  xpGained: number;
  loot: BattleLootLine[];
}

export type EnemyWithLoot = Enemy & { lootTable: (EnemyLoot & { item: Item })[] };

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs a full attack/defend battle loop against `enemy`, editing `interaction`'s
 * reply as it goes. Assumes the interaction has already been deferred/replied.
 * Any 45s inactivity mid-battle resolves as a loss (per the shared adventure
 * inactivity rule) rather than as V1's old "you fled" outcome.
 */
export async function startBattle(
  interaction: RepliableInteraction,
  userId: string,
  playerStats: PlayerCombatStats,
  enemy: EnemyWithLoot,
): Promise<BattleResult> {
  let pHP = playerStats.maxHp;
  let eHP = enemy.hp;
  let parryActive = false;
  let nextAttackBonus = 1.0;

  const generateEmbed = (lastAction: string) =>
    new EmbedBuilder()
      .setColor('#cc0000')
      .setTitle(`⚔️ Battle: ${interaction.user.username} vs ${enemy.name}`)
      .setThumbnail(enemy.imageUrl || null)
      .setDescription(
        `${lastAction}\n\n**${enemy.name}**\n❤️ HP: \`${Math.max(eHP, 0)}/${enemy.hp}\` | 🛡️ DEF: \`${enemy.defense}\`\n\n` +
          `**You**\n❤️ HP: \`${Math.max(pHP, 0)}/${playerStats.maxHp}\` | 🛡️ DEF: \`${playerStats.totalDef}\``,
      );

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId('atk').setLabel('Attack').setStyle(ButtonStyle.Danger),
    new ButtonBuilder().setCustomId('def').setLabel('Defend').setStyle(ButtonStyle.Primary),
  );

  const msg = await interaction.editReply({
    embeds: [generateEmbed(`A wild **${enemy.name}** appeared!`)],
    components: [row],
  });

  let timedOut = false;

  while (pHP > 0 && eHP > 0) {
    const i = await msg
      .awaitMessageComponent({ filter: (btn) => btn.user.id === userId, time: ADVENTURE_TIMEOUT_MS })
      .catch(() => null);

    if (!i) {
      timedOut = true;
      pHP = 0;
      break;
    }

    let playerTurnMsg: string;

    if (i.customId === 'atk') {
      const damageDealt = Math.floor(playerStats.totalDmg * nextAttackBonus * (100 / (enemy.defense + 100)));
      eHP -= damageDealt;
      playerTurnMsg = `⚔️ You hit **${enemy.name}** for **${damageDealt}** damage!`;
      nextAttackBonus = 1.0;
    } else {
      playerTurnMsg = `🛡️ You took a defensive stance...`;
      if (Math.random() < 0.15) {
        parryActive = true;
        playerTurnMsg += `\n✨ **PARRY READY!**`;
      }
    }

    await i.update({ embeds: [generateEmbed(playerTurnMsg)], components: [] });
    if (eHP <= 0) break;

    await wait(1500);

    let enemyTurnMsg: string;
    if (parryActive) {
      enemyTurnMsg = `✨ You parried the **${enemy.name}**'s attack! No damage taken.`;
      nextAttackBonus = 1.3;
      parryActive = false;
    } else {
      const enemyRawDmg = i.customId === 'def' ? enemy.damage * 0.5 : enemy.damage;
      const damageTaken = Math.floor(enemyRawDmg * (100 / (playerStats.totalDef + 100)));
      pHP -= damageTaken;
      enemyTurnMsg = `💥 **${enemy.name}** dealt **${damageTaken}** damage to you!`;
    }

    if (pHP <= 0) {
      await interaction.editReply({ embeds: [generateEmbed(enemyTurnMsg)], components: [] });
      break;
    }

    await interaction.editReply({ embeds: [generateEmbed(enemyTurnMsg)], components: [row] });
  }

  const won = eHP <= 0 && pHP > 0;

  if (won) {
    const loot: BattleLootLine[] = [];
    for (const drop of enemy.lootTable) {
      if (Math.random() <= drop.chance) {
        const qty = Math.floor(Math.random() * (drop.maxQty - drop.minQty + 1)) + drop.minQty;
        loot.push({ name: drop.item.name, emoji: drop.item.emoji, qty });
        await prisma.inventory.upsert({
          where: { userId_itemId: { userId, itemId: drop.itemId } },
          update: { quantity: { increment: qty } },
          create: { userId, itemId: drop.itemId, quantity: qty },
        });
      }
    }

    await addXp(userId, enemy.xpDrop, interaction);

    const lootLines =
      loot.length > 0 ? loot.map((l) => `+${l.qty} ${l.emoji} **${l.name}**`).join('\n') : 'Nothing extra this time.';

    await interaction.editReply({
      embeds: [
        new EmbedBuilder()
          .setColor('#00FF00')
          .setTitle('🏆 Victory!')
          .setDescription(`You defeated **${enemy.name}**!\n\n**Rewards:**\n🧪 +${enemy.xpDrop} XP\n${lootLines}`),
      ],
      components: [],
    });

    return { won: true, timedOut: false, xpGained: enemy.xpDrop, loot };
  }

  // Loss (combat or timeout): extra energy penalty on top of the upfront fight cost.
  await spendEnergy(userId, 5);

  await interaction.editReply({
    embeds: [
      new EmbedBuilder()
        .setColor('#000000')
        .setTitle(timedOut ? '💀 Defeat (timed out)' : '💀 Defeat')
        .setDescription(
          timedOut
            ? `You hesitated too long and **${enemy.name}** got the better of you!\n\n**Penalty:** -5 Energy`
            : `You were slain by **${enemy.name}**...\n\n**Penalty:** -5 Energy`,
        ),
    ],
    components: [],
  });

  return { won: false, timedOut, xpGained: 0, loot: [] };
}
