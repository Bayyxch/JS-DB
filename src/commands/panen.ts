import type { Command } from '../types/command.js';
import { harvest } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { successEmbed, errorEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';

export const panenCommand: Command = {
  name: 'panen',
  aliases: ['harvest'],
  description: 'Panen semua tanaman yang sudah matang.',
  usage: '!panen',
  cooldownMs: 2500,
  async execute({ message, userId }) {
    try {
      const result = harvest(userId);
      const details = result.details
        .map((row) => `Plot #${row.plot}: ${row.cropName} +${formatNumber(row.yield)} ${row.itemName}`)
        .join('\n');
      const totals = result.items
        .map((item) => `${item.itemName}: **+${formatNumber(item.quantity)}**`)
        .join('\n');

      await message.reply({
        embeds: [successEmbed(
          `${config.emoji.palm} Panen berhasil`,
          `Plot dipanen: ${formatNumber(result.harvested)}\n\nHasil panen:\n${totals}\n\n${details}`,
        )],
      });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Panen gagal', friendlyError(error))] });
    }
  },
};
