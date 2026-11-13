import { AttachmentBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { harvest } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { successEmbed, warningEmbed, errorEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';
import { renderHarvestCard } from '../services/visual.service.js';

export const panenCommand: Command = {
  name: 'panen',
  aliases: ['harvest'],
  description: 'Panen semua tanaman sawit yang sudah matang.',
  usage: '!panen',
  cooldownMs: 2500,
  async execute({ message, userId }) {
    try {
      const result = harvest(userId);
      try {
        const image = await renderHarvestCard({
          username: message.author.username,
          eventName: result.event.name,
          eventDescription: result.event.description,
          worldEventName: result.worldEventName,
          harvested: result.harvested,
          items: result.items.map((item) => ({ itemName: item.itemName, quantity: item.quantity })),
        });
        const eventEmbed = result.event.kind === 'negative'
          ? warningEmbed(`${config.emoji.warning} Panen selesai dengan kendala`, `Event: **${result.event.name}** • Event dunia: **${result.worldEventName}**\nEXP: +${formatNumber(result.xpAwarded)} • Level ${result.level}${result.levelsGained ? ` (naik ${result.levelsGained} level!)` : ''}${result.rareDrop ? '\nRARE DROP: Ultimate Palm x1' : ''}`)
          : successEmbed(`${config.emoji.palm} Panen berhasil`, `Event: **${result.event.name}** • Event dunia: **${result.worldEventName}**\nEXP: +${formatNumber(result.xpAwarded)} • Level ${result.level}${result.levelsGained ? ` (naik ${result.levelsGained} level!)` : ''}${result.rareDrop ? '\nRARE DROP: Ultimate Palm x1' : ''}`);
        await message.reply({ files: [new AttachmentBuilder(image, { name: 'hasil-panen.png' })], embeds: [eventEmbed] });
      } catch {
        const details = result.details.map((row) => `Plot #${row.plot}: ${row.cropName} +${formatNumber(row.yield)} ${row.itemName}`).join('\n');
        const totals = result.items.map((item) => `${item.itemName}: **+${formatNumber(item.quantity)}**`).join('\n');
        const description = [
          `Event panen: **${result.event.name}**`, result.event.description,
          `Event dunia: **${result.worldEventName}**`, `EXP: +${formatNumber(result.xpAwarded)} • Level ${result.level}${result.levelsGained ? ` (naik ${result.levelsGained} level!)` : ''}`, result.rareDrop ? 'RARE DROP: Ultimate Palm x1' : '', '', `Plot dipanen: ${formatNumber(result.harvested)}`,
          '', 'Hasil panen:', totals, '', details,
        ].join('\n');
        const embed = result.event.kind === 'negative'
          ? warningEmbed(`${config.emoji.palm} Panen selesai dengan kendala`, description)
          : successEmbed(`${config.emoji.palm} Panen berhasil`, description);
        await message.reply({ embeds: [embed] });
      }
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Panen gagal', friendlyError(error))] });
    }
  },
};
