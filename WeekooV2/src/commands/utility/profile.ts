import { SlashCommandBuilder, EmbedBuilder, MessageFlags } from 'discord.js';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';
import { ensureUserExists } from '../../lib/userRegistry';
import { getXpNeeded } from '../../lib/leveling';

// Same emoji IDs as V1 — these are application-owned emojis tied to this bot's
// Discord application, so they carry over since V2 reuses the same bot app.
const RPG_TITLE_EMOJIS =
  '<:w_:1467990168224137308><:e_:1467990186745925695><:e_:1467990186745925695><:k_:1467990202835537950><:o_:1467990217704079573><:o_:1467990217704079573> <:r_:1467990234275909663><:p_:1467990254958022778><:g_:1467990272263721023>';
const WEEKOIN_EMOJI = '<:weekoin:1465807554927132883>';
const STAR_DECOR_EMOJI = '<:star_decor:1468013007748726835>';

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('profile')
    .setDescription('Manage your Weekoo profile.')
    .addSubcommand((sub) =>
      sub
        .setName('view')
        .setDescription("View your or someone else's profile.")
        .addUserOption((opt) => opt.setName('target').setDescription('The user to view')),
    )
    .addSubcommand((sub) =>
      sub
        .setName('edit')
        .setDescription('Edit your profile description.')
        .addStringOption((opt) =>
          opt.setName('description').setDescription('Your new profile description').setRequired(true),
        ),
    )
    .addSubcommand((sub) =>
      sub
        .setName('birthday')
        .setDescription('Set your birthday.')
        .addIntegerOption((opt) => opt.setName('month').setDescription('Month (1-12)').setRequired(true))
        .addIntegerOption((opt) => opt.setName('day').setDescription('Day (1-31)').setRequired(true)),
    ),

  async execute(interaction) {
    const subcommand = interaction.options.getSubcommand();
    const discordId = interaction.user.id;
    const botId = interaction.client.user?.id;
    const viewTarget = interaction.options.getUser('target');

    // Ensure the caller has a profile (and gets their starter kit), unless
    // this is just a "view" of the bot's own easter-egg profile.
    if (subcommand !== 'view' || viewTarget?.id !== botId) {
      await ensureUserExists(discordId, interaction.user.username);
    }

    if (subcommand === 'edit') {
      const newDesc = interaction.options.getString('description', true);
      await prisma.user.update({ where: { discordId }, data: { description: newDesc } });
      await interaction.reply({ content: '✅ Description updated!', flags: MessageFlags.Ephemeral });
      return;
    }

    if (subcommand === 'birthday') {
      const day = interaction.options.getInteger('day', true);
      const month = interaction.options.getInteger('month', true);
      await prisma.user.update({
        where: { discordId },
        data: { birthdayDay: day, birthdayMonth: month },
      });
      await interaction.reply({
        content: `🎂 Birthday set to **${month}/${day}**!`,
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    // subcommand === 'view'
    const target = viewTarget ?? interaction.user;

    if (target.id === botId) {
      const botEmbed = new EmbedBuilder()
        .setColor('#7300ff')
        .setTitle(`👑 ${target.username} (Me :D)`)
        .setThumbnail(target.displayAvatarURL())
        .setDescription('I do not earn Weekoins; I am the Weekoins.')
        .addFields(
          { name: `💰 Weekoins`, value: `${WEEKOIN_EMOJI} ∞ (1.79e+308)`, inline: true },
          { name: '⭐ Level', value: 'Lvl 999 (MAX)', inline: true },
          { name: '🎂 Birthday', value: '📅 27/1', inline: true },
          {
            name: RPG_TITLE_EMOJIS,
            value:
              '• **⚔︎:** God Slayer (∞ DMG)\n• **⛏:** World Breaker (∞ Luck)\n• **⛊:** Admin Cloak (∞ Armor)\n• **✪:** git push --force (+∞% everything)',
            inline: false,
          },
          { name: '🆔 ID', value: botId ?? 'Unknown', inline: false },
        )
        .setFooter({ text: 'Warning: Values too high for standard DB storage.' })
        .setTimestamp();

      await interaction.reply({ embeds: [botEmbed] });
      return;
    }

    const data = await prisma.user.findUnique({
      where: { discordId: target.id },
      include: { weapon: true, pickaxe: true, armor: true, trinket: true, dimension: true },
    });

    if (!data) {
      await interaction.reply({
        content: "That user doesn't have a profile yet!",
        flags: MessageFlags.Ephemeral,
      });
      return;
    }

    let totalDmg = data.baseDamage + (data.weapon?.mainStatValue ?? 0);
    let totalDef = data.baseDefense + (data.armor?.mainStatValue ?? 0);
    let totalLuck = data.baseLuck + (data.pickaxe?.mainStatValue ?? 0);
    const totalMagic = data.baseMagicDamage;
    let maxHp = data.baseHp + (data.level - 1);

    const trinketValue = data.trinket?.mainStatValue ?? 0;
    switch (data.trinket?.statModifierType) {
      case 'damage':
        totalDmg = Math.floor(totalDmg * (1 + trinketValue / 100));
        break;
      case 'defense':
        totalDef = Math.floor(totalDef * (1 + trinketValue / 100));
        break;
      case 'luck':
        totalLuck = Math.floor(totalLuck * (1 + trinketValue / 100));
        break;
      case 'health':
        maxHp = Math.floor(maxHp * (1 + trinketValue / 100));
        break;
    }

    const xpNeeded = getXpNeeded(data.level);
    const birthday = data.birthdayDay ? `📅 ${data.birthdayDay}/${data.birthdayMonth}` : 'Not set';

    const weaponDesc = data.weapon ? `${data.weapon.emoji} ${data.weapon.name} (+${data.weapon.mainStatValue})` : 'No weapon';
    const pickaxeDesc = data.pickaxe ? `${data.pickaxe.emoji} ${data.pickaxe.name} (+${data.pickaxe.mainStatValue})` : 'No pickaxe';
    const armorDesc = data.armor ? `${data.armor.emoji} ${data.armor.name} (+${data.armor.mainStatValue})` : 'No armor';
    const trinketDesc = data.trinket
      ? `${data.trinket.emoji} ${data.trinket.name} (+${data.trinket.mainStatValue}% ${data.trinket.statModifierType})`
      : 'No trinket';

    const embed = new EmbedBuilder()
      .setColor('#5865F2')
      .setTitle(`${STAR_DECOR_EMOJI} ${target.username}'s Profile ${STAR_DECOR_EMOJI}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(`About: ${data.description}`)
      .addFields(
        { name: '💰 Weekoins', value: `${WEEKOIN_EMOJI} ${data.weekoins.toLocaleString()}`, inline: true },
        {
          name: '⭐ Level',
          value: `Lvl **${data.level}**\n(${data.xp.toLocaleString()} / ${xpNeeded.toLocaleString()} XP)`,
          inline: true,
        },
        { name: '🎂 Birthday', value: birthday, inline: true },
        {
          name: RPG_TITLE_EMOJIS,
          value: `• **⚔︎:** ${weaponDesc}\n• **⛏:** ${pickaxeDesc}\n• **⛊:** ${armorDesc}\n• **✪:** ${trinketDesc}`,
          inline: true,
        },
        {
          name: '📊 Combat Stats',
          value:
            `❤️ **HP:** ${maxHp}\n` +
            `⚔️ **DMG:** ${totalDmg} / **MAGIC:** ${totalMagic}\n` +
            `🛡️ **DEF:** ${totalDef}\n` +
            `🍀 **LUCK:** ${totalLuck}`,
          inline: true,
        },
        { name: '​', value: '​', inline: true },
        {
          name: '📍 Location',
          value: `${data.dimension?.emoji ?? '🌍'} **${data.dimension?.name ?? 'Overworld'}**`,
          inline: true,
        },
        { name: '⚡ Energy', value: `${data.energy} / 100`, inline: true },
        { name: '🆔 ID', value: data.discordId, inline: true },
      )
      .setFooter({ text: 'Weekoo World' })
      .setTimestamp();

    await interaction.reply({ embeds: [embed] });
  },
};

export default command;
