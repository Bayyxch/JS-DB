import { AttachmentBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { config } from '../config/env.js';
import { getFarmPlots, getBalance } from '../services/economy.service.js';
import { formatDuration, formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';
import { db } from '../db/database.js';
import { renderFarmCard, type FarmVisualPlot } from '../services/visual.service.js';

export const kebunCommand: Command = {
  name: 'farm',
  aliases: ['kebun'],
  description: 'Lihat kondisi kebun lo.',
  usage: '!farm',
  async execute({ message, userId }) {
    const plots = getFarmPlots(userId);
    const visualPlots: FarmVisualPlot[] = [];
    let ready = 0;
    let planted = 0;
    let nextGrow = Number.POSITIVE_INFINITY;

    for (const plot of plots) {
      if (plot.crop_id === null || plot.planted_at === null) {
        visualPlots.push({ plot_index: plot.plot_index, cropName: null, state: 'empty' });
        continue;
      }
      planted += 1;
      const crop = db.prepare('SELECT name, grow_seconds FROM crops WHERE id = ?')
        .get(plot.crop_id) as { name: string; grow_seconds: number } | undefined;
      if (!crop) {
        visualPlots.push({ plot_index: plot.plot_index, cropName: 'Data tidak tersedia', state: 'Periksa data' });
        continue;
      }
      const remaining = plot.planted_at + crop.grow_seconds * 1000 - Date.now();
      if (remaining <= 0) {
        ready += 1;
        visualPlots.push({ plot_index: plot.plot_index, cropName: crop.name, state: 'ready' });
      } else {
        nextGrow = Math.min(nextGrow, remaining);
        visualPlots.push({ plot_index: plot.plot_index, cropName: crop.name, state: formatDuration(remaining) });
      }
    }

    const inventoryTbs = db.prepare("SELECT quantity FROM inventory WHERE user_id = ? AND item_id = 'tbs'").get(userId) as { quantity: number } | undefined;
    const seeds = db.prepare("SELECT quantity FROM inventory WHERE user_id = ? AND item_id = 'seed_basic'").get(userId) as { quantity: number } | undefined;
    const balance = getBalance(userId);

    try {
      const image = await renderFarmCard({ username: message.author.username, balance, planted, total: plots.length, ready, seeds: seeds?.quantity ?? 0, tbs: inventoryTbs?.quantity ?? 0, plots: visualPlots });
      await message.reply({ files: [new AttachmentBuilder(image, { name: 'kebun.png' })] });
    } catch {
      const lines = visualPlots.map((plot) => `#${plot.plot_index} — ${plot.cropName ?? 'Kosong'} — ${plot.state === 'ready' ? 'SIAP PANEN' : plot.state}`);
      const summary = [
        `${config.emoji.coin} Saldo: **${formatNumber(balance)}**`,
        `${config.emoji.land} Lahan: **${planted}/${plots.length}** terisi`,
        `${config.emoji.palm} Siap panen: **${ready}** plot`,
        `${config.emoji.seed} Bibit Sawit: **${formatNumber(seeds?.quantity ?? 0)}**`,
        `${config.emoji.tbs} TBS: **${formatNumber(inventoryTbs?.quantity ?? 0)}**`,
        nextGrow !== Number.POSITIVE_INFINITY ? `Panen terdekat: **${formatDuration(nextGrow)}**` : 'Panen terdekat: **belum ada tanaman aktif**',
        '', lines.join('\n'),
      ].join('\n');
      await message.reply({ embeds: [infoEmbed(`${config.emoji.palm} Kebun ${message.author.username}`, summary)] });
    }
  },
};
