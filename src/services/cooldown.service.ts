import { db } from '../db/database.js';

export interface CooldownResult {
  allowed: boolean;
  availableAt: number;
}

/**
 * Atomically consumes a user-scoped cooldown.
 *
 * Cooldowns are global across Discord servers because the player account is global.
 * The existing SQLite table makes them survive process restarts and prevents two
 * bot processes from consuming the same cooldown at the same time.
 */
export function consumeCooldown(
  userId: string,
  action: string,
  cooldownMs: number,
  timestamp = Date.now(),
): CooldownResult {
  if (!Number.isSafeInteger(cooldownMs) || cooldownMs < 0) {
    throw new Error('INVALID_COOLDOWN');
  }
  if (!Number.isSafeInteger(timestamp) || timestamp < 0) {
    throw new Error('INVALID_TIMESTAMP');
  }
  if (cooldownMs === 0) {
    return { allowed: true, availableAt: timestamp };
  }

  const nextAvailableAt = timestamp + cooldownMs;
  if (!Number.isSafeInteger(nextAvailableAt)) {
    throw new Error('INVALID_COOLDOWN');
  }

  return db.transaction(() => {
    const current = db.prepare(
      'SELECT available_at FROM cooldowns WHERE user_id = ? AND action = ?',
    ).get(userId, action) as { available_at: number } | undefined;

    if (current && current.available_at > timestamp) {
      return { allowed: false, availableAt: current.available_at };
    }

    db.prepare(`
      INSERT INTO cooldowns (user_id, action, available_at)
      VALUES (?, ?, ?)
      ON CONFLICT(user_id, action) DO UPDATE SET available_at = excluded.available_at
    `).run(userId, action, nextAvailableAt);

    return { allowed: true, availableAt: nextAvailableAt };
  })();
}
