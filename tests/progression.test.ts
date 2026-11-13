import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const userId = '67676767676767676';
let database!: { close: () => void; prepare: (sql: string) => { run: (...args: unknown[]) => void } };
let tempDirectory = '';
let economy!: typeof import('../src/services/economy.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-progression-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db as unknown as typeof database;
  databaseModule.runMigrations();
  economy = await import('../src/services/economy.service.js');
  economy.ensureUser(userId, 'Progression Tester');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('player progression and Gems', () => {
  it('levels up from EXP and carries remaining EXP forward', () => {
    expect(economy.getPlayerProgress(userId)).toMatchObject({ level: 1, xp: 0, nextLevelXp: 100 });
    economy.grantPlayerXp(userId, 125);
    expect(economy.getPlayerProgress(userId)).toMatchObject({ level: 2, xp: 25, nextLevelXp: 200 });
  });

  it('credits and debits Gems safely', () => {
    expect(economy.creditGems(userId, 4)).toBe(4);
    expect(economy.debitGems(userId, 1)).toBe(3);
    expect(() => economy.debitGems(userId, 4)).toThrow('INSUFFICIENT_GEMS');
  });

  it('sells Ultimate Palm for Gems', () => {
    database.prepare("INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, 'ultimate_palm', 2)").run(userId);
    const result = economy.sellUltimatePalm(userId, 2);
    expect(result.total).toBe(10);
    expect(result.gems).toBe(13);
    expect(economy.getInventoryItem(userId, 'ultimate_palm')).toBe(0);
  });
});
