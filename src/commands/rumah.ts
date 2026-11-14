import type { Command } from '../types/command.js';
import { getHouse, upgradeHouse } from '../services/housing-pet.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const houseCommand: Command = {
  name: 'house',
  aliases: ['rumah'],
  description: 'Lihat dan tingkatkan rumah global pemain.',
  usage: '!house [upgrade]',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'upgrade') {
      const house = upgradeHouse(userId);
      await message.reply({ embeds: [successEmbed('Rumah ditingkatkan', `Rumah sekarang **Level ${house.level}**. Bonus petualangan meningkat dan zona baru mungkin terbuka. Biaya upgrade berikutnya: ${house.next_upgrade_cost === null ? 'Maksimum' : formatNumber(house.next_upgrade_cost) + ' SawitCoin'}.`)] });
      return;
    }
    const house = getHouse(userId);
    await message.reply({ embeds: [infoEmbed('Rumah Pemain', [
      `Level rumah: **${house.level}/5**`,
      `Bonus petualangan: **+${(house.level - 1) * 5}%**`,
      `Upgrade berikutnya: **${house.next_upgrade_cost === null ? 'Maksimum' : formatNumber(house.next_upgrade_cost) + ' SawitCoin'}**`,
      '',
      'Upgrade rumah membuka area petualangan yang lebih jauh.',
      'Gunakan `!house upgrade` untuk meningkatkan rumah.',
    ].join('\n'))] });
  },
};
