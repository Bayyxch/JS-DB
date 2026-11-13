import type Database from 'better-sqlite3';
import { config } from '../config/env.js';
import { db } from '../db/database.js';
import { calculateLandExpansionCost as calculateLandExpansionCostFormula, randomIntInclusive } from '../utils/economy.js';
import { getCurrentWorldEvent } from './world-event.service.js';

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

export interface CropCollectionEntry {
  crop_id: string;
  crop_name: string;
  total_harvested: number;
  first_harvested_at: number | null;
  discovered: number;
}

export interface MarketPrice {
  item_id: string;
  item_name: string;
  base_price: number;
  current_price: number;
  previous_price: number;
  floor_price: number;
  target_daily_volume: number;
  daily_volume: number;
  day_key: string;
  updated_at: number;
}

export interface MarketHistoryEntry {
  price: number;
  daily_volume: number;
  recorded_at: number;
}

export interface HarvestDetail {
  plot: number;
  cropName: string;
  yield: number;
  itemId: string;
  itemName: string;
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

function marketDayKey(timestamp: number): string {
  return new Date(timestamp).toISOString().slice(0, 10);
}

function refreshMarketPrice(itemId: string, timestamp: number): MarketPrice | undefined {
  const row = db.prepare(`
    SELECT mp.*, i.name AS item_name
    FROM market_prices mp JOIN items i ON i.id = mp.item_id
    WHERE mp.item_id = ?
  `).get(itemId) as MarketPrice | undefined;
  if (!row) return undefined;
  const dayKey = marketDayKey(timestamp);
  if (row.day_key !== dayKey) {
    db.prepare(`
      UPDATE market_prices
      SET previous_price = current_price, current_price = base_price,
          daily_volume = 0, day_key = ?, updated_at = ?
      WHERE item_id = ?
    `).run(dayKey, timestamp, itemId);
    db.prepare('INSERT INTO market_price_history (item_id, price, daily_volume, recorded_at) VALUES (?, ?, 0, ?)')
      .run(itemId, row.base_price, timestamp);
  }
  return db.prepare(`
    SELECT mp.*, i.name AS item_name
    FROM market_prices mp JOIN items i ON i.id = mp.item_id
    WHERE mp.item_id = ?
  `).get(itemId) as MarketPrice;
}

export function sellItem(userId: string, itemId: string, quantity: number): {
  item: ItemRow;
  total: number;
  balance: number;
  unitPrice: number;
  nextMarketPrice: number;
} {
  if (!Number.isSafeInteger(quantity) || quantity <= 0 || quantity > 1_000_000_000) throw new Error('INVALID_QUANTITY');
  return db.transaction(() => {
    const item = db.prepare('SELECT * FROM items WHERE id = ? AND sell_price > 0').get(itemId) as ItemRow | undefined;
    if (!item) throw new Error('ITEM_NOT_SELLABLE');
    const timestamp = now();
    const market = refreshMarketPrice(itemId, timestamp);
    const unitPrice = market?.current_price ?? item.sell_price;
    changeInventory(db, userId, item.id, -quantity);
    const total = unitPrice * quantity;
    if (!Number.isSafeInteger(total)) throw new Error('INVALID_AMOUNT');
    const balance = changeBalance(db, userId, total, 'ITEM_SALE', { itemId, quantity, unitPrice, marketDay: market?.day_key ?? null });

    let nextMarketPrice = unitPrice;
    if (market) {
      const nextVolume = market.daily_volume + quantity;
      if (!Number.isSafeInteger(nextVolume)) throw new Error('MARKET_VOLUME_LIMIT');
      const pressure = Math.min(0.4, (nextVolume / market.target_daily_volume) * 0.4);
      nextMarketPrice = Math.max(market.floor_price, Math.min(market.base_price, Math.round(market.base_price * (1 - pressure))));
      db.prepare(`
        UPDATE market_prices
        SET previous_price = current_price, current_price = ?, daily_volume = ?, updated_at = ?
        WHERE item_id = ?
      `).run(nextMarketPrice, nextVolume, timestamp, itemId);
      if (nextMarketPrice !== unitPrice) {
        db.prepare('INSERT INTO market_price_history (item_id, price, daily_volume, recorded_at) VALUES (?, ?, ?, ?)')
          .run(itemId, nextMarketPrice, nextVolume, timestamp);
      }
    }
    return { item, total, balance, unitPrice, nextMarketPrice };
  })();
}

export function getMarketPrices(): MarketPrice[] {
  return db.transaction(() => {
    const timestamp = now();
    const ids = db.prepare('SELECT item_id FROM market_prices').all() as Array<{ item_id: string }>;
    for (const row of ids) refreshMarketPrice(row.item_id, timestamp);
    return db.prepare(`
      SELECT mp.*, i.name AS item_name
      FROM market_prices mp JOIN items i ON i.id = mp.item_id
      ORDER BY mp.item_id ASC
    `).all() as MarketPrice[];
  })();
}

export function getMarketHistory(itemId: string, limit = 5): MarketHistoryEntry[] {
  if (!Number.isSafeInteger(limit) || limit < 1 || limit > 20) throw new Error('INVALID_LIMIT');
  return db.prepare(`
    SELECT price, daily_volume, recorded_at
    FROM market_price_history WHERE item_id = ?
    ORDER BY recorded_at DESC, id DESC LIMIT ?
  `).all(itemId, limit) as MarketHistoryEntry[];
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
    const worldEvent = getCurrentWorldEvent(timestamp);

    for (const plot of plots) {
      const crop = db.prepare('SELECT * FROM crops WHERE id = ?').get(plot.crop_id) as CropRow | undefined;
      if (!crop || plot.planted_at === null) continue;
      if (timestamp - plot.planted_at < crop.grow_seconds * 1000) continue;

      const item = db.prepare('SELECT name FROM items WHERE id = ?').get(crop.sell_item_id) as { name: string } | undefined;
      if (!item) throw new Error('CROP_REWARD_ITEM_NOT_FOUND');
      ready.push({ plot, crop, yield: Math.max(1, Math.floor(randomYield(crop.min_yield, crop.max_yield) * worldEvent.harvestMultiplier)), itemName: item.name });
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

    for (const item of totals.values()) {
      changeInventory(db, userId, item.itemId, item.quantity);
    }

    const cropTotals = new Map<string, number>();
    for (const row of ready) {
      cropTotals.set(row.crop.id, (cropTotals.get(row.crop.id) ?? 0) + row.yield);
    }
    const recordDiscovery = db.prepare(`
      INSERT INTO crop_discoveries (user_id, crop_id, first_harvested_at, total_harvested)
      VALUES (?, ?, ?, ?)
      ON CONFLICT(user_id, crop_id) DO UPDATE
      SET total_harvested = total_harvested + excluded.total_harvested
    `);
    for (const [cropId, quantity] of cropTotals) {
      recordDiscovery.run(userId, cropId, timestamp, quantity);
    }

    const companyYield = [...cropTotals.values()].reduce((sum, quantity) => sum + quantity, 0);
    if (!Number.isSafeInteger(companyYield)) throw new Error('COMPANY_PROGRESS_LIMIT');
    const membership = db.prepare('SELECT company_id FROM company_members WHERE user_id = ?')
      .get(userId) as { company_id: number } | undefined;
    if (membership) {
      const company = db.prepare('SELECT total_harvested FROM companies WHERE id = ?')
        .get(membership.company_id) as { total_harvested: number } | undefined;
      if (!company || !Number.isSafeInteger(company.total_harvested + companyYield)) {
        throw new Error('COMPANY_PROGRESS_LIMIT');
      }
      db.prepare('UPDATE companies SET total_harvested = total_harvested + ? WHERE id = ?')
        .run(companyYield, membership.company_id);
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


export function getCropCollection(userId: string): CropCollectionEntry[] {
  return db.prepare(`
    SELECT c.id AS crop_id, c.name AS crop_name,
      COALESCE(d.total_harvested, 0) AS total_harvested,
      d.first_harvested_at,
      CASE WHEN d.user_id IS NULL THEN 0 ELSE 1 END AS discovered
    FROM crops c
    LEFT JOIN crop_discoveries d ON d.crop_id = c.id AND d.user_id = ?
    ORDER BY c.id ASC
  `).all(userId) as CropCollectionEntry[];
}
