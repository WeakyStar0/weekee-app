import { SlashCommandBuilder } from 'discord.js';
import type { Command } from '../../types';

const command: Command = {
  data: new SlashCommandBuilder().setName('ping').setDescription('Check bot latency.'),
  async execute(interaction) {
    await interaction.reply(`Pong. Latency: ${interaction.client.ws.ping}ms`);
  },
};

export default command;
