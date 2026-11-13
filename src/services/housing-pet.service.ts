import { db } from '../db/database.js';
import { credit, debit } from './economy.service.js';
import { getCurrentWorldEvent } from './world-event.service.js';

export interface HouseInfo {
  user_id: string;
  level: number;
  created_at: number;
  updated_at: number;
  next_upgrade_cost: number | null;
}

export interface PetSpecies {
  id: string;
  name: string;
  rarity: string;
  adoption_cost: number;
  power_percent: number;
}

export interface PlayerPet {
  id: number;
  species_id: string;
  name: string;
  rarity: string;
  nickname: string | null;
  level: number;
  xp: number;
  is_active: number;
  power_percent: number;
  acquired_at: number;
}

export function getHouse(userId: string): HouseInfo {
  const timestamp = Date.now();
  db.prepare('INSERT OR IGNORE INTO player_houses (user_id, level, created_at, updated_at) VALUES (?, 1, ?, ?)')
    .run(userId, timestamp, timestamp);
  const house = db.prepare('SELECT * FROM player_houses WHERE user_id = ?').get(userId) as Omit<HouseInfo, 'next_upgrade_cost'>;
  return { ...house, next_upgrade_cost: house.level >= 5 ? null : house.level * house.level * 2500 };
}

export function upgradeHouse(userId: string): HouseInfo {
  return db.transaction(() => {
    const house = getHouse(userId);
    if (house.level >= 5) throw new Error('HOUSE_MAX_LEVEL');
    const cost = house.level * house.level * 2500;
    debit(userId, cost, 'HOUSE_UPGRADE', { from: house.level, to: house.level + 1 });
    db.prepare('UPDATE player_houses SET level = level + 1, updated_at = ? WHERE user_id = ?')
      .run(Date.now(), userId);
    return getHouse(userId);
  })();
}

export function getPetShop(): PetSpecies[] {
  return db.prepare('SELECT id, name, rarity, adoption_cost, power_percent FROM pet_species ORDER BY adoption_cost ASC')
    .all() as PetSpecies[];
}

export function getPlayerPets(userId: string): PlayerPet[] {
  return db.prepare(`
    SELECT p.id, p.species_id, s.name, s.rarity, p.nickname, p.level, p.xp,
      p.is_active, s.power_percent, p.acquired_at
    FROM player_pets p JOIN pet_species s ON s.id = p.species_id
    WHERE p.user_id = ? ORDER BY p.acquired_at ASC
  `).all(userId) as PlayerPet[];
}

export function adoptPet(userId: string, speciesId: string): PlayerPet {
  return db.transaction(() => {
    const species = db.prepare('SELECT * FROM pet_species WHERE id = ?').get(speciesId) as (PetSpecies & { food_item_id: string }) | undefined;
    if (!species) throw new Error('PET_SPECIES_NOT_FOUND');
    const count = db.prepare('SELECT COUNT(*) AS count FROM player_pets WHERE user_id = ?').get(userId) as { count: number };
    if (count.count >= 5) throw new Error('PET_LIMIT');
    debit(userId, species.adoption_cost, 'PET_ADOPTION', { speciesId });
    const active = count.count === 0 ? 1 : 0;
    const result = db.prepare(`
      INSERT INTO player_pets (user_id, species_id, is_active, acquired_at)
      VALUES (?, ?, ?, ?)
    `).run(userId, speciesId, active, Date.now());
    return getPlayerPets(userId).find((pet) => pet.id === Number(result.lastInsertRowid))!;
  })();
}

export function setActivePet(userId: string, petId: number): PlayerPet {
  return db.transaction(() => {
    const pet = db.prepare('SELECT id FROM player_pets WHERE id = ? AND user_id = ?').get(petId, userId);
    if (!pet) throw new Error('PET_NOT_FOUND');
    db.prepare('UPDATE player_pets SET is_active = 0 WHERE user_id = ?').run(userId);
    db.prepare('UPDATE player_pets SET is_active = 1 WHERE id = ? AND user_id = ?').run(petId, userId);
    return getPlayerPets(userId).find((entry) => entry.id === petId)!;
  })();
}

export function feedPet(userId: string, petId: number): PlayerPet {
  return db.transaction(() => {
    const pet = db.prepare(`
      SELECT p.id, p.level, p.xp, s.food_item_id
      FROM player_pets p JOIN pet_species s ON s.id = p.species_id
      WHERE p.id = ? AND p.user_id = ?
    `).get(petId, userId) as { id: number; level: number; xp: number; food_item_id: string } | undefined;
    if (!pet) throw new Error('PET_NOT_FOUND');
    if (pet.level >= 50) throw new Error('PET_MAX_LEVEL');
    const inventory = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
      .get(userId, pet.food_item_id) as { quantity: number } | undefined;
    if (!inventory || inventory.quantity < 1) throw new Error('PET_FOOD_REQUIRED');
    db.prepare('UPDATE inventory SET quantity = quantity - 1 WHERE user_id = ? AND item_id = ?')
      .run(userId, pet.food_item_id);
    const event = getCurrentWorldEvent();
    let xp = pet.xp + Math.floor(25 * event.petXpMultiplier);
    let level = pet.level;
    while (level < 50 && xp >= level * 100) {
      xp -= level * 100;
      level += 1;
    }
    if (level >= 50) xp = 0;
    db.prepare('UPDATE player_pets SET level = ?, xp = ? WHERE id = ?').run(level, xp, petId);
    return getPlayerPets(userId).find((entry) => entry.id === petId)!;
  })();
}
