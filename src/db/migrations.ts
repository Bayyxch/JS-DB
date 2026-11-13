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
  {
    version: 3,
    name: 'global_marriages_and_bond_progression',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS marriage_proposals (
          proposer_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          PRIMARY KEY (proposer_id, target_id),
          CHECK (proposer_id <> target_id)
        );
        CREATE INDEX IF NOT EXISTS idx_marriage_proposals_target
          ON marriage_proposals(target_id, created_at ASC);
        CREATE TABLE IF NOT EXISTS marriages (
          user_low TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          user_high TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          married_at INTEGER NOT NULL,
          bond_points INTEGER NOT NULL DEFAULT 0 CHECK (bond_points >= 0),
          last_bond_claim_at INTEGER,
          PRIMARY KEY (user_low, user_high),
          CHECK (user_low < user_high)
        );
        CREATE TRIGGER IF NOT EXISTS trg_marriages_one_partner
        BEFORE INSERT ON marriages
        BEGIN
          SELECT CASE WHEN EXISTS (
            SELECT 1 FROM marriages
            WHERE user_low IN (NEW.user_low, NEW.user_high)
               OR user_high IN (NEW.user_low, NEW.user_high)
          ) THEN RAISE(ABORT, 'MARRIAGE_ALREADY_MARRIED') END;
        END;
        CREATE INDEX IF NOT EXISTS idx_marriages_high ON marriages(user_high);
      `);
    },
  },
  {
    version: 4,
    name: 'diverse_crops_and_global_collection',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS crop_discoveries (
          user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          crop_id TEXT NOT NULL REFERENCES crops(id) ON DELETE CASCADE,
          first_harvested_at INTEGER NOT NULL,
          total_harvested INTEGER NOT NULL DEFAULT 0 CHECK (total_harvested >= 0),
          PRIMARY KEY (user_id, crop_id)
        );
        CREATE INDEX IF NOT EXISTS idx_crop_discoveries_user ON crop_discoveries(user_id);
        INSERT OR IGNORE INTO items (id, name, type, buy_price, sell_price, description)
        VALUES
          ('seed_corn', 'Bibit Jagung', 'SEED', 180, 0, 'Bibit jagung untuk diversifikasi kebun.'),
          ('corn', 'Jagung Pipil', 'RESOURCE', 0, 42, 'Hasil panen jagung.'),
          ('seed_rice', 'Bibit Padi', 'SEED', 220, 0, 'Bibit padi untuk lahan pertanian.'),
          ('rice', 'Gabah', 'RESOURCE', 0, 48, 'Hasil panen padi.'),
          ('seed_cocoa', 'Bibit Kakao', 'SEED', 450, 0, 'Bibit kakao dengan masa tumbuh lebih lama.'),
          ('cocoa', 'Buah Kakao', 'RESOURCE', 0, 105, 'Hasil panen buah kakao.');
        INSERT OR IGNORE INTO crops (id, name, seed_item_id, grow_seconds, min_yield, max_yield, sell_item_id)
        VALUES
          ('corn', 'Jagung', 'seed_corn', 7200, 5, 9, 'corn'),
          ('rice', 'Padi', 'seed_rice', 10800, 7, 12, 'rice'),
          ('cocoa', 'Kakao', 'seed_cocoa', 28800, 4, 7, 'cocoa');
      `);
    },
  },
  {
    version: 5,
    name: 'global_companies_and_cooperative_progress',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS companies (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL COLLATE NOCASE UNIQUE,
          owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          total_harvested INTEGER NOT NULL DEFAULT 0 CHECK (total_harvested >= 0),
          created_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS company_members (
          user_id TEXT PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          role TEXT NOT NULL DEFAULT 'MEMBER' CHECK (role IN ('OWNER', 'MEMBER')),
          joined_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_company_members_company
          ON company_members(company_id, joined_at ASC);
        CREATE TABLE IF NOT EXISTS company_invites (
          company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
          target_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          inviter_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
          created_at INTEGER NOT NULL,
          expires_at INTEGER NOT NULL,
          PRIMARY KEY (company_id, target_id)
        );
        CREATE INDEX IF NOT EXISTS idx_company_invites_target
          ON company_invites(target_id, expires_at ASC);
      `);
    },
  },
  {
    version: 6,
    name: 'global_dynamic_market',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS market_prices (
          item_id TEXT PRIMARY KEY REFERENCES items(id) ON DELETE CASCADE,
          base_price INTEGER NOT NULL CHECK (base_price > 0),
          current_price INTEGER NOT NULL CHECK (current_price > 0),
          previous_price INTEGER NOT NULL CHECK (previous_price > 0),
          floor_price INTEGER NOT NULL CHECK (floor_price > 0),
          ceiling_price INTEGER NOT NULL CHECK (ceiling_price >= floor_price),
          target_daily_volume INTEGER NOT NULL CHECK (target_daily_volume > 0),
          daily_volume INTEGER NOT NULL DEFAULT 0 CHECK (daily_volume >= 0),
          day_key TEXT NOT NULL,
          updated_at INTEGER NOT NULL
        );
        CREATE TABLE IF NOT EXISTS market_price_history (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          item_id TEXT NOT NULL REFERENCES items(id) ON DELETE CASCADE,
          price INTEGER NOT NULL CHECK (price > 0),
          daily_volume INTEGER NOT NULL CHECK (daily_volume >= 0),
          recorded_at INTEGER NOT NULL
        );
        CREATE INDEX IF NOT EXISTS idx_market_history_item_time
          ON market_price_history(item_id, recorded_at DESC);
        INSERT OR IGNORE INTO market_prices
          (item_id, base_price, current_price, previous_price, floor_price, ceiling_price, target_daily_volume, daily_volume, day_key, updated_at)
        SELECT id, sell_price, sell_price, sell_price,
          MAX(1, CAST(sell_price * 0.60 AS INTEGER)), sell_price,
          CASE id
            WHEN 'tbs' THEN 5000
            WHEN 'corn' THEN 2500
            WHEN 'rice' THEN 3000
            WHEN 'cocoa' THEN 1500
            ELSE 2000
          END,
          0, strftime('%Y-%m-%d', 'now'), CAST(strftime('%s', 'now') AS INTEGER) * 1000
        FROM items WHERE sell_price > 0;
      `);
    },
  },
];
