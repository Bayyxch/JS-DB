import { db } from '../db/database.js';

function audit(ownerId: string, targetId: string | null, action: string, details: Record<string, unknown>): void {
  db.prepare('INSERT INTO admin_audit_log (owner_id, target_id, action, details, created_at) VALUES (?, ?, ?, ?, ?)')
    .run(ownerId, targetId, action, JSON.stringify(details), Date.now());
}

export function isUserBanned(userId: string): boolean {
  return Boolean(db.prepare('SELECT 1 FROM banned_users WHERE user_id = ?').get(userId));
}

export function banUser(ownerId: string, targetId: string, reason: string): void {
  db.transaction(() => {
    db.prepare(`
      INSERT INTO banned_users (user_id, reason, banned_by, created_at) VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id) DO UPDATE SET reason = excluded.reason, banned_by = excluded.banned_by, created_at = excluded.created_at
    `).run(targetId, reason.slice(0, 300), ownerId, Date.now());
    audit(ownerId, targetId, 'BAN_USER', { reason: reason.slice(0, 300) });
  })();
}

export function unbanUser(ownerId: string, targetId: string): void {
  db.transaction(() => {
    const result = db.prepare('DELETE FROM banned_users WHERE user_id = ?').run(targetId);
    if (!result.changes) throw new Error('ADMIN_USER_NOT_BANNED');
    audit(ownerId, targetId, 'UNBAN_USER', {});
  })();
}

export function adjustAdminAsset(ownerId: string, targetId: string, asset: 'SC' | 'GEM', delta: number): number {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('INVALID_AMOUNT');
  return db.transaction(() => {
    const row = db.prepare('SELECT balance, gems FROM wallets WHERE user_id = ?').get(targetId) as { balance: number; gems: number } | undefined;
    if (!row) throw new Error('ACCOUNT_NOT_FOUND');
    const current = asset === 'SC' ? row.balance : row.gems;
    const next = current + delta;
    if (!Number.isSafeInteger(next) || next < 0) throw new Error(next < 0 ? 'INSUFFICIENT_FUNDS' : 'BALANCE_LIMIT');
    if (asset === 'SC') {
      db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(next, targetId);
      db.prepare(`
        INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, metadata, created_at)
        VALUES (?, 'ADMIN_ADJUSTMENT', ?, ?, ?, ?, ?)
      `).run(targetId, delta, current, next, JSON.stringify({ ownerId }), Date.now());
    } else {
      db.prepare('UPDATE wallets SET gems = ? WHERE user_id = ?').run(next, targetId);
    }
    audit(ownerId, targetId, asset === 'SC' ? 'ADJUST_SC' : 'ADJUST_GEM', { delta, next });
    return next;
  })();
}

export function adjustAdminItem(ownerId: string, targetId: string, itemId: string, delta: number): number {
  if (!Number.isSafeInteger(delta) || delta === 0) throw new Error('INVALID_AMOUNT');
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(itemId)) throw new Error('ITEM_NOT_FOUND');
    const row = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
      .get(targetId, itemId) as { quantity: number } | undefined;
    const next = (row?.quantity ?? 0) + delta;
    if (next < 0) throw new Error('INSUFFICIENT_ITEM');
    if (!Number.isSafeInteger(next)) throw new Error('INVENTORY_LIMIT');
    db.prepare(`
      INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
      ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity
    `).run(targetId, itemId, next);
    audit(ownerId, targetId, 'ADJUST_ITEM', { itemId, delta, next });
    return next;
  })();
}
