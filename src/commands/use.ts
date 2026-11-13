import type { Command } from '../types/command.js';
import { useGrowthBooster } from '../services/economy.service.js';
import { errorEmbed, successEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';

export const useCommand: Command = {
  name: 'use',
  description: 'Gunakan item consumable.',
  usage: '!use growth_boost',
  async execute({ message, userId, args }) {
    try {
      const item = args[0]?.toLowerCase();
      if (item !== 'growth_boost') throw new Error('USE_ITEM_NOT_SUPPORTED');
      const plots = useGrowthBooster(userId);
      await message.reply({ embeds: [successEmbed('Growth Booster digunakan', `Waktu tumbuh dipercepat 10 detik pada ${plots} plot yang sedang ditanami.`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Item gagal digunakan', friendlyError(error))] });
    }
  },
};
