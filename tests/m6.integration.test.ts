import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import type Database from 'better-sqlite3';

const userId = '12121212121212121';
let databasePath = '';
let db!: InstanceType<typeof Database>;
let economy!: typeof import('../src/services/economy.service.js');
let adventure!: typeof import('../src/services/adventure.service.js');
let home!: typeof import('../src/services/home.service.js');
let pets!: typeof import('../src/services/pet.service.js');
let events!: typeof import('../src/services/event.service.js');

beforeAll(async () => {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-m6-'));
  databasePath = path.join(directory, 'test.sqlite');
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', databasePath);
  const database = await import('../src/db/database.js');
  db = database.db;
  database.runMigrations();
  economy = await import('../src/services/economy.service.js');
  adventure = await import('../src/services/adventure.service.js');
  home = await import('../src/services/home.service.js');
  pets = await import('../src/services/pet.service.js');
  events = await import('../src/services/event.service.js');
  economy.ensureUser(userId, 'M6Tester');
  economy.credit(userId, 30000, 'TEST_GRANT');
});

afterAll(() => {
  db?.close();
  vi.unstubAllEnvs();
  if (databasePath) fs.rmSync(path.dirname(databasePath), { recursive: true, force: true });
});

describe('adventure, homes, pets, and global events', () => {
  it('runs a cooldown-protected expedition and awards progress', () => {
    const timestamp = 1_800_000_000_000;
    const result = adventure.runExpedition(userId, timestamp);
    expect(result.quantity).toBeGreaterThanOrEqual(1);
    expect(result.itemId).toBeTruthy();
    expect(result.xp).toBe(15);
    expect(result.completed).toBe(1);
    expect(() => adventure.runExpedition(userId, timestamp + 1)).toThrow('COOLDOWN');
    expect(adventure.getAdventureProgress(userId).level).toBe(1);
  });

  it('upgrades the home and enforces pet capacity and unique names', () => {
    const upgraded = home.upgradeHome(userId);
    expect(upgraded.home.level).toBe(2);
    expect(upgraded.petSlots).toBe(3);

    const first = pets.adoptPet(userId, 'Kiko');
    expect(first.pet.name).toBe('Kiko');
    expect(() => pets.adoptPet(userId, 'Kiko')).toThrow('PET_NAME_TAKEN');
    pets.adoptPet(userId, 'Momo');
    pets.adoptPet(userId, 'Bubu');
    expect(() => pets.adoptPet(userId, 'Extra')).toThrow('PET_SLOTS_FULL');

    const tbsBeforeFeeding = economy.getInventoryItem(userId, 'tbs');
    db.prepare(`
      INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, 'tbs', 10)
      ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + 10
    `).run(userId);
    const fed = pets.feedPet(userId, first.pet.id);
    expect(fed.pet.xp).toBe(25);
    expect(economy.getInventoryItem(userId, 'tbs')).toBe(tbsBeforeFeeding + 5);
    expect(() => pets.feedPet(userId, first.pet.id)).toThrow('COOLDOWN');
    expect(pets.renamePet(userId, first.pet.id, 'Kiko Jr')).toBe('Kiko Jr');
  });

  it('provides one consistent weekly event rotation', () => {
    expect(events.getWorldEvents()).toHaveLength(3);
    const week = 1_800_000_000_000;
    const current = events.getCurrentEvent(week);
    expect(events.getCurrentEvent(week + 1000).id).toBe(current.id);
    expect(current.name).toBeTruthy();
  });
});
