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
