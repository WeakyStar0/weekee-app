import { ActivityType, Events } from 'discord.js';
import type { BotEvent } from '../types';
import type { ExtendedClient } from '../structures/ExtendedClient';

const event: BotEvent = {
  name: Events.ClientReady,
  once: true,
  execute(client: ExtendedClient) {
    console.log(`Logged in as ${client.user?.tag}.`);
    client.user?.setPresence({
      activities: [{ name: 'Weekoo V2 — rebuilding', type: ActivityType.Watching }],
      status: 'online',
    });
  },
};

export default event;
