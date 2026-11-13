import { db } from '../db/database.js';
import { randomIntInclusive } from '../utils/economy.js';
import { getCurrentEvent } from './event.service.js';

export interface ExpeditionResult {
  itemId: string;
  itemName: string;
  quantity: number;
  xp: number;
  level: number;
  completed: number;
  nextAt: number;
  eventName: string;
}

export function runExpedition(userId: string, timestamp = Date.now()): ExpeditionResult {
  const cooldownMs = 2 * 60 * 60 * 1000;
  return db.transaction(() => {
    const cooldown = db.prepare('SELECT available_at FROM cooldowns WHERE user_id = ? AND action = ?')
      .get(userId, 'expedition') as { available_at: number } | undefined;
    if (cooldown && cooldown.available_at > timestamp) {
      throw Object.assign(new Error('COOLDOWN'), { availableAt: cooldown.available_at });
    }

    const resources = db.prepare("SELECT id, name FROM items WHERE type = 'RESOURCE' AND sell_price > 0 ORDER BY id ASC")
      .all() as Array<{ id: string; name: string }>;
    if (resources.length === 0) throw new Error('EXPEDITION_NO_REWARDS');
    const event = getCurrentEvent(timestamp);
    const reward = resources[randomIntInclusive(0, resources.length - 1)]!;
    const quantity = randomIntInclusive(1, 3) + event.expeditionBonus;

    const inventoryRow = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
      .get(userId, reward.id) as { quantity: number } | undefined;
    const nextQuantity = (inventoryRow?.quantity ?? 0) + quantity;
    if (!Number.isSafeInteger(nextQuantity)) throw new Error('INVENTORY_LIMIT');
    db.prepare(`
      INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
      ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity
    `).run(userId, reward.id, nextQuantity);

    const currentProgress = db.prepare('SELECT xp, expeditions_completed FROM player_adventure WHERE user_id = ?')
      .get(userId) as { xp: number; expeditions_completed: number } | undefined;
    const nextXp = (currentProgress?.xp ?? 0) + 15;
    const nextCompleted = (currentProgress?.expeditions_completed ?? 0) + 1;
    if (!Number.isSafeInteger(nextXp) || !Number.isSafeInteger(nextCompleted)) throw new Error('ADVENTURE_PROGRESS_LIMIT');
    db.prepare('INSERT OR IGNORE INTO player_adventure (user_id, xp, expeditions_completed) VALUES (?, 0, 0)')
      .run(userId);
    db.prepare('UPDATE player_adventure SET xp = ?, expeditions_completed = ? WHERE user_id = ?')
      .run(nextXp, nextCompleted, userId);

    db.prepare(`
      INSERT INTO cooldowns (user_id, action, available_at) VALUES (?, 'expedition', ?)
      ON CONFLICT(user_id, action) DO UPDATE SET available_at = excluded.available_at
    `).run(userId, timestamp + cooldownMs);

    const progress = db.prepare('SELECT xp, expeditions_completed FROM player_adventure WHERE user_id = ?')
      .get(userId) as { xp: number; expeditions_completed: number };
    return {
      itemId: reward.id,
      itemName: reward.name,
      quantity,
      xp: progress.xp,
      level: Math.floor(progress.xp / 100) + 1,
      completed: progress.expeditions_completed,
      nextAt: timestamp + cooldownMs,
      eventName: event.name,
    };
  })();
}

export function getAdventureProgress(userId: string): { xp: number; expeditions_completed: number; level: number } {
  const row = db.prepare('SELECT xp, expeditions_completed FROM player_adventure WHERE user_id = ?')
    .get(userId) as { xp: number; expeditions_completed: number } | undefined;
  const xp = row?.xp ?? 0;
  return { xp, expeditions_completed: row?.expeditions_completed ?? 0, level: Math.floor(xp / 100) + 1 };
}
