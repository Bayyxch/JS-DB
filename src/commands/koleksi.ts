import type { Command } from '../types/command.js';
import { getCropCatalog, getCropCollection } from '../services/economy.service.js';
import { infoEmbed } from '../utils/embed.js';

const rarityLabel: Record<string, string> = {
  common: 'Common',
  uncommon: 'Uncommon',
  rare: 'Rare',
};

export const collectionCommand: Command = {
  name: 'koleksi',
  aliases: ['collection', 'dex'],
  description: 'Lihat semua tanaman dan catatan panen yang sudah ditemukan.',
  usage: '!koleksi',
  async execute({ message, userId }) {
    const catalog = getCropCatalog();
    const collected = getCropCollection(userId);
    const byId = new Map(collected.map((entry) => [entry.crop_id, entry]));
    const lines = catalog.map((crop) => {
      const entry = byId.get(crop.id);
      return entry
        ? `[✓] **${crop.name}** — ${rarityLabel[crop.rarity]} — dipanen ${entry.harvested_total} plot`
        : `[ ] **???** — ${rarityLabel[crop.rarity]} — belum ditemukan`;
    });
    await message.reply({ embeds: [infoEmbed(`Koleksi Tanaman (${collected.length}/${catalog.length})`, lines.join('\n'))] });
  },
};
