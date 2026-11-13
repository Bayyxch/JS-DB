import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const proposer = '34343434343434343';
const target = '45454545454545454';
const stranger = '56565656565656565';
let database!: { close: () => void; prepare: (sql: string) => { run: (...args: unknown[]) => void } };
let tempDirectory = '';
let trades!: typeof import('../src/services/trade.service.js');
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-trades-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db as unknown as typeof database;
  databaseModule.runMigrations();
  trades = await import('../src/services/trade.service.js');
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(proposer, 'Proposer');
  economy.ensureUser(target, 'Target');
  economy.ensureUser(stranger, 'Stranger');
  database.prepare("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, 'tbs', 10)")
    .run(target);
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('global escrowed player trades', () => {
  it('reserves the offered item and transfers both sides only on acceptance', () => {
    const targetSeedsBefore = economy.getInventoryItem(target, 'seed_basic');
    const offerId = trades.createTradeOffer(proposer, target, 'seed_basic', 2, 'tbs', 5);
    expect(economy.getInventoryItem(proposer, 'seed_basic')).toBe(6);
    expect(() => trades.acceptTradeOffer(stranger, offerId)).toThrow('TRADE_NOT_YOURS');
    trades.acceptTradeOffer(target, offerId);
    expect(economy.getInventoryItem(target, 'seed_basic')).toBe(targetSeedsBefore + 2);
    expect(economy.getInventoryItem(target, 'tbs')).toBe(5);
    expect(economy.getInventoryItem(proposer, 'tbs')).toBe(5);
  });

  it('returns escrow when the proposer cancels an offer', () => {
    const before = economy.getInventoryItem(proposer, 'seed_basic');
    const offerId = trades.createTradeOffer(proposer, target, 'seed_basic', 1, 'corn', 1);
    expect(economy.getInventoryItem(proposer, 'seed_basic')).toBe(before - 1);
    expect(() => trades.cancelTradeOffer(target, offerId)).toThrow('TRADE_NOT_YOURS');
    trades.cancelTradeOffer(proposer, offerId);
    expect(economy.getInventoryItem(proposer, 'seed_basic')).toBe(before);
  });

  it('refunds escrow when an offer expires', () => {
    const timestamp = 1_700_000_000_000;
    const before = economy.getInventoryItem(proposer, 'seed_basic');
    const offerId = trades.createTradeOffer(proposer, target, 'seed_basic', 1, 'rice', 1, timestamp);
    expect(economy.getInventoryItem(proposer, 'seed_basic')).toBe(before - 1);
    expect(trades.listTradeOffers(target, timestamp + 48 * 60 * 60 * 1000 + 1)).toHaveLength(0);
    expect(economy.getInventoryItem(proposer, 'seed_basic')).toBe(before);
    expect(() => trades.acceptTradeOffer(target, offerId, timestamp + 48 * 60 * 60 * 1000 + 2)).toThrow('TRADE_NOT_FOUND');
  });

  it('rejects invalid self and same-item trades', () => {
    expect(() => trades.createTradeOffer(proposer, proposer, 'seed_basic', 1, 'tbs', 1)).toThrow('TRADE_SELF');
    expect(() => trades.createTradeOffer(proposer, target, 'tbs', 1, 'tbs', 2)).toThrow('TRADE_SAME_ITEM');
  });

  it('limits each player to five active outgoing offers', () => {
    const ids = Array.from({ length: 5 }, () =>
      trades.createTradeOffer(proposer, target, 'seed_basic', 1, 'corn', 1),
    );
    expect(() => trades.createTradeOffer(proposer, target, 'seed_basic', 1, 'rice', 1)).toThrow('TRADE_LIMIT');
    for (const id of ids) trades.cancelTradeOffer(proposer, id);
  });
});
