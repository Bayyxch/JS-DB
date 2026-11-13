import { db } from '../db/database.js';

const MAX_LISTING_QUANTITY = 1_000_000;
const MAX_UNIT_PRICE = 1_000_000_000;
const LISTING_LIFETIME_MS = 7 * 24 * 60 * 60 * 1000;

export interface MarketListing {
  id: number;
  seller_id: string;
  seller_username: string;
  item_id: string;
  item_name: string;
  quantity: number;
  unit_price: number;
  created_at: number;
  expires_at: number;
}

function changeWallet(userId: string, amount: number, type: string, metadata: Record<string, unknown>): number {
  if (!Number.isSafeInteger(amount)) throw new Error('INVALID_AMOUNT');
  const wallet = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId) as { balance: number } | undefined;
  if (!wallet) throw new Error('ACCOUNT_NOT_FOUND');
  const next = wallet.balance + amount;
  if (!Number.isSafeInteger(next)) throw new Error('BALANCE_LIMIT');
  if (next < 0) throw new Error('INSUFFICIENT_FUNDS');
  db.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(next, userId);
  db.prepare(`
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, amount, wallet.balance, next, JSON.stringify(metadata), Date.now());
  return next;
}

function changeItem(userId: string, itemId: string, delta: number): void {
  if (!Number.isSafeInteger(delta)) throw new Error('INVALID_QUANTITY');
  const row = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as { quantity: number } | undefined;
  const next = (row?.quantity ?? 0) + delta;
  if (!Number.isSafeInteger(next)) throw new Error('INVENTORY_LIMIT');
  if (next < 0) throw new Error('INSUFFICIENT_ITEM');
  db.prepare(`
    INSERT INTO inventory (user_id, item_id, quantity) VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity
  `).run(userId, itemId, next);
}

export function createMarketListing(
  sellerId: string,
  itemId: string,
  quantity: number,
  unitPrice: number,
): { listingId: number; totalValue: number; expiresAt: number } {
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > MAX_LISTING_QUANTITY) {
    throw new Error('INVALID_QUANTITY');
  }
  if (!Number.isSafeInteger(unitPrice) || unitPrice < 1 || unitPrice > MAX_UNIT_PRICE) {
    throw new Error('MARKET_INVALID_PRICE');
  }
  const totalValue = quantity * unitPrice;
  if (!Number.isSafeInteger(totalValue)) throw new Error('INVALID_AMOUNT');

  return db.transaction(() => {
    const item = db.prepare('SELECT id FROM items WHERE id = ?').get(itemId);
    if (!item) throw new Error('ITEM_NOT_FOUND');
    changeItem(sellerId, itemId, -quantity);
    const createdAt = Date.now();
    const expiresAt = createdAt + LISTING_LIFETIME_MS;
    const result = db.prepare(`
      INSERT INTO market_listings (seller_id, item_id, quantity, unit_price, created_at, expires_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `).run(sellerId, itemId, quantity, unitPrice, createdAt, expiresAt);
    return { listingId: Number(result.lastInsertRowid), totalValue, expiresAt };
  })();
}

export function getMarketListings(itemId?: string, limit = 20): MarketListing[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 50) throw new Error('INVALID_LIMIT');
  return db.prepare(`
    SELECT l.id, l.seller_id, u.username AS seller_username,
      l.item_id, i.name AS item_name, l.quantity, l.unit_price,
      l.created_at, l.expires_at
    FROM market_listings l
    JOIN users u ON u.id = l.seller_id
    JOIN items i ON i.id = l.item_id
    WHERE l.expires_at > ? AND (? IS NULL OR l.item_id = ?)
    ORDER BY l.unit_price ASC, l.created_at ASC
    LIMIT ?
  `).all(Date.now(), itemId ?? null, itemId ?? null, limit) as MarketListing[];
}

export function getMyMarketListings(userId: string): MarketListing[] {
  return db.prepare(`
    SELECT l.id, l.seller_id, u.username AS seller_username,
      l.item_id, i.name AS item_name, l.quantity, l.unit_price,
      l.created_at, l.expires_at
    FROM market_listings l
    JOIN users u ON u.id = l.seller_id
    JOIN items i ON i.id = l.item_id
    WHERE l.seller_id = ?
    ORDER BY l.created_at DESC LIMIT 20
  `).all(userId) as MarketListing[];
}

export function buyMarketListing(buyerId: string, listingId: number, quantity: number): {
  itemName: string;
  quantity: number;
  total: number;
  buyerBalance: number;
  sellerBalance: number;
  remaining: number;
} {
  if (!Number.isSafeInteger(listingId) || listingId <= 0) throw new Error('MARKET_LISTING_NOT_FOUND');
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > MAX_LISTING_QUANTITY) throw new Error('INVALID_QUANTITY');

  return db.transaction(() => {
    const listing = db.prepare(`
      SELECT l.*, i.name AS item_name
      FROM market_listings l JOIN items i ON i.id = l.item_id
      WHERE l.id = ?
    `).get(listingId) as (MarketListing & { item_name: string }) | undefined;
    if (!listing) throw new Error('MARKET_LISTING_NOT_FOUND');
    if (listing.expires_at <= Date.now()) throw new Error('MARKET_LISTING_EXPIRED');
    if (listing.seller_id === buyerId) throw new Error('MARKET_SELF_PURCHASE');
    if (quantity > listing.quantity) throw new Error('MARKET_NOT_ENOUGH_STOCK');

    const total = quantity * listing.unit_price;
    if (!Number.isSafeInteger(total)) throw new Error('INVALID_AMOUNT');
    const buyerBalance = changeWallet(buyerId, -total, 'MARKET_PURCHASE', { listingId, sellerId: listing.seller_id, itemId: listing.item_id, quantity });
    const sellerBalance = changeWallet(listing.seller_id, total, 'MARKET_SALE', { listingId, buyerId, itemId: listing.item_id, quantity });
    changeItem(buyerId, listing.item_id, quantity);

    const remaining = listing.quantity - quantity;
    if (remaining === 0) {
      db.prepare('DELETE FROM market_listings WHERE id = ?').run(listingId);
    } else {
      db.prepare('UPDATE market_listings SET quantity = ? WHERE id = ?').run(remaining, listingId);
    }
    return { itemName: listing.item_name, quantity, total, buyerBalance, sellerBalance, remaining };
  })();
}

export function cancelMarketListing(sellerId: string, listingId: number): { itemName: string; quantity: number } {
  if (!Number.isSafeInteger(listingId) || listingId <= 0) throw new Error('MARKET_LISTING_NOT_FOUND');
  return db.transaction(() => {
    const listing = db.prepare(`
      SELECT l.*, i.name AS item_name FROM market_listings l
      JOIN items i ON i.id = l.item_id WHERE l.id = ?
    `).get(listingId) as (MarketListing & { item_name: string }) | undefined;
    if (!listing) throw new Error('MARKET_LISTING_NOT_FOUND');
    if (listing.seller_id !== sellerId) throw new Error('MARKET_NOT_OWNER');
    changeItem(sellerId, listing.item_id, listing.quantity);
    db.prepare('DELETE FROM market_listings WHERE id = ?').run(listingId);
    return { itemName: listing.item_name, quantity: listing.quantity };
  })();
}
