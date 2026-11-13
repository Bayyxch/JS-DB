import { db } from '../db/database.js';
import { credit, randomYield, grantPlayerXp } from './economy.service.js';
import { getHouse } from './housing-pet.service.js';
import { getCurrentWorldEvent } from './world-event.service.js';

export interface AdventureZone {
  id: string;
  name: string;
  min_house_level: number;
  min_reward: number;
  max_reward: number;
  cooldown_minutes: number;
  unlocked: number;
}

export interface AdventureResult {
  zone_name: string;
  base_reward: number;
  final_reward: number;
  balance: number;
  pet_name: string | null;
  pet_level: number | null;
  house_level: number;
  event_name: string;
  next_at: number;
  xp_awarded: number;
  level: number;
  levels_gained: number;
}

export function getAdventureZones(userId: string): AdventureZone[] {
  const house = getHouse(userId);
  return db.prepare(`
    SELECT id, name, min_house_level, min_reward, max_reward, cooldown_minutes,
      CASE WHEN min_house_level <= ? THEN 1 ELSE 0 END AS unlocked
    FROM adventure_zones ORDER BY min_house_level ASC
  `).all(house.level) as AdventureZone[];
}

export function explore(userId: string, zoneId: string, timestamp = Date.now()): AdventureResult {
  return db.transaction(() => {
    const zone = db.prepare('SELECT * FROM adventure_zones WHERE id = ?').get(zoneId) as AdventureZone | undefined;
    if (!zone) throw new Error('ADVENTURE_ZONE_NOT_FOUND');
    const house = getHouse(userId);
    if (house.level < zone.min_house_level) throw new Error('ADVENTURE_ZONE_LOCKED');

    const cooldown = db.prepare("SELECT available_at FROM cooldowns WHERE user_id = ? AND action = 'adventure'")
      .get(userId) as { available_at: number } | undefined;
    if (cooldown && cooldown.available_at > timestamp) {
      throw Object.assign(new Error('COOLDOWN'), { availableAt: cooldown.available_at });
    }

    const pet = db.prepare(`
      SELECT p.id, p.level, s.name, s.power_percent
      FROM player_pets p JOIN pet_species s ON s.id = p.species_id
      WHERE p.user_id = ? AND p.is_active = 1
    `).get(userId) as { id: number; level: number; name: string; power_percent: number } | undefined;

    const event = getCurrentWorldEvent(timestamp);
    const baseReward = randomYield(zone.min_reward, zone.max_reward);
    const houseBonus = Math.min(0.2, (house.level - 1) * 0.05);
    const petBonus = pet ? Math.min(0.2, pet.power_percent / 100 + (pet.level - 1) * 0.005) : 0;
    const finalReward = Math.max(1, Math.floor(baseReward * (1 + houseBonus + petBonus) * event.adventureMultiplier));
    const progression = grantPlayerXp(userId, 15);
    const balance = credit(userId, finalReward, 'ADVENTURE_REWARD', {
      zoneId,
      baseReward,
      houseLevel: house.level,
      petId: pet?.id ?? null,
      eventId: event.id,
    });
    const nextAt = timestamp + zone.cooldown_minutes * 60 * 1000;
    db.prepare(`
      INSERT INTO cooldowns (user_id, action, available_at)
      VALUES (?, 'adventure', ?)
      ON CONFLICT(user_id, action) DO UPDATE SET available_at = excluded.available_at
    `).run(userId, nextAt);
    db.prepare(`
      INSERT INTO adventure_runs
        (user_id, pet_instance_id, zone_id, base_reward, final_reward, event_id, completed_at)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `).run(userId, pet?.id ?? null, zoneId, baseReward, finalReward, event.id, timestamp);
    return {
      zone_name: zone.name,
      base_reward: baseReward,
      final_reward: finalReward,
      balance,
      pet_name: pet?.name ?? null,
      pet_level: pet?.level ?? null,
      house_level: house.level,
      event_name: event.name,
      next_at: nextAt,
      xp_awarded: progression.awarded,
      level: progression.level,
      levels_gained: progression.levelsGained,
    };
  })();
}

export function getAdventureHistory(userId: string): Array<{
  zone_name: string;
  final_reward: number;
  event_id: string;
  completed_at: number;
}> {
  return db.prepare(`
    SELECT z.name AS zone_name, a.final_reward, a.event_id, a.completed_at
    FROM adventure_runs a JOIN adventure_zones z ON z.id = a.zone_id
    WHERE a.user_id = ? ORDER BY a.completed_at DESC LIMIT 5
  `).all(userId) as Array<{ zone_name: string; final_reward: number; event_id: string; completed_at: number }>;
}
