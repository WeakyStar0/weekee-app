import { SlashCommandBuilder, EmbedBuilder, version as djsVersion } from 'discord.js';
import os from 'node:os';
import type { Command } from '../../types';
import { prisma } from '../../lib/prisma';

function formatUptime(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor(totalSeconds / 3600) % 24;
  const minutes = Math.floor(totalSeconds / 60) % 60;
  const seconds = totalSeconds % 60;
  return `${days}d ${hours}h ${minutes}m ${seconds}s`;
}

function toMB(bytes: number): string {
  return (bytes / 1024 / 1024).toFixed(2);
}

function toGB(bytes: number): string {
  return (bytes / 1024 / 1024 / 1024).toFixed(2);
}

interface DbStatsRow {
  version: string;
  db_size: string;
}

const command: Command = {
  data: new SlashCommandBuilder()
    .setName('botinfo')
    .setDescription('Show hardware, software, and runtime info for the bot.'),

  async execute(interaction) {
    await interaction.deferReply();

    const uptimeString = formatUptime(interaction.client.uptime ?? 0);
    const apiPing = Math.round(interaction.client.ws.ping);
    const botPing = Date.now() - interaction.createdTimestamp;

    const usage = process.memoryUsage();
    const cpus = os.cpus();
    const loadAvg = os
      .loadavg()
      .map((l) => l.toFixed(2))
      .join(', ');

    let dbVersion = 'Unknown';
    let dbSize = 'Unknown';
    let userCount = 0;
    let dbLatency = -1;

    const dbStart = Date.now();
    try {
      const [row] = await prisma.$queryRaw<DbStatsRow[]>`
        SELECT version(), pg_size_pretty(pg_database_size(current_database())) as db_size
      `;
      dbVersion = row.version.split(' ')[1] ?? row.version;
      dbSize = row.db_size;
      userCount = await prisma.user.count();
      dbLatency = Date.now() - dbStart;
    } catch (error) {
      console.error('botinfo: DB stats query failed:', error);
    }

    const embed = new EmbedBuilder()
      .setColor('#7300ff')
      .setTitle('Weekoo Technical Dashboard')
      .setThumbnail(interaction.client.user?.displayAvatarURL() ?? null)
      .addFields(
        {
          name: 'Bot',
          value:
            `**Tag:** ${interaction.client.user?.tag}\n` +
            `**Guilds:** ${interaction.client.guilds.cache.size}\n` +
            `**Uptime:** \`${uptimeString}\``,
          inline: true,
        },
        {
          name: 'Latency',
          value:
            `**API:** \`${apiPing}ms\`\n` +
            `**Bot:** \`${botPing}ms\`\n` +
            `**DB:** \`${dbLatency >= 0 ? `${dbLatency}ms` : 'n/a'}\``,
          inline: true,
        },
        {
          name: 'Database (Postgres)',
          value:
            `**Version:** \`${dbVersion}\`\n` +
            `**Size:** \`${dbSize}\`\n` +
            `**Users registered:** \`${userCount}\``,
          inline: true,
        },
        {
          name: 'Hardware & OS',
          value:
            `**OS:** \`${os.type()} ${os.arch()}\`\n` +
            `**CPU:** \`${cpus[0]?.model ?? 'Unknown'}\` (${cpus.length} cores)\n` +
            `**Load avg:** \`${loadAvg}\``,
          inline: false,
        },
        {
          name: 'Memory',
          value:
            `**Process heap:** \`${toMB(usage.heapUsed)} MB\`\n` +
            `**RSS:** \`${toMB(usage.rss)} MB\`\n` +
            `**System free:** \`${toGB(os.freemem())} GB\` / \`${toGB(os.totalmem())} GB\``,
          inline: true,
        },
        {
          name: 'Runtime',
          value:
            `**Node.js:** \`${process.version}\`\n` +
            `**discord.js:** \`v${djsVersion}\`\n` +
            `**Hostname:** \`${os.hostname()}\``,
          inline: true,
        },
      )
      .setFooter({ text: 'Weekoo V2' })
      .setTimestamp();

    await interaction.editReply({ embeds: [embed] });
  },
};

export default command;
