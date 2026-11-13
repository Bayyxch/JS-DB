import type { Command } from '../types/command.js';
import { getHome, upgradeHome } from '../services/home.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const homeCommand: Command = {
  name: 'rumah',
  aliases: ['home'],
  description: 'Lihat dan tingkatkan rumah untuk membuka slot hewan.',
  usage: '!rumah [upgrade]',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'upgrade') {
      const result = upgradeHome(userId);
      await message.reply({ embeds: [successEmbed('Rumah ditingkatkan', [
        'Level rumah: **' + result.home.level + '/5**',
        'Biaya: **' + formatNumber(result.cost) + ' SawitCoin**',
        'Slot hewan: **' + result.petSlots + '**',
      ].join('\n'))] });
      return;
    }
    const home = getHome(userId);
    await message.reply({ embeds: [infoEmbed('Rumah Pemain', [
      'Level: **' + home.level + '/5**',
      'Slot hewan: **' + (home.level + 1) + '**',
      'Upgrade berikutnya: **' + (home.level >= 5 ? 'Maksimum' : formatNumber(home.level * 8000) + ' SawitCoin') + '**',
      'Gunakan !rumah upgrade untuk memperluas rumah.',
    ].join('\n'))] });
  },
};
