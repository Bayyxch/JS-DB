import type { Command } from '../types/command.js';
import { plant } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { parseQuantity } from '../utils/command-args.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';
import { friendlyError } from '../utils/errors.js';

export const tanamCommand: Command = {
  name: 'tanam',
  aliases: ['plant'],
  description: 'Tanam berbagai jenis tanaman di lahan kosong.',
  usage: '!tanam [crop_id] [jumlah]',
  cooldownMs: 2500,
  async execute({ message, userId, args }) {
    const parsed = parseQuantity(args, 'basic');
    if (!parsed) {
      await message.reply({ embeds: [errorEmbed('Format salah', 'Contoh: `!tanam 4`, `!tanam corn 2`, atau `!tanam cacao 1`')] });
      return;
    }
    try {
      const result = plant(userId, parsed.item, parsed.quantity);
      const grow = Math.floor(result.crop.grow_seconds / 60);
      await message.reply({ embeds: [successEmbed(`${config.emoji.palm} Penanaman berhasil`, `Tanaman: ${result.crop.name}\nPlot: ${result.plantedPlots.map((plot) => `#${plot}`).join(', ')}\nJumlah: ${formatNumber(result.plantedPlots.length)}\nWaktu tumbuh: ${grow} menit\n\nGunakan \`${config.prefix}panen\` saat matang.`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Penanaman gagal', friendlyError(error))] });
    }
  },
};
