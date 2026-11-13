import type { Command } from '../types/command.js';
import { getMarketHistory, getMarketPrices } from '../services/economy.service.js';
import { formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';

export const marketCommand: Command = {
  name: 'market',
  aliases: ['pasar', 'harga'],
  description: 'Lihat harga komoditas global yang berubah mengikuti volume penjualan.',
  usage: '!market [history <item>]',
  async execute({ message, args }) {
    if (args[0]?.toLowerCase() === 'history') {
      const itemId = args[1]?.toLowerCase();
      if (!itemId) {
        await message.reply({ embeds: [infoEmbed('Format salah', 'Contoh: `!market history tbs`.')] });
        return;
      }
      const history = getMarketHistory(itemId, 10);
      const lines = history.map((entry) =>
        `• **${formatNumber(entry.price)}** SawitCoin — volume ${formatNumber(entry.daily_volume)} — <t:${Math.floor(entry.recorded_at / 1000)}:R>`,
      );
      await message.reply({ embeds: [infoEmbed(`Riwayat Harga: ${itemId}`, lines.join('\n') || 'Belum ada riwayat harga untuk item itu.')] });
      return;
    }

    const prices = getMarketPrices();
    const lines = prices.map((item) => {
      const difference = item.current_price - item.previous_price;
      const trend = difference > 0 ? 'Naik' : difference < 0 ? 'Turun' : 'Stabil';
      const change = difference === 0 ? '' : ` (${difference > 0 ? '+' : ''}${formatNumber(difference)})`;
      return `**${item.item_name}** (${item.item_id})\nHarga: **${formatNumber(item.current_price)}** SawitCoin/unit — ${trend}${change}\nVolume hari ini: ${formatNumber(item.daily_volume)} / ${formatNumber(item.target_daily_volume)}`;
    });
    await message.reply({ embeds: [infoEmbed('Pasar Komoditas Global', [
      'Harga mengikuti total penjualan semua pemain. Semakin besar suplai harian, harga jual berikutnya dapat turun sampai batas minimum.',
      '',
      ...lines,
      '',
      'Lihat tren: `!market history tbs`',
    ].join('\n'))] });
  },
};
