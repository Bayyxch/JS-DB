import { Client, GatewayIntentBits } from 'discord.js';
import { config } from './config/env.js';
import { runMigrations, db } from './db/database.js';
import type { Command } from './types/command.js';
import { ensureUser } from './services/economy.service.js';
import { consumeCooldown } from './services/cooldown.service.js';
import { errorEmbed } from './utils/embed.js';
import { friendlyError } from './utils/errors.js';
import { logger } from './utils/logger.js';
import { balanceCommand } from './commands/balance.js';
import { inventoryCommand } from './commands/inventory.js';
import { shopCommand } from './commands/shop.js';
import { buyCommand } from './commands/buy.js';
import { sellCommand } from './commands/sell.js';
import { tanamCommand } from './commands/tanam.js';
import { panenCommand } from './commands/panen.js';
import { luasCommand } from './commands/luasin.js';
import { kebunCommand } from './commands/kebun.js';
import { dailyCommand } from './commands/daily.js';
import { workCommand } from './commands/work.js';
import { leaderboardCommand } from './commands/leaderboard.js';
import { statusCommand } from './commands/status.js';
import { economyCommand } from './commands/economy.js';
import { pingCommand } from './commands/ping.js';
import { profileCommand } from './commands/profil.js';
import { friendCommand } from './commands/teman.js';
import { createHelpCommand } from './commands/help.js';

runMigrations();

const client = new Client({
  intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent],
});

const baseCommands: Command[] = [
  pingCommand,
  profileCommand,
  friendCommand,
  balanceCommand,
  kebunCommand,
  statusCommand,
  economyCommand,
  inventoryCommand,
  shopCommand,
  buyCommand,
  sellCommand,
  tanamCommand,
  panenCommand,
  luasCommand,
  dailyCommand,
  workCommand,
  leaderboardCommand,
];

const commands: Command[] = [createHelpCommand(baseCommands), ...baseCommands];
const commandMap = new Map<string, Command>();
for (const command of commands) {
  commandMap.set(command.name, command);
  for (const alias of command.aliases ?? []) commandMap.set(alias, command);
}

client.once('ready', () => {
  logger.info(`Logged in as ${client.user?.tag ?? 'unknown'} in ${client.guilds.cache.size} guild(s).`);
});

client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  const content = message.content.trim();
  if (!content.startsWith(config.prefix)) return;

  const body = content.slice(config.prefix.length).trim();
  if (!body) return;

  const parts = body.split(/\s+/);
  const commandName = parts.shift()?.toLowerCase();
  if (!commandName) return;

  const command = commandMap.get(commandName);
  if (!command) return;

  try {
    // Create the global account before applying a persistent user-scoped cooldown.
    ensureUser(message.author.id, message.author.username);

    const cooldownMs = command.cooldownMs ?? 0;
    if (cooldownMs > 0) {
      const cooldown = consumeCooldown(
        message.author.id,
        `command:${command.name}`,
        cooldownMs,
      );
      if (!cooldown.allowed) {
        const remaining = Math.ceil((cooldown.availableAt - Date.now()) / 1000);
        await message.reply({
          embeds: [errorEmbed('Tunggu dulu', `Command ini bisa dipakai lagi dalam ${Math.max(1, remaining)} detik.`)],
        });
        return;
      }
    }

    await command.execute({
      message,
      userId: message.author.id,
      username: message.author.username,
      args: parts,
    });
  } catch (error) {
    logger.error(`Command ${command.name} failed for ${message.author.id}`, error);
    await message.reply({ embeds: [errorEmbed('Terjadi error', friendlyError(error))] }).catch(() => undefined);
  }
});

function shutdown(signal: string): void {
  logger.info(`Received ${signal}; shutting down...`);
  client.destroy();
  db.close();
  process.exit(0);
}

process.once('SIGINT', () => shutdown('SIGINT'));
process.once('SIGTERM', () => shutdown('SIGTERM'));

client.login(config.token).catch((error) => {
  logger.error('Discord login failed. Check DISCORD_TOKEN and bot configuration.', error);
  db.close();
  process.exitCode = 1;
});
