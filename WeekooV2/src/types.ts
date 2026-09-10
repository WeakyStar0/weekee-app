import type {
  AutocompleteInteraction,
  ChatInputCommandInteraction,
  SlashCommandBuilder,
  SlashCommandOptionsOnlyBuilder,
  SlashCommandSubcommandsOnlyBuilder,
} from 'discord.js';

export type CommandData =
  | SlashCommandBuilder
  | SlashCommandOptionsOnlyBuilder
  | SlashCommandSubcommandsOnlyBuilder;

export interface Command {
  data: CommandData;
  execute: (interaction: ChatInputCommandInteraction) => Promise<void>;
  /** Optional — only needed if a command option has `.setAutocomplete(true)`. */
  autocomplete?: (interaction: AutocompleteInteraction) => Promise<void>;
}

export interface BotEvent {
  name: string;
  once?: boolean;
  execute: (...args: any[]) => Promise<void> | void;
}
