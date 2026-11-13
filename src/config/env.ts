import 'dotenv/config';
import { validateEconomyConfig, validatePrefix } from './validation.js';

function required(name: string): string {
  const value = process.env[name]?.trim();
  if (!value) throw new Error(`Missing required environment variable: ${name}`);
  return value;
}

function intEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw new Error(`${name} must be a safe integer`);
  return value;
}

function floatEnv(name: string, fallback: number): number {
  const raw = process.env[name]?.trim();
  if (!raw) return fallback;
  const value = Number(raw);
  if (!Number.isFinite(value)) throw new Error(`${name} must be a finite number`);
  return value;
}

function emojiEnv(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

const prefix = process.env.PREFIX?.trim() || '!';
validatePrefix(prefix);

// Plant growth is deliberately capped: this is a Discord economy loop, not a
// real-time farming simulator. Keep custom deployments between 1 and 30 minutes.
const basicGrowMinutes = Math.min(intEnv('BASIC_GROW_MINUTES', 10), 30);

const economy = {
  startingBalance: intEnv('STARTING_BALANCE', 2500),
  startingSeeds: intEnv('STARTING_SEEDS', 8),
  startingPlots: intEnv('STARTING_PLOTS', 4),
  basicSeedPrice: intEnv('BASIC_SEED_PRICE', 300),
  basicGrowMinutes,
  basicMinYield: intEnv('BASIC_MIN_YIELD', 6),
  basicMaxYield: intEnv('BASIC_MAX_YIELD', 8),
  tbsSellPrice: intEnv('TBS_SELL_PRICE', 70),
  firstLandCost: intEnv('FIRST_LAND_COST', 12000),
  landCostMultiplier: floatEnv('LAND_COST_MULTIPLIER', 1.32),
  maxPlots: intEnv('MAX_PLOTS', 100),
  workMinReward: intEnv('WORK_MIN_REWARD', 100),
  workMaxReward: intEnv('WORK_MAX_REWARD', 180),
  workCooldownMinutes: intEnv('WORK_COOLDOWN_MINUTES', 120),
  dailyReward: intEnv('DAILY_REWARD', 250),
  dailyCooldownHours: intEnv('DAILY_COOLDOWN_HOURS', 24),
};

validateEconomyConfig(economy);

export const config = {
  token: required('DISCORD_TOKEN'),
  guildId: process.env.DISCORD_GUILD_ID?.trim() || null,
  databasePath: process.env.DATABASE_PATH?.trim() || './data/sawit.sqlite',
  prefix,
  economy,
  emoji: {
    palm: emojiEnv('EMOJI_PALM', '[PALM]'),
    coin: emojiEnv('EMOJI_COIN', '[COIN]'),
    tbs: emojiEnv('EMOJI_TBS', '[TBS]'),
    seed: emojiEnv('EMOJI_SEED', '[SEED]'),
    land: emojiEnv('EMOJI_LAND', '[LAND]'),
    tool: emojiEnv('EMOJI_TOOL', '[TOOL]'),
    success: emojiEnv('EMOJI_SUCCESS', '[OK]'),
    warning: emojiEnv('EMOJI_WARNING', '[WARN]'),
    factory: emojiEnv('EMOJI_FACTORY', '[FACTORY]'),
  },
} as const;
