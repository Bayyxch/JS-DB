import { db } from '../db/database.js';

const OFFER_LIFETIME_MS = 48 * 60 * 60 * 1000;

export interface TradeOffer {
  id: number;
  proposer_id: string;
  proposer_username: string;
  target_id: string;
  target_username: string;
  give_item_id: string;
  give_item_name: string;
  give_quantity: number;
  want_item_id: string;
  want_item_name: string;
  want_quantity: number;
  created_at: number;
  expires_at: number;
}

function validateQuantity(quantity: number): void {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000_000) {
    throw new Error('INVALID_QUANTITY');
  }
}

function adjustInventory(userId: string, itemId: string, delta: number): void {
  const row = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as { quantity: number } | undefined;
  const next = (row?.quantity ?? 0) + delta;
  if (next < 0) throw new Error('INSUFFICIENT_ITEM');
  if (!Number.isSafeInteger(next)) throw new Error('INVENTORY_LIMIT');
  db.prepare(`
    INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity
  `).run(userId, itemId, next);
}

function expireOffers(timestamp: number): void {
  const expired = db.prepare(`
    SELECT id, proposer_id, give_item_id, give_quantity
    FROM trade_offers WHERE status = 'PENDING' AND expires_at <= ?
  `).all(timestamp) as Array<{ id: number; proposer_id: string; give_item_id: string; give_quantity: number }>;
  for (const offer of expired) {
    adjustInventory(offer.proposer_id, offer.give_item_id, offer.give_quantity);
    db.prepare("UPDATE trade_offers SET status = 'EXPIRED' WHERE id = ? AND status = 'PENDING'").run(offer.id);
  }
}

export function createTradeOffer(
  proposerId: string,
  targetId: string,
  giveItemId: string,
  giveQuantity: number,
  wantItemId: string,
  wantQuantity: number,
  timestamp = Date.now(),
): number {
  if (proposerId === targetId) throw new Error('TRADE_SELF');
  if (giveItemId === wantItemId) throw new Error('TRADE_SAME_ITEM');
  validateQuantity(giveQuantity);
  validateQuantity(wantQuantity);
  return db.transaction(() => {
    if (!db.prepare('SELECT 1 FROM users WHERE id = ?').get(targetId)) throw new Error('FRIEND_USER_NOT_FOUND');
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(giveItemId)) throw new Error('ITEM_NOT_FOUND');
    if (!db.prepare('SELECT 1 FROM items WHERE id = ?').get(wantItemId)) throw new Error('ITEM_NOT_FOUND');
    adjustInventory(proposerId, giveItemId, -giveQuantity);
    const result = db.prepare(`
      INSERT INTO trade_offers
        (proposer_id, target_id, give_item_id, give_quantity, want_item_id, want_quantity, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `).run(proposerId, targetId, giveItemId, giveQuantity, wantItemId, wantQuantity, timestamp, timestamp + OFFER_LIFETIME_MS);
    return Number(result.lastInsertRowid);
  })();
}

export function acceptTradeOffer(targetId: string, offerId: number, timestamp = Date.now()): void {
  if (!Number.isSafeInteger(offerId) || offerId <= 0) throw new Error('TRADE_ID_INVALID');
  db.transaction(() => expireOffers(timestamp))();
  db.transaction(() => {
    const offer = db.prepare("SELECT * FROM trade_offers WHERE id = ? AND status = 'PENDING'")
      .get(offerId) as {
        proposer_id: string; target_id: string; give_item_id: string; give_quantity: number;
        want_item_id: string; want_quantity: number;
      } | undefined;
    if (!offer) throw new Error('TRADE_NOT_FOUND');
    if (offer.target_id !== targetId) throw new Error('TRADE_NOT_YOURS');
    adjustInventory(targetId, offer.want_item_id, -offer.want_quantity);
    adjustInventory(targetId, offer.give_item_id, offer.give_quantity);
    adjustInventory(offer.proposer_id, offer.want_item_id, offer.want_quantity);
    db.prepare("UPDATE trade_offers SET status = 'COMPLETED' WHERE id = ?").run(offerId);
  })();
}

export function cancelTradeOffer(proposerId: string, offerId: number, timestamp = Date.now()): void {
  if (!Number.isSafeInteger(offerId) || offerId <= 0) throw new Error('TRADE_ID_INVALID');
  db.transaction(() => expireOffers(timestamp))();
  db.transaction(() => {
    const offer = db.prepare("SELECT * FROM trade_offers WHERE id = ? AND status = 'PENDING'")
      .get(offerId) as { proposer_id: string; give_item_id: string; give_quantity: number } | undefined;
    if (!offer) throw new Error('TRADE_NOT_FOUND');
    if (offer.proposer_id !== proposerId) throw new Error('TRADE_NOT_YOURS');
    adjustInventory(proposerId, offer.give_item_id, offer.give_quantity);
    db.prepare("UPDATE trade_offers SET status = 'CANCELLED' WHERE id = ?").run(offerId);
  })();
}

export function listTradeOffers(userId: string, timestamp = Date.now()): TradeOffer[] {
  return db.transaction(() => {
    expireOffers(timestamp);
    return db.prepare(`
      SELECT o.id, o.proposer_id, p.username AS proposer_username,
        o.target_id, t.username AS target_username,
        o.give_item_id, give.name AS give_item_name, o.give_quantity,
        o.want_item_id, want.name AS want_item_name, o.want_quantity,
        o.created_at, o.expires_at
      FROM trade_offers o
      JOIN users p ON p.id = o.proposer_id
      JOIN users t ON t.id = o.target_id
      JOIN items give ON give.id = o.give_item_id
      JOIN items want ON want.id = o.want_item_id
      WHERE o.status = 'PENDING' AND (o.proposer_id = ? OR o.target_id = ?)
      ORDER BY o.created_at DESC LIMIT 10
    `).all(userId, userId) as TradeOffer[];
  })();
}
