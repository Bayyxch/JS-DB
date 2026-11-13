import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const sellerA = '12121212121212121';
const sellerB = '23232323232323232';
let database!: { close: () => void; prepare: (sql: string) => { run: (...args: unknown[]) => void } };
let tempDirectory = '';
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-market-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db as unknown as typeof database;
  databaseModule.runMigrations();
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(sellerA, 'SellerA');
  economy.ensureUser(sellerB, 'SellerB');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('global dynamic commodity market', () => {
  it('pays the current global price and adjusts future price from total supply', () => {
    database.prepare("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, 'tbs', 5000)")
      .run(sellerA);
    const first = economy.sellItem(sellerA, 'tbs', 5000);
    expect(first.unitPrice).toBe(70);
    expect(first.total).toBe(350000);
    expect(first.nextMarketPrice).toBe(42);

    database.prepare("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, 'tbs', 1)")
      .run(sellerB);
    const second = economy.sellItem(sellerB, 'tbs', 1);
    expect(second.unitPrice).toBe(42);
    expect(second.total).toBe(42);
  });

  it('shows global prices and records price changes', () => {
    const prices = economy.getMarketPrices();
    const tbs = prices.find((item) => item.item_id === 'tbs');
    expect(tbs?.current_price).toBe(42);
    expect(tbs?.daily_volume).toBe(5001);
    const history = economy.getMarketHistory('tbs');
    expect(history.length).toBeGreaterThan(0);
    expect(history[0]?.price).toBe(42);
  });

  it('resets daily volume and restores the base price on a new market day', () => {
    database.prepare("UPDATE market_prices SET day_key = '2000-01-01' WHERE item_id = 'tbs'").run();
    const prices = economy.getMarketPrices();
    const tbs = prices.find((item) => item.item_id === 'tbs');
    expect(tbs?.current_price).toBe(70);
    expect(tbs?.daily_volume).toBe(0);
  });
});
