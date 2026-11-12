import type Database from 'better-sqlite3';
import { config } from '../config/env.js';

export interface Migration {
  version: number;
  name: string;
  up: (db: InstanceType<typeof Database>) => void;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: 'initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS users (
          id TEXT PRIMARY KEY,
          username TEXT NOT NULL,
          created_at INTEGER NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS wallets (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
        );
        CREATE TABLE IF NOT EXISTS items (
          id TEXT PRIMARY KEY, name TEXT NOT NULL, type TEXT NOT NULL,
          buy_price INTEGER NOT NULL DEFAULT 0 CHECK (buy_price >= 0),
          sell_price INTEGER NOT NULL DEFAULT 0 CHECK (sell_price >= 0),
          description TEXT NOT NULL DEFAULT ''
        );
        CREATE TABLE IF NOT EXISTS inventory (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          quantity INTEGER NOT NULL DEFAULT 0 CHECK (quantity >= 0),
          PRIMARY KEY (user_id, item_id)
        );
        CREATE TABLE IF NOT EXISTS crops (
          id TEXT PRIMARY KEY, name TEXT NOT NULL,
          seed_item_id TEXT NOT NULL REFERENCES items(id),
          grow_seconds INTEGER NOT NULL CHECK (grow_seconds > 0),
          min_yield INTEGER NOT NULL CHECK (min_yield > 0),
          max_yield INTEGER NOT NULL CHECK (max_yield >= min_yield),
          sell_item_id TEXT NOT NULL REFERENCES items(id)
        );
        CREATE TABLE IF NOT EXISTS farm_plots (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          plot_index INTEGER NOT NULL CHECK (plot_index > 0),
          crop_id TEXT REFERENCES crops(id), planted_at INTEGER,
          PRIMARY KEY (user_id, plot_index)
        );
        CREATE TABLE IF NOT EXISTS cooldowns (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          action TEXT NOT NULL, available_at INTEGER NOT NULL,
          PRIMARY KEY (user_id, action)
        );
        CREATE TABLE IF NOT EXISTS daily_claims (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          last_claimed_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS transactions (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          type TEXT NOT NULL, amount INTEGER NOT NULL,
          balance_before INTEGER NOT NULL, balance_after INTEGER NOT NULL,
          metadata TEXT NOT NULL DEFAULT '{}', created_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_farm_plots_user ON farm_plots(user_id);
        CREATE INDEX IF NOT EXISTS idx_farm_plots_crop ON farm_plots(crop_id);
        CREATE INDEX IF NOT EXISTS idx_inventory_user ON inventory(user_id);
        CREATE INDEX IF NOT EXISTS idx_transactions_user_time ON transactions(user_id, created_at DESC);
        CREATE INDEX IF NOT EXISTS idx_transactions_type_time ON transactions(type, created_at DESC);
        INSERT OR IGNORE INTO items (id, name, type, buy_price, sell_price, description)
        VALUES
          ('seed_basic', 'Bibit Sawit Basic', 'SEED', ${config.economy.basicSeedPrice}, 0, 'Bibit sawit standar untuk kebun pemula.'),
          ('tbs', 'Tandan Buah Segar', 'RESOURCE', 0, ${config.economy.tbsSellPrice}, 'Hasil panen sawit yang bisa dijual.');
        INSERT OR IGNORE INTO crops (id, name, seed_item_id, grow_seconds, min_yield, max_yield, sell_item_id)
        VALUES
          ('basic', 'Sawit Basic', 'seed_basic', ${config.economy.basicGrowMinutes * 60}, ${config.economy.basicMinYield}, ${config.economy.basicMaxYield}, 'tbs');
      `);
    },
  },
  {
    version: 2,
    name: 'global_profiles_and_friendships',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS player_profiles (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          bio TEXT NOT NULL DEFAULT '',
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS friend_requests (
          sender_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          receiver_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (sender_id, receiver_id),
          CHECK (sender_id <> receiver_id)
        );
        CREATE INDEX IF NOT EXISTS idx_friend_requests_receiver
          ON friend_requests(receiver_id, created_at ASC);
        CREATE TABLE IF NOT EXISTS friendships (
          user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (user_low, user_high),
          CHECK (user_low < user_high)
        );
        CREATE INDEX IF NOT EXISTS idx_friendships_high ON friendships(user_high);
      `);
      db.prepare('INSERT OR IGNORE INTO player_profiles (user_id, bio, updated_at) SELECT id, \'\', updated_at FROM users').run();
    },
  },
];
