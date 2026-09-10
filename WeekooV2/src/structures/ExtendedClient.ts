import { Client, ClientOptions, Collection } from 'discord.js';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import type { Command, BotEvent } from '../types';

export class ExtendedClient extends Client {
  commands = new Collection<string, Command>();

  constructor(options: ClientOptions) {
    super(options);
  }

  async loadCommands(): Promise<void> {
    const commandsPath = path.join(__dirname, '..', 'commands');
    const categories = fs.readdirSync(commandsPath);

    for (const category of categories) {
      const categoryPath = path.join(commandsPath, category);
      const files = fs
        .readdirSync(categoryPath)
        .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

      for (const file of files) {
        const filePath = path.join(categoryPath, file);
        const imported = await import(pathToFileURL(filePath).href);
        const command: Command = imported.default ?? imported;

        if ('data' in command && 'execute' in command) {
          this.commands.set(command.data.name, command);
        } else {
          console.warn(`[WARN] Command at ${filePath} missing "data" or "execute".`);
        }
      }
    }

    console.log(`Loaded ${this.commands.size} commands.`);
  }

  async loadEvents(): Promise<void> {
    const eventsPath = path.join(__dirname, '..', 'events');
    const files = fs
      .readdirSync(eventsPath)
      .filter((file) => file.endsWith('.ts') || file.endsWith('.js'));

    for (const file of files) {
      const filePath = path.join(eventsPath, file);
      const imported = await import(pathToFileURL(filePath).href);
      const event: BotEvent = imported.default ?? imported;

      if (event.once) {
        this.once(event.name, (...args) => event.execute(...args));
      } else {
        this.on(event.name, (...args) => event.execute(...args));
      }
    }

    console.log(`Loaded ${files.length} events.`);
  }
}
