import { createCanvas, loadImage } from '@napi-rs/canvas';
import type { PlayerProfile } from './social.service.js';

const WIDTH = 1200;
const HEIGHT = 600;
const COLORS = {
  background: '#101713',
  panel: '#19251d',
  panelSoft: '#223128',
  accent: '#8eaf68',
  accentSoft: '#344b35',
  text: '#f0f3e9',
  muted: '#a6b2a0',
  line: '#354438',
};

function formatNumber(value: number): string {
  return new Intl.NumberFormat('id-ID').format(value);
}

function roundedRect(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, radius);
}

async function fetchAvatar(url?: string) {
  if (!url) return undefined;
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(4_000) });
    if (!response.ok) return undefined;
    const contentLength = Number(response.headers.get('content-length') ?? 0);
    if (contentLength > 3_000_000) return undefined;
    const bytes = Buffer.from(await response.arrayBuffer());
    if (bytes.length === 0 || bytes.length > 3_000_000) return undefined;
    return await loadImage(bytes);
  } catch {
    return undefined;
  }
}

function drawWrappedText(
  ctx: ReturnType<ReturnType<typeof createCanvas>['getContext']>,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
  maxLines: number,
): void {
  const words = text.trim().split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';

  for (const word of words) {
    const candidate = line ? `${line} ${word}` : word;
    if (ctx.measureText(candidate).width > maxWidth && line) {
      lines.push(line);
      line = word;
    } else {
      line = candidate;
    }
  }
  if (line) lines.push(line);

  const visible = lines.slice(0, maxLines);
  if (lines.length > maxLines && visible.length > 0) {
    let last = visible[visible.length - 1] ?? '';
    while (last.length > 0 && ctx.measureText(`${last}…`).width > maxWidth) {
      last = last.slice(0, -1);
    }
    visible[visible.length - 1] = `${last}…`;
  }

  visible.forEach((value, index) => ctx.fillText(value, x, y + index * lineHeight));
}

export async function renderProfileCard(profile: PlayerProfile, avatarUrl?: string): Promise<Buffer> {
  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  roundedRect(ctx, 28, 28, WIDTH - 56, HEIGHT - 56, 30);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();

  ctx.fillStyle = COLORS.accent;
  roundedRect(ctx, 28, 28, 12, HEIGHT - 56, 6);
  ctx.fill();

  ctx.fillStyle = COLORS.muted;
  ctx.font = '600 20px Arial';
  ctx.fillText('JURAGAN SAWIT  /  GLOBAL FARMER PROFILE', 76, 88);

  const avatar = await fetchAvatar(avatarUrl);
  ctx.save();
  ctx.beginPath();
  ctx.arc(160, 230, 72, 0, Math.PI * 2);
  ctx.clip();
  if (avatar) {
    const scale = Math.max(144 / avatar.width, 144 / avatar.height);
    const drawWidth = avatar.width * scale;
    const drawHeight = avatar.height * scale;
    ctx.drawImage(avatar, 160 - drawWidth / 2, 230 - drawHeight / 2, drawWidth, drawHeight);
  } else {
    ctx.fillStyle = COLORS.accentSoft;
    ctx.fillRect(88, 158, 144, 144);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 58px Arial';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((profile.username[0] ?? '?').toUpperCase(), 160, 232);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  }
  ctx.restore();

  ctx.fillStyle = COLORS.text;
  ctx.font = '700 48px Arial';
  ctx.fillText(profile.username.slice(0, 24), 270, 205);

  ctx.fillStyle = COLORS.muted;
  ctx.font = '24px Arial';
  drawWrappedText(ctx, profile.bio || 'Petani sawit yang sedang membangun kebun.', 272, 250, 800, 34, 2);

  ctx.fillStyle = COLORS.line;
  ctx.fillRect(76, 340, WIDTH - 152, 1);

  const cards = [
    { x: 76, label: 'SAWITCOIN', value: formatNumber(profile.balance) },
    { x: 350, label: 'LAHAN TERISI', value: `${formatNumber(profile.planted_plots)} / ${formatNumber(profile.farm_plots)}` },
    { x: 624, label: 'TEMAN', value: formatNumber(profile.friend_count) },
  ];

  for (const card of cards) {
    roundedRect(ctx, card.x, 380, 250, 132, 18);
    ctx.fillStyle = COLORS.panelSoft;
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 17px Arial';
    ctx.fillText(card.label, card.x + 22, 420);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 32px Arial';
    ctx.fillText(card.value, card.x + 22, 470);
  }

  ctx.fillStyle = COLORS.muted;
  ctx.font = '18px Arial';
  const joined = new Intl.DateTimeFormat('id-ID', { dateStyle: 'medium' }).format(new Date(profile.created_at));
  ctx.fillText(`Bergabung ${joined}`, 910, 432);
  ctx.fillText(`ID ${profile.id}`, 910, 466);

  return canvas.encode('png');
}


export interface LeaderboardVisualEntry {
  username: string;
  balance: number;
}

export interface FarmVisualPlot {
  plot_index: number;
  cropName: string | null;
  state: string;
}

export interface InventoryVisualItem {
  name: string;
  quantity: number;
  type: string;
}

export interface ShopVisualItem {
  id: string;
  name: string;
  buy_price: number;
  description: string;
}

function createListCanvas(title: string, subtitle: string, itemCount: number, columns = 1) {
  const rows = Math.max(1, Math.ceil(itemCount / columns));
  const cardHeight = columns === 1 ? 72 : 126;
  const canvas = createCanvas(WIDTH, 210 + rows * (cardHeight + 14));
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  roundedRect(ctx, 24, 24, canvas.width - 48, canvas.height - 48, 28);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 34px Arial';
  ctx.fillText(title, 64, 86);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '20px Arial';
  ctx.fillText(subtitle, 64, 124);
  ctx.fillStyle = COLORS.line;
  ctx.fillRect(64, 150, canvas.width - 128, 1);
  return { canvas, ctx, top: 174, cardHeight };
}

export async function renderLeaderboardCard(entries: LeaderboardVisualEntry[]): Promise<Buffer> {
  const { canvas, ctx, top, cardHeight } = createListCanvas(
    'GLOBAL LEADERBOARD',
    'Peringkat pemain berdasarkan saldo SawitCoin',
    entries.length,
  );
  entries.forEach((entry, index) => {
    const y = top + index * (cardHeight + 10);
    roundedRect(ctx, 64, y, WIDTH - 128, cardHeight, 16);
    ctx.fillStyle = index < 3 ? COLORS.accentSoft : COLORS.panelSoft;
    ctx.fill();
    ctx.fillStyle = index < 3 ? COLORS.accent : COLORS.muted;
    ctx.font = '700 26px Arial';
    ctx.fillText(index === 0 ? '01' : String(index + 1).padStart(2, '0'), 88, y + 44);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 25px Arial';
    ctx.fillText(entry.username.slice(0, 28), 160, y + 43);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.accent;
    ctx.font = '700 25px Arial';
    ctx.fillText(`${formatNumber(entry.balance)} SC`, WIDTH - 88, y + 43);
    ctx.textAlign = 'left';
  });
  return canvas.encode('png');
}

export async function renderFarmCard(data: {
  username: string;
  balance: number;
  planted: number;
  total: number;
  ready: number;
  seeds: number;
  tbs: number;
  plots: FarmVisualPlot[];
}): Promise<Buffer> {
  const columns = 4;
  const rows = Math.max(1, Math.ceil(data.plots.length / columns));
  const canvas = createCanvas(WIDTH, 350 + rows * 112);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = COLORS.background;
  ctx.fillRect(0, 0, WIDTH, canvas.height);
  roundedRect(ctx, 24, 24, WIDTH - 48, canvas.height - 48, 28);
  ctx.fillStyle = COLORS.panel;
  ctx.fill();
  ctx.fillStyle = COLORS.accent;
  ctx.font = '700 34px Arial';
  ctx.fillText(`KEBUN / ${data.username.slice(0, 22).toUpperCase()}`, 64, 82);
  ctx.fillStyle = COLORS.muted;
  ctx.font = '20px Arial';
  ctx.fillText(`${formatNumber(data.balance)} SawitCoin   •   ${data.planted}/${data.total} lahan   •   ${data.ready} siap panen`, 64, 120);

  const stats = [
    { label: 'BIBIT SAWIT', value: formatNumber(data.seeds) },
    { label: 'TBS TERSIMPAN', value: formatNumber(data.tbs) },
    { label: 'LAHAN AKTIF', value: `${data.planted}/${data.total}` },
  ];
  stats.forEach((stat, index) => {
    const x = 64 + index * 355;
    roundedRect(ctx, x, 150, 320, 92, 16);
    ctx.fillStyle = COLORS.panelSoft;
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 15px Arial';
    ctx.fillText(stat.label, x + 18, 182);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 26px Arial';
    ctx.fillText(stat.value, x + 18, 218);
  });

  data.plots.forEach((plot, index) => {
    const x = 64 + (index % columns) * 270;
    const y = 270 + Math.floor(index / columns) * 104;
    roundedRect(ctx, x, y, 244, 86, 14);
    ctx.fillStyle = plot.state === 'ready' ? COLORS.accentSoft : plot.cropName ? COLORS.panelSoft : '#17201a';
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 15px Arial';
    ctx.fillText(`PLOT #${plot.plot_index}`, x + 16, y + 28);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 19px Arial';
    ctx.fillText((plot.cropName ?? 'Kosong').slice(0, 19), x + 16, y + 57);
    ctx.textAlign = 'right';
    ctx.fillStyle = plot.state === 'ready' ? COLORS.accent : COLORS.muted;
    ctx.font = '600 14px Arial';
    ctx.fillText(plot.state === 'ready' ? 'SIAP PANEN' : plot.state === 'empty' ? 'KOSONG' : plot.state, x + 226, y + 28);
    ctx.textAlign = 'left';
  });
  return canvas.encode('png');
}

export async function renderInventoryCard(username: string, items: InventoryVisualItem[]): Promise<Buffer> {
  const { canvas, ctx, top, cardHeight } = createListCanvas(
    'INVENTORY',
    `Persediaan milik ${username.slice(0, 32)}`,
    items.length,
    2,
  );
  const columns = 2;
  items.forEach((item, index) => {
    const x = 64 + (index % columns) * 536;
    const y = top + Math.floor(index / columns) * (cardHeight + 14);
    roundedRect(ctx, x, y, 510, cardHeight, 16);
    ctx.fillStyle = COLORS.panelSoft;
    ctx.fill();
    ctx.fillStyle = COLORS.muted;
    ctx.font = '600 15px Arial';
    ctx.fillText(item.type.slice(0, 22).toUpperCase(), x + 20, y + 28);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 23px Arial';
    ctx.fillText(item.name.slice(0, 25), x + 20, y + 62);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.accent;
    ctx.font = '700 22px Arial';
    ctx.fillText(`x${formatNumber(item.quantity)}`, x + 480, y + 47);
    ctx.textAlign = 'left';
  });
  if (items.length === 0) {
    ctx.fillStyle = COLORS.muted;
    ctx.font = '24px Arial';
    ctx.fillText('Inventory masih kosong.', 64, top + 44);
  }
  return canvas.encode('png');
}

export async function renderShopCard(items: ShopVisualItem[]): Promise<Buffer> {
  const { canvas, ctx, top, cardHeight } = createListCanvas(
    'TOKO PERKEBUNAN',
    'Perlengkapan dan kebutuhan untuk mengelola kebun sawit',
    items.length,
    2,
  );
  items.forEach((item, index) => {
    const x = 64 + (index % 2) * 536;
    const y = top + Math.floor(index / 2) * (cardHeight + 14);
    roundedRect(ctx, x, y, 510, cardHeight, 16);
    ctx.fillStyle = COLORS.panelSoft;
    ctx.fill();
    ctx.fillStyle = COLORS.accent;
    ctx.font = '600 15px Arial';
    ctx.fillText(item.id.toUpperCase(), x + 20, y + 27);
    ctx.fillStyle = COLORS.text;
    ctx.font = '700 23px Arial';
    ctx.fillText(item.name.slice(0, 28), x + 20, y + 58);
    ctx.textAlign = 'right';
    ctx.fillStyle = COLORS.accent;
    ctx.font = '700 20px Arial';
    ctx.fillText(`${formatNumber(item.buy_price)} SC`, x + 480, y + 32);
    ctx.textAlign = 'left';
    ctx.fillStyle = COLORS.muted;
    ctx.font = '15px Arial';
    drawWrappedText(ctx, item.description, x + 20, y + 84, 465, 19, 2);
  });
  return canvas.encode('png');
}
