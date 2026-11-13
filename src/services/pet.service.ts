import { db } from '../db/database.js';
import { debit } from './economy.service.js';
import { getHome } from './home.service.js';
import { getCurrentEvent } from './event.service.js';
import { randomIntInclusive } from '../utils/economy.js';

export interface OwnedPet {
  id: number;
  species_id: string;
  species_name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  description: string;
  name: string;
  level: number;
  xp: number;
  adopted_at: number;
  last_fed_at: number | null;
}

function validatePetName(rawName: string): string {
  const name = rawName.trim().replace(/\s+/g, ' ');
  if (name.length < 2 || name.length > 16 || !/^[\p{L}\p{N} _-]+$/u.test(name)) {
    throw new Error('PET_INVALID_NAME');
  }
  return name;
}

export function getPets(ownerId: string): OwnedPet[] {
  return db.prepare(`
    SELECT p.id, p.species_id, s.name AS species_name, s.rarity, s.description,
      p.name, p.level, p.xp, p.adopted_at, p.last_fed_at
    FROM player_pets p JOIN pet_species s ON s.id = p.species_id
    WHERE p.owner_id = ? ORDER BY p.adopted_at ASC
  `).all(ownerId) as OwnedPet[];
}

export function adoptPet(ownerId: string, rawName: string): { pet: OwnedPet; cost: number; slots: number } {
  const name = validatePetName(rawName);
  return db.transaction(() => {
    const home = getHome(ownerId);
    const pets = getPets(ownerId);
    const slots = home.level + 1;
    if (pets.length >= slots) throw new Error('PET_SLOTS_FULL');

    if (db.prepare('SELECT 1 FROM player_pets WHERE owner_id = ? AND name = ? COLLATE NOCASE').get(ownerId, name)) throw new Error('PET_NAME_TAKEN');
    const event = getCurrentEvent();
    const cost = Math.round(5000 * event.petCostMultiplier);
    const roll = randomIntInclusive(1, 100);
    const speciesId = roll <= 5 ? 'owl' : roll <= 30 ? 'rabbit' : roll <= 65 ? 'dog' : 'cat';
    debit(ownerId, cost, 'PET_ADOPTION', { speciesId, name, eventId: event.id });
    const result = db.prepare('INSERT INTO player_pets (owner_id, species_id, name, adopted_at) VALUES (?, ?, ?, ?)')
      .run(ownerId, speciesId, name, Date.now());
    const pet = getPets(ownerId).find((entry) => entry.id === Number(result.lastInsertRowid));
    if (!pet) throw new Error('PET_NOT_FOUND');
    return { pet, cost, slots };
  })();
}

export function feedPet(ownerId: string, petId: number): { pet: OwnedPet; nextFeedAt: number } {
  if (!Number.isSafeInteger(petId) || petId <= 0) throw new Error('PET_NOT_FOUND');
  const cooldownMs = 60 * 60 * 1000;
  return db.transaction(() => {
    const pet = getPets(ownerId).find((entry) => entry.id === petId);
    if (!pet) throw new Error('PET_NOT_FOUND');
    const now = Date.now();
    if (pet.last_fed_at !== null && pet.last_fed_at + cooldownMs > now) {
      throw Object.assign(new Error('COOLDOWN'), { availableAt: pet.last_fed_at + cooldownMs });
    }
    const inventory = db.prepare("SELECT quantity FROM inventory WHERE user_id = ? AND item_id = 'tbs'")
      .get(ownerId) as { quantity: number } | undefined;
    if ((inventory?.quantity ?? 0) < 5) throw new Error('PET_NEEDS_TBS');
    db.prepare("UPDATE inventory SET quantity = quantity - 5 WHERE user_id = ? AND item_id = 'tbs'")
      .run(ownerId);
    const xp = pet.xp + 25;
    if (!Number.isSafeInteger(xp)) throw new Error('PET_XP_LIMIT');
    const level = Math.floor(xp / 100) + 1;
    db.prepare('UPDATE player_pets SET xp = ?, level = ?, last_fed_at = ? WHERE id = ? AND owner_id = ?')
      .run(xp, level, now, petId, ownerId);
    const updated = getPets(ownerId).find((entry) => entry.id === petId);
    if (!updated) throw new Error('PET_NOT_FOUND');
    return { pet: updated, nextFeedAt: now + cooldownMs };
  })();
}

export function renamePet(ownerId: string, petId: number, rawName: string): string {
  if (!Number.isSafeInteger(petId) || petId <= 0) throw new Error('PET_NOT_FOUND');
  const name = validatePetName(rawName);
  if (db.prepare('SELECT 1 FROM player_pets WHERE owner_id = ? AND name = ? COLLATE NOCASE AND id <> ?').get(ownerId, name, petId)) throw new Error('PET_NAME_TAKEN');
  const result = db.prepare('UPDATE player_pets SET name = ? WHERE id = ? AND owner_id = ?')
    .run(name, petId, ownerId);
  if (result.changes === 0) throw new Error('PET_NOT_FOUND');
  return name;
}
