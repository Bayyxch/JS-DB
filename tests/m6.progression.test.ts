import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const player = '67676767676767676';
let database!: { close: () => void };
let tempDirectory = '';
let economy!: typeof import('../src/services/economy.service.js');
let housingPets!: typeof import('../src/services/housing-pet.service.js');
let adventure!: typeof import('../src/services/adventure.service.js');
let events!: typeof import('../src/services/world-event.service.js');

beforeAll(async () => {
  tempDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'sawit-m6-'));
  vi.stubEnv('DISCORD_TOKEN', 'test-token');
  vi.stubEnv('DATABASE_PATH', path.join(tempDirectory, 'test.sqlite'));
  const databaseModule = await import('../src/db/database.js');
  database = databaseModule.db;
  databaseModule.runMigrations();
  economy = await import('../src/services/economy.service.js');
  housingPets = await import('../src/services/housing-pet.service.js');
  adventure = await import('../src/services/adventure.service.js');
  events = await import('../src/services/world-event.service.js');
  economy.ensureUser(player, 'M6Tester');
  economy.credit(player, 100_000, 'TEST_GRANT');
});

afterAll(() => {
  database?.close();
  vi.unstubAllEnvs();
  if (tempDirectory) fs.rmSync(tempDirectory, { recursive: true, force: true });
});

describe('houses, pets, adventures, and global events', () => {
  it('creates a level-one house and applies increasing upgrade costs', () => {
    expect(housingPets.getHouse(player).level).toBe(1);
    expect(housingPets.upgradeHouse(player).level).toBe(2);
    expect(housingPets.upgradeHouse(player).level).toBe(3);
    expect(housingPets.upgradeHouse(player).level).toBe(4);
    expect(housingPets.upgradeHouse(player).level).toBe(5);
    expect(() => housingPets.upgradeHouse(player)).toThrow('HOUSE_MAX_LEVEL');
  });

  it('supports pet adoption, one active pet, and feeding progression', () => {
    const cat = housingPets.adoptPet(player, 'cat');
    expect(cat.is_active).toBe(1);
    const dog = housingPets.adoptPet(player, 'dog');
    expect(dog.is_active).toBe(0);
    economy.buyItem(player, 'pet_food', 1);
    const fed = housingPets.feedPet(player, cat.id);
    expect(fed.xp).toBeGreaterThan(0);
    const active = housingPets.setActivePet(player, dog.id);
    expect(active.is_active).toBe(1);
    expect(housingPets.getPlayerPets(player).filter((pet) => pet.is_active === 1)).toHaveLength(1);
  });

  it('unlocks zones through house level and enforces global adventure cooldown', () => {
    const zones = adventure.getAdventureZones(player);
    expect(zones.find((zone) => zone.id === 'river')?.unlocked).toBe(1);
    expect(zones.find((zone) => zone.id === 'highland')?.unlocked).toBe(1);
    const timestamp = Date.now() + 1000;
    const result = adventure.explore(player, 'highland', timestamp);
    expect(result.final_reward).toBeGreaterThan(0);
    expect(result.pet_name).toBe('Anjing Penjaga');
    expect(() => adventure.explore(player, 'river', timestamp + 1000)).toThrow('COOLDOWN');
    const history = adventure.getAdventureHistory(player);
    expect(history[0]?.zone_name).toBe('Dataran Tinggi');
  });

  it('rotates the same world event for every player on a given UTC day', () => {
    const timestamp = 1_800_000_000_000;
    const current = events.getCurrentWorldEvent(timestamp);
    expect(events.getCurrentWorldEvent(timestamp + 1000).id).toBe(current.id);
    expect(events.getWorldEventCycle()).toHaveLength(3);
    expect(() => events.getCurrentWorldEvent(-1)).toThrow('INVALID_TIMESTAMP');
  });
});
