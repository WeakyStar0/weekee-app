import 'dotenv/config';
import { GatewayIntentBits } from 'discord.js';
import { ExtendedClient } from './structures/ExtendedClient';
import { prisma } from './lib/prisma';

const client = new ExtendedClient({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildVoiceStates,
  ],
});

async function main() {
  // inAdventure only means anything while a live process is actively running
  // that session's loop — if the bot just started, nobody can actually be
  // mid-adventure, however the DB flag reads (crash/restart/manual stop all
  // skip the loop's `finally` cleanup). Clear it so no one gets stuck.
  const { count } = await prisma.user.updateMany({ where: { inAdventure: true }, data: { inAdventure: false } });
  if (count > 0) {
    console.log(`Cleared stale inAdventure flag for ${count} user(s) from a previous session.`);
  }

  await client.loadCommands();
  await client.loadEvents();
  await client.login(process.env.BOT_TOKEN);
}

main().catch((error) => {
  console.error('Fatal error during startup:', error);
  process.exit(1);
});
