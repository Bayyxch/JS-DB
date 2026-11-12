import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';

const userId = '55555555555555555';
let databasePath = '';
let db!: InstanceType<typeof Database>;
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-crops-'));
  databasePath = path.join(directory, 'test.sqlite');
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', databasePath);

  const database = await import('../src/db/database.js');
  db = database.db;
  database.runMigrations();
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(userId, 'CropTester');
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  if (databasePath) fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
});

describe('multi-crop farming and collection', () => {
  it('seeds multiple crop varieties with rarity tiers', () => {
    const catalog = economy.getCropCatalog();
    expect(catalog.map((crop) => crop.id)).toEqual(expect.arrayContaining(['basic', 'corn', 'pineapple', 'cacao']));
    expect(catalog.find((crop) => crop.id === 'cacao')?.rarity).toBe('rare');
  });

  it('plants, harvests, and records crop discoveries atomically', () => {
    economy.buyItem(userId, 'seed_corn', 2);
    const planted = economy.plant(userId, 'corn', 2);
    expect(planted.plantedPlots).toHaveLength(2);

    db.prepare('UPDATE farm_plots SET planted_at = ? WHERE user_id = ? AND crop_id = ?')
      .run(Date.now() - (5400 * 1000) - 1000, userId, 'corn');

    const result = economy.harvest(userId);
    expect(result.harvested).toBe(2);
    expect(result.items.some((item) => item.itemId === 'corn_ear')).toBe(true);
    expect(economy.getInventoryItem(userId, 'corn_ear')).toBeGreaterThanOrEqual(6);
    expect(economy.getInventoryItem(userId, 'corn_ear')).toBeLessThanOrEqual(12);

    const collection = economy.getCropCollection(userId);
    expect(collection).toHaveLength(1);
    expect(collection[0]?.crop_id).toBe('corn');
    expect(collection[0]?.harvested_total).toBe(2);
    expect(collection[0]?.rarity).toBe('uncommon');
  });
});
