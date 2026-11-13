import type { Command } from '../types/command.js';
import { getAdventureProgress, runExpedition } from '../services/adventure.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const expeditionCommand: Command = {
  name: 'ekspedisi',
  aliases: ['explore', 'adventure'],
  description: 'Jelajahi area sekitar dan kumpulkan resource tanpa pertarungan.',
  usage: '!ekspedisi [status]',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'status') {
      const progress = getAdventureProgress(userId);
      await message.reply({ embeds: [infoEmbed('Progres Ekspedisi', [
        'Level: **' + progress.level + '**',
        'XP: **' + progress.xp + '**',
        'Ekspedisi selesai: **' + progress.expeditions_completed + '**',
        'Cooldown ekspedisi: **2 jam**',
      ].join('\n'))] });
      return;
    }
    const result = runExpedition(userId);
    await message.reply({ embeds: [successEmbed('Ekspedisi berhasil', [
      'Menemukan **' + result.itemName + ' x' + formatNumber(result.quantity) + '**.',
      'XP petualangan: **' + result.xp + '** (Lv. ' + result.level + ')',
      'Total ekspedisi: **' + result.completed + '**',
      'Event aktif: **' + result.eventName + '**',
      'Ekspedisi berikutnya <t:' + Math.floor(result.nextAt / 1000) + ':R>.',
    ].join('\n'))] });
  },
};
