import type { Command } from '../types/command.js';
import { harvest } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { successEmbed, warningEmbed, errorEmbed } from '../utils/embed.js';
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

      const description = [
        `Event panen: **${result.event.name}**`,
        result.event.description,
        `Event dunia: **${result.worldEventName}**`,
        '',
        `Plot dipanen: ${formatNumber(result.harvested)}`,
        '',
        `Hasil panen:`,
        totals,
        '',
        details,
      ].join('\n');
      const embed = result.event.kind === 'negative'
        ? warningEmbed(`${config.emoji.palm} Panen selesai dengan kendala`, description)
        : successEmbed(`${config.emoji.palm} Panen berhasil`, description);

      await message.reply({ embeds: [embed] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Panen gagal', friendlyError(error))] });
    }
  },
};
