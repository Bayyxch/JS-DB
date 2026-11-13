import type { Command } from '../types/command.js';
import { equipItem } from '../services/economy.service.js';
import { errorEmbed, successEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';

export const equipCommand: Command = {
  name: 'equip',
  description: 'Pakai equipment yang dimiliki.',
  usage: '!equip <item_id>',
  async execute({ message, userId, args }) {
    try {
      const itemId = args[0]?.toLowerCase();
      if (!itemId) throw new Error('EQUIPMENT_NOT_FOUND');
      const result = equipItem(userId, itemId);
      await message.reply({ embeds: [successEmbed('Equipment dipasang', `${result.name} aktif di slot ${result.slot}.`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Gagal memasang equipment', friendlyError(error))] });
    }
  },
};
