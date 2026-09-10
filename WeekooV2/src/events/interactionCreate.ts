import { Events, MessageFlags } from 'discord.js';
import type { BotEvent } from '../types';
import type { ExtendedClient } from '../structures/ExtendedClient';

const event: BotEvent = {
  name: Events.InteractionCreate,
  async execute(interaction) {
    const client = interaction.client as ExtendedClient;

    if (interaction.isAutocomplete()) {
      const command = client.commands.get(interaction.commandName);
      if (!command?.autocomplete) return;
      try {
        await command.autocomplete(interaction);
      } catch (error) {
        console.error(`Error in autocomplete for "${interaction.commandName}":`, error);
      }
      return;
    }

    if (!interaction.isChatInputCommand()) return;

    const command = client.commands.get(interaction.commandName);
    if (!command) return;

    try {
      await command.execute(interaction);
    } catch (error) {
      console.error(`Error executing command "${interaction.commandName}":`, error);
      const reply = { content: 'Command failed to run.', flags: MessageFlags.Ephemeral };
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp(reply);
      } else {
        await interaction.reply(reply);
      }
    }
  },
};

export default event;
