import type Database from 'better-sqlite3';
import { config } from '../config/env.js';
import { db } from '../db/database.js';
import { calculateLandExpansionCost as calculateLandExpansionCostFormula, randomIntInclusive } from '../utils/economy.js';

export interface FarmPlotRow {
  plot_index: number;
  crop_id: string | null;
  planted_at: number | null;
}

export interface CropRow {
  id: string;
  name: string;
  seed_item_id: string;
  grow_seconds: number;
  min_yield: number;
  max_yield: number;
  sell_item_id: string;
  rarity: 'common' | 'uncommon' | 'rare';
}

export interface ItemRow {
  id: string;
  name: string;
  type: string;
  buy_price: number;
  sell_price: number;
  description: string;
}

export interface HarvestedItem {
  itemId: string;
  itemName: string;
  quantity: number;
}

export interface HarvestDetail {
  plot: number;
  cropName: string;
  yield: number;
  itemId: string;
  itemName: string;
  rarity: string;
}

function now(): number {
  return Date.now();
}

export function calculateLandExpansionCost(currentPlots: number): number {
  return calculateLandExpansionCostFormula(
    currentPlots,
    config.economy.startingPlots,
    config.economy.firstLandCost,
    config.economy.landCostMultiplier,
  );
}

export function randomYield(min: number, max: number): number {
  return randomIntInclusive(min, max);
}

export function getBalance(userId: string): number {
  const row = db.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId) as { balance: number } | undefined;
  return row?.balance ?? 0;
}

export function ensureUser(userId: string, username: string): void {
  const timestamp = now();
  const tx = db.transaction(() => {
    const existing = db.prepare('SELECT id FROM users WHERE id = ?').get(userId) as { id: string } | undefined;
    if (existing) {
      db.prepare('UPDATE users SET username = ?, updated_at = ? WHERE id = ?').run(username, timestamp, userId);
      return;
    }

    db.prepare('INSERT INTO users (id, username, created_at, updated_at) VALUES (?, ?, ?, ?)')
      .run(userId, username, timestamp, timestamp);
    db.prepare('INSERT INTO wallets (user_id, balance) VALUES (?, ?)')
      .run(userId, config.economy.startingBalance);

    const insertPlot = db.prepare('INSERT INTO farm_plots (user_id, plot_index) VALUES (?, ?)');
    for (let i = 1; i <= config.economy.startingPlots; i += 1) {
      insertPlot.run(userId, i);
    }

    db.prepare(`
      INSERT INTO inventory (user_id, item_id, quantity)
      VALUES (?, 'seed_basic', ?)
      ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = quantity + excluded.quantity
    `).run(userId, config.economy.startingSeeds);

    db.prepare(`
      INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, metadata, created_at)
      VALUES (?, 'STARTER_GRANT', ?, 0, ?, ?, ?)
    `).run(userId, config.economy.startingBalance, config.economy.startingBalance, JSON.stringify({ reason: 'first_account' }), timestamp);
  });

  tx();
}

function changeBalance(
  database: InstanceType<typeof Database>,
  userId: string,
  amount: number,
  type: string,
  metadata: Record<string, unknown>,
): number {
  if (!Number.isSafeInteger(amount)) throw new Error('INVALID_AMOUNT');

  const wallet = database.prepare('SELECT balance FROM wallets WHERE user_id = ?').get(userId) as { balance: number } | undefined;
  if (!wallet) throw new Error('ACCOUNT_NOT_FOUND');

  const next = wallet.balance + amount;
  if (!Number.isSafeInteger(next) || next < 0) throw new Error(next < 0 ? 'INSUFFICIENT_FUNDS' : 'BALANCE_LIMIT');

  database.prepare('UPDATE wallets SET balance = ? WHERE user_id = ?').run(next, userId);
  database.prepare(`
    INSERT INTO transactions (user_id, type, amount, balance_before, balance_after, metadata, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, type, amount, wallet.balance, next, JSON.stringify(metadata), now());
  return next;
}

export function debit(userId: string, amount: number, type: string, metadata: Record<string, unknown> = {}): number {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
  return db.transaction(() => changeBalance(db, userId, -amount, type, metadata))();
}

export function credit(userId: string, amount: number, type: string, metadata: Record<string, unknown> = {}): number {
  if (!Number.isSafeInteger(amount) || amount <= 0) throw new Error('INVALID_AMOUNT');
  return db.transaction(() => changeBalance(db, userId, amount, type, metadata))();
}

export function getInventoryItem(userId: string, itemId: string): number {
  const row = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as { quantity: number } | undefined;
  return row?.quantity ?? 0;
}

function changeInventory(database: InstanceType<typeof Database>, userId: string, itemId: string, delta: number): number {
  if (!Number.isSafeInteger(delta)) throw new Error('INVALID_QUANTITY');

  const current = database.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
    .get(userId, itemId) as { quantity: number } | undefined;
  const next = (current?.quantity ?? 0) + delta;
  if (next < 0) throw new Error('INSUFFICIENT_ITEM');
  if (!Number.isSafeInteger(next)) throw new Error('INVENTORY_LIMIT');

  database.prepare(`
    INSERT INTO inventory (user_id, item_id, quantity)
    VALUES (?, ?, ?)
    ON CONFLICT(user_id, item_id) DO UPDATE SET quantity = excluded.quantity
  `).run(userId, itemId, next);
  return next;
}

export function buyItem(userId: string, itemId: string, quantity: number): { item: ItemRow; total: number; balance: number } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new Error('INVALID_QUANTITY');
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND buy_price > 0').get(itemId) as ItemRow | undefined;
    if (!item) throw new Error('ITEM_NOT_FOUND');
    const total = item.buy_price * quantity;
    if (!Number.isSafeInteger(total)) throw new Error('INVALID_AMOUNT');
    const balance = changeBalance(db, userId, -total, 'SHOP_PURCHASE', { itemId, quantity, unitPrice: item.buy_price });
    changeInventory(db, userId, item.id, quantity);
    return { item, total, balance };
  })();
}

export function sellItem(userId: string, itemId: string, quantity: number): { item: ItemRow; total: number; balance: number } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new Error('INVALID_QUANTITY');
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND sell_price > 0').get(itemId) as ItemRow | undefined;
    if (!item) throw new Error('ITEM_NOT_SELLABLE');
    changeInventory(db, userId, item.id, -quantity);
    const total = item.sell_price * quantity;
    if (!Number.isSafeInteger(total)) throw new Error('INVALID_AMOUNT');
    const balance = changeBalance(db, userId, total, 'ITEM_SALE', { itemId, quantity, unitPrice: item.sell_price });
    return { item, total, balance };
  })();
}

export function getFarmPlots(userId: string): FarmPlotRow[] {
  return db.prepare('SELECT plot_index, crop_id, planted_at FROM farm_plots WHERE user_id = ? ORDER BY plot_index ASC')
    .all(userId) as FarmPlotRow[];
}

export function getCrop(cropIdOrAlias: string): CropRow | undefined {
  const normalized = cropIdOrAlias.trim().toLowerCase();
  return db.prepare('SELECT * FROM crops WHERE id = ?').get(normalized) as CropRow | undefined;
}

export function plant(userId: string, cropId: string, quantity: number): { crop: CropRow; plantedPlots: number[] } {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > config.economy.maxPlots) {
    throw new Error('INVALID_QUANTITY');
  }
  return db.transaction(() => {
    const crop = getCrop(cropId);
    if (!crop) throw new Error('CROP_NOT_FOUND');

    const seedRow = db.prepare('SELECT quantity FROM inventory WHERE user_id = ? AND item_id = ?')
      .get(userId, crop.seed_item_id) as { quantity: number } | undefined;
    const ownedSeeds = seedRow?.quantity ?? 0;
    if (ownedSeeds < quantity) throw new Error('INSUFFICIENT_SEEDS');

    const emptyPlots = db.prepare(`
      SELECT plot_index FROM farm_plots
      WHERE user_id = ? AND crop_id IS NULL
      ORDER BY plot_index ASC
      LIMIT ?
    `).all(userId, quantity) as Array<{ plot_index: number }>;

    if (emptyPlots.length < quantity) throw new Error('INSUFFICIENT_LAND');

    changeInventory(db, userId, crop.seed_item_id, -quantity);
    const update = db.prepare('UPDATE farm_plots SET crop_id = ?, planted_at = ? WHERE user_id = ? AND plot_index = ?');
    const plantedAt = now();
    for (const plot of emptyPlots) update.run(crop.id, plantedAt, userId, plot.plot_index);

    return { crop, plantedPlots: emptyPlots.map((plot) => plot.plot_index) };
  })();
}

export function harvest(userId: string): {
  harvested: number;
  tbs: number;
  items: HarvestedItem[];
  details: HarvestDetail[];
} {
  return db.transaction(() => {
    const plots = getFarmPlots(userId).filter((plot) => plot.crop_id !== null);
    const ready: Array<{ plot: FarmPlotRow; crop: CropRow; yield: number; itemName: string }> = [];
    const timestamp = now();

    for (const plot of plots) {
      const crop = db.prepare('SELECT * FROM crops WHERE id = ?').get(plot.crop_id) as CropRow | undefined;
      if (!crop || plot.planted_at === null) continue;
      if (timestamp - plot.planted_at < crop.grow_seconds * 1000) continue;

      const item = db.prepare('SELECT name FROM items WHERE id = ?').get(crop.sell_item_id) as { name: string } | undefined;
      if (!item) throw new Error('CROP_REWARD_ITEM_NOT_FOUND');
      ready.push({ plot, crop, yield: randomYield(crop.min_yield, crop.max_yield), itemName: item.name });
    }

    if (ready.length === 0) throw new Error('NOT_READY');

    const updatePlot = db.prepare('UPDATE farm_plots SET crop_id = NULL, planted_at = NULL WHERE user_id = ? AND plot_index = ?');
    const totals = new Map<string, HarvestedItem>();

    for (const row of ready) {
      updatePlot.run(userId, row.plot.plot_index);
      const current = totals.get(row.crop.sell_item_id);
      const quantity = (current?.quantity ?? 0) + row.yield;
      if (!Number.isSafeInteger(quantity)) throw new Error('INVENTORY_LIMIT');
      totals.set(row.crop.sell_item_id, {
        itemId: row.crop.sell_item_id,
        itemName: row.itemName,
        quantity,
      });
    }

    const recordCollection = db.prepare(`
      INSERT INTO crop_collection (user_id, crop_id, harvested_total, first_harvested_at, last_harvested_at)
      VALUES (?, ?, ?, ?, ?)
      ON CONFLICT(user_id, crop_id) DO UPDATE SET
        harvested_total = harvested_total + excluded.harvested_total,
        last_harvested_at = excluded.last_harvested_at
    `);
    const cropCounts = new Map<string, number>();
    for (const row of ready) cropCounts.set(row.crop.id, (cropCounts.get(row.crop.id) ?? 0) + 1);
    for (const [cropId, count] of cropCounts) {
      recordCollection.run(userId, cropId, count, timestamp, timestamp);
    }

    const family = db.prepare('SELECT family_id FROM family_members WHERE user_id = ?').get(userId) as { family_id: number } | undefined;
    if (family) {
      const pointsUpdated = db.prepare('UPDATE family_groups SET points = points + ? WHERE id = ? AND points <= ?')
        .run(ready.length, family.family_id, Number.MAX_SAFE_INTEGER - ready.length);
      if (pointsUpdated.changes !== 1) throw new Error('FAMILY_POINTS_LIMIT');
    }

    for (const item of totals.values()) {
      changeInventory(db, userId, item.itemId, item.quantity);
    }

    const items = [...totals.values()];
    return {
      harvested: ready.length,
      tbs: totals.get('tbs')?.quantity ?? 0,
      items,
      details: ready.map((row) => ({
        plot: row.plot.plot_index,
        cropName: row.crop.name,
        yield: row.yield,
        itemId: row.crop.sell_item_id,
        itemName: row.itemName,
        rarity: row.crop.rarity,
      })),
    };
  })();
}

export function expandLand(userId: string): { plotIndex: number; cost: number; balance: number; totalPlots: number } {
  return db.transaction(() => {
    const current = db.prepare('SELECT COUNT(*) AS count FROM farm_plots WHERE user_id = ?').get(userId) as { count: number };
    if (current.count >= config.economy.maxPlots) throw new Error('MAX_LAND');
    const cost = calculateLandExpansionCost(current.count);
    const balance = changeBalance(db, userId, -cost, 'LAND_EXPANSION', { from: current.count, to: current.count + 1 });
    const plotIndex = current.count + 1;
    db.prepare('INSERT INTO farm_plots (user_id, plot_index) VALUES (?, ?)').run(userId, plotIndex);
    return { plotIndex, cost, balance, totalPlots: plotIndex };
  })();
}

export function claimDaily(userId: string): { reward: number; balance: number; nextAt: number } {
  const cooldown = config.economy.dailyCooldownHours * 60 * 60 * 1000;
  return db.transaction(() => {
    const timestamp = now();
    const row = db.prepare('SELECT last_claimed_at FROM daily_claims WHERE user_id = ?').get(userId) as { last_claimed_at: number } | undefined;
    if (row) {
      const availableAt = row.last_claimed_at + cooldown;
      if (availableAt > timestamp) throw Object.assign(new Error('COOLDOWN'), { availableAt });
      db.prepare('UPDATE daily_claims SET last_claimed_at = ? WHERE user_id = ?').run(timestamp, userId);
    } else {
      db.prepare('INSERT INTO daily_claims (user_id, last_claimed_at) VALUES (?, ?)').run(userId, timestamp);
    }
    const balance = changeBalance(db, userId, config.economy.dailyReward, 'DAILY_REWARD', {});
    return { reward: config.economy.dailyReward, balance, nextAt: timestamp + cooldown };
  })();
}

export function work(userId: string): { reward: number; balance: number } {
  const cooldown = config.economy.workCooldownMinutes * 60 * 1000;
  return db.transaction(() => {
    const timestamp = now();
    const row = db.prepare('SELECT available_at FROM cooldowns WHERE user_id = ? AND action = ?').get(userId, 'work') as { available_at: number } | undefined;
    if (row && row.available_at > timestamp) throw Object.assign(new Error('COOLDOWN'), { availableAt: row.available_at });
    const reward = randomYield(config.economy.workMinReward, config.economy.workMaxReward);
    db.prepare(`
      INSERT INTO cooldowns (user_id, action, available_at)
      VALUES (?, 'work', ?)
      ON CONFLICT(user_id, action) DO UPDATE SET available_at = excluded.available_at
    `).run(userId, timestamp + cooldown);
    const balance = changeBalance(db, userId, reward, 'WORK_REWARD', {});
    return { reward, balance };
  })();
}

export function getShop(): ItemRow[] {
  return db.prepare('SELECT * FROM items WHERE buy_price > 0 ORDER BY buy_price ASC').all() as ItemRow[];
}

export function getInventory(userId: string): Array<ItemRow & { quantity: number }> {
  return db.prepare(`
    SELECT i.*, inv.quantity
    FROM inventory inv
    JOIN items i ON i.id = inv.item_id
    WHERE inv.user_id = ? AND inv.quantity > 0
    ORDER BY i.type ASC, i.id ASC
  `).all(userId) as Array<ItemRow & { quantity: number }>;
}

export function getLeaderboard(limit = 10): Array<{ id: string; username: string; balance: number }> {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 100) throw new Error('INVALID_LIMIT');
  return db.prepare(`
    SELECT u.id, u.username, w.balance
    FROM wallets w
    JOIN users u ON u.id = w.user_id
    ORDER BY w.balance DESC, u.created_at ASC
    LIMIT ?
  `).all(limit) as Array<{ id: string; username: string; balance: number }>;
}


export interface CropCollectionEntry {
  crop_id: string;
  crop_name: string;
  rarity: 'common' | 'uncommon' | 'rare';
  harvested_total: number;
  first_harvested_at: number;
  last_harvested_at: number;
}

export function getCropCollection(userId: string): CropCollectionEntry[] {
  return db.prepare(`
    SELECT c.id AS crop_id, c.name AS crop_name, c.rarity,
      cc.harvested_total, cc.first_harvested_at, cc.last_harvested_at
    FROM crop_collection cc
    JOIN crops c ON c.id = cc.crop_id
    WHERE cc.user_id = ?
    ORDER BY CASE c.rarity WHEN 'rare' THEN 1 WHEN 'uncommon' THEN 2 ELSE 3 END,
      c.name ASC
  `).all(userId) as CropCollectionEntry[];
}

export function getCropCatalog(): CropRow[] {
  return db.prepare('SELECT * FROM crops ORDER BY CASE rarity WHEN \'rare\' THEN 1 WHEN \'uncommon\' THEN 2 ELSE 3 END, id ASC')
    .all() as CropRow[];
}
