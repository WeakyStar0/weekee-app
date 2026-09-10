import 'dotenv/config';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { REST, Routes } from 'discord.js';
import type { Command } from './types';

async function main() {
  const commands: object[] = [];
  const commandsPath = path.join(__dirname, 'commands');
  const categories = fs.readdirSync(commandsPath);

  for (const category of categories) {
    const categoryPath = path.join(commandsPath, category);
    const files = fs.readdirSync(categoryPath).filter((f) => f.endsWith('.ts') || f.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(categoryPath, file);
      const imported = await import(pathToFileURL(filePath).href);
      const command: Command = imported.default ?? imported;
      if ('data' in command) commands.push(command.data.toJSON());
    }
  }

  const { BOT_TOKEN, CLIENT_ID, GUILD_ID } = process.env;
  if (!BOT_TOKEN || !CLIENT_ID) {
    throw new Error('BOT_TOKEN and CLIENT_ID must be set in .env');
  }

  const rest = new REST().setToken(BOT_TOKEN);

  if (GUILD_ID) {
    // Guild-scoped: instant propagation. Use for dev.
    await rest.put(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID), { body: commands });
    console.log(`Deployed ${commands.length} commands to guild ${GUILD_ID}.`);
  } else {
    // Global: up to ~1hr propagation. Use for production rollout.
    await rest.put(Routes.applicationCommands(CLIENT_ID), { body: commands });
    console.log(`Deployed ${commands.length} commands globally.`);
  }
}

main().catch((error) => {
  console.error('Failed to deploy commands:', error);
  process.exit(1);
});
