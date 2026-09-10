import 'dotenv/config';
import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './structures/ExtendedClient';

const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function main() {
  await client.loadCommands();
  await client.loadEvents();
  await client.login(process.env.BOT_TOKEN);
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
