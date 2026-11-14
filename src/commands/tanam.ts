import type { Command } from '../types/command.js';
import { plant } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { parseQuantity } from '../utils/command-args.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';
import { friendlyError } from '../utils/errors.js';

export const tanamCommand: Command = {
  name: 'plant',
  aliases: ['tanam'],
  description: 'Tanam sawit di lahan kosong.',
  usage: '!plant [basic] [jumlah]',
  cooldownMs: 2500,
  async execute({ message, userId, args }) {
    const parsed = parseQuantity(args, 'basic');
    if (!parsed) {
      await message.reply({ embeds: [errorEmbed('Format salah', 'Contoh: `!plant 4` atau `!plant basic 4`')] });
      return;
    }
    try {
      const result = plant(userId, parsed.item, parsed.quantity);
      const grow = result.crop.grow_seconds;
      await message.reply({ embeds: [successEmbed(`${config.emoji.palm} Penanaman berhasil`, `Tanaman: ${result.crop.name}\nPlot: ${result.plantedPlots.map((plot) => `#${plot}`).join(', ')}\nJumlah: ${formatNumber(result.plantedPlots.length)}\nWaktu tumbuh: ${grow} detik\n\nGunakan \`${config.prefix}panen\` saat matang.`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Penanaman gagal', friendlyError(error))] });
    }
  },
};
