import type { Command } from '../types/command.js';
import { getCropCollection } from '../services/economy.service.js';
import { infoEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const collectionCommand: Command = {
  name: 'collection',
  aliases: ['crops', 'koleksi'],
  description: 'Lihat katalog tanaman dan catatan hasil panen global.',
  usage: '!collection',
  async execute({ message, userId }) {
    const crops = getCropCollection(userId);
    const discovered = crops.filter((crop) => crop.discovered === 1).length;
    const lines = crops.map((crop) => {
      const status = crop.discovered ? 'Ditemukan' : 'Belum ditemukan';
      return `**${crop.crop_name}** — ${status}\nTotal panen: ${formatNumber(crop.total_harvested)}`;
    });
    await message.reply({
      embeds: [infoEmbed(`Koleksi Tanaman (${discovered}/${crops.length})`, lines.join('\n\n') || 'Belum ada tanaman di katalog.')],
    });
  },
};
