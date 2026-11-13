import { db } from '../db/database.js';
import { debit } from './economy.service.js';

export interface HomeStatus {
  user_id: string;
  level: number;
  created_at: number;
  upgraded_at: number;
}

export function getHome(userId: string): HomeStatus {
  const timestamp = Date.now();
  db.prepare('INSERT OR IGNORE INTO player_homes (user_id, level, created_at, upgraded_at) VALUES (?, 1, ?, ?)')
    .run(userId, timestamp, timestamp);
  return db.prepare('SELECT * FROM player_homes WHERE user_id = ?').get(userId) as HomeStatus;
}

export function upgradeHome(userId: string): { home: HomeStatus; cost: number; petSlots: number } {
  return db.transaction(() => {
    const home = getHome(userId);
    if (home.level >= 5) throw new Error('HOME_MAX_LEVEL');
    const cost = home.level * 8000;
    debit(userId, cost, 'HOME_UPGRADE', { from: home.level, to: home.level + 1 });
    db.prepare('UPDATE player_homes SET level = level + 1, upgraded_at = ? WHERE user_id = ?')
      .run(Date.now(), userId);
    const upgraded = getHome(userId);
    return { home: upgraded, cost, petSlots: upgraded.level + 1 };
  })();
}
