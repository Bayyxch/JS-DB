import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';

const sellerId = '99999999999999991';
const buyerId = '99999999999999992';
let databasePath = '';
let db!: InstanceType<typeof Database>;
let market!: typeof import('../src/services/market.service.js');
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-market-'));
  databasePath = path.join(directory, 'test.sqlite');
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', databasePath);
  const database = await import('../src/db/database.js');
  db = database.db;
  database.runMigrations();
  economy = await import('../src/services/economy.service.js');
  market = await import('../src/services/market.service.js');
  economy.ensureUser(sellerId, 'Seller');
  economy.ensureUser(buyerId, 'Buyer');
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  if (databasePath) fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
});

describe('global escrow marketplace', () => {
  it('escrows items and supports partial purchases with seller payouts', () => {
    const listing = market.createMarketListing(sellerId, 'seed_basic', 2, 500);
    expect(economy.getInventoryItem(sellerId, 'seed_basic')).toBe(6);
    expect(market.getMarketListings()).toHaveLength(1);

    const first = market.buyMarketListing(buyerId, listing.listingId, 1);
    expect(first.total).toBe(500);
    expect(first.remaining).toBe(1);
    expect(first.buyerBalance).toBe(2000);
    expect(first.sellerBalance).toBe(3000);
    expect(economy.getInventoryItem(buyerId, 'seed_basic')).toBe(1);

    const second = market.buyMarketListing(buyerId, listing.listingId, 1);
    expect(second.remaining).toBe(0);
    expect(market.getMarketListings()).toHaveLength(0);
    expect(economy.getInventoryItem(buyerId, 'seed_basic')).toBe(2);
  });

  it('prevents self-purchases and rolls back failed transactions', () => {
    const listing = market.createMarketListing(sellerId, 'seed_basic', 1, 1_000_000_000);
    expect(() => market.buyMarketListing(sellerId, listing.listingId, 1)).toThrow('MARKET_SELF_PURCHASE');
    expect(() => market.buyMarketListing(buyerId, listing.listingId, 1)).toThrow('INSUFFICIENT_FUNDS');
    expect(market.getMarketListings().find((entry) => entry.id === listing.listingId)?.quantity).toBe(1);
    const cancelled = market.cancelMarketListing(sellerId, listing.listingId);
    expect(cancelled.quantity).toBe(1);
    expect(economy.getInventoryItem(sellerId, 'seed_basic')).toBe(6);
  });

  it('rejects cancellation by a non-owner', () => {
    const listing = market.createMarketListing(sellerId, 'seed_basic', 1, 100);
    expect(() => market.cancelMarketListing(buyerId, listing.listingId)).toThrow('MARKET_NOT_OWNER');
    market.cancelMarketListing(sellerId, listing.listingId);
  });
});
