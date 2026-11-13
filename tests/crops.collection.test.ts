import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const player = '66666666666666666';
let database!: { close: () => void };
let tempDirectory = '';
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-crops-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db;
  databaseModule.runMigrations();
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(player, 'CropTester');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('palm-only crop collection', () => {
  it('keeps the active crop catalog focused on palm', () => {
    const catalog = economy.getCropCollection(player);
    expect(catalog.map((crop) => crop.crop_id)).toEqual(['basic']);
    expect(catalog.every((crop) => crop.discovered === 0)).toBe(true);
  });

  it('records palm discovery and cumulative TBS yield when harvested', () => {
    economy.buyItem(player, 'seed_basic', 1);
    economy.plant(player, 'basic', 1);
    const db = database as unknown as { prepare: (sql: string) => { run: (...args: unknown[]) => void } };
    db.prepare('UPDATE farm_plots SET planted_at = ? WHERE user_id = ? AND crop_id = ?')
      .run(Date.now() - 100_000_000, player, 'basic');

    const harvested = economy.harvest(player);
    expect(harvested.harvested).toBe(1);
    expect(harvested.items.some((item) => item.itemId === 'tbs')).toBe(true);
    const collection = economy.getCropCollection(player);
    const palm = collection.find((crop) => crop.crop_id === 'basic');
    expect(palm?.discovered).toBe(1);
    expect(palm?.total_harvested).toBeGreaterThanOrEqual(6);
  });
});
