import type { Command } from '../types/command.js';
import { sellItem } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { parseQuantity } from '../utils/command-args.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';

export const sellCommand: Command = {
  name: 'sell',
  aliases: ['jual'],
  description: 'Jual resource yang bisa dijual.',
  usage: '!sell <item> <jumlah>',
  cooldownMs: 1500,
  async execute({ message, userId, args }) {
    const parsed = parseQuantity(args, 'tbs');
    if (!parsed) {
      await message.reply({ embeds: [errorEmbed('Format salah', 'Contoh: `!sell tbs 20`')] });
      return;
    }
    try {
      const result = sellItem(userId, parsed.item, parsed.quantity);
      await message.reply({ embeds: [successEmbed(`${config.emoji.success} Penjualan berhasil`, `${result.item.name} x${formatNumber(parsed.quantity)}\nHarga/unit: ${formatNumber(result.unitPrice)} SawitCoin\nDiterima: ${formatNumber(result.total)} SawitCoin\nHarga pasar berikutnya: ${formatNumber(result.nextMarketPrice)}\nSaldo: ${formatNumber(result.balance)}`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Penjualan gagal', friendlyError(error))] });
    }
  },
};
