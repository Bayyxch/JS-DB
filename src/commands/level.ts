import type { Command } from '../types/command.js';
import { getPlayerProgress } from '../services/economy.service.js';
import { formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';

export const levelCommand: Command = {
  name: 'level',
  aliases: ['lvl', 'rank'],
  description: 'Lihat level dan EXP pemain.',
  usage: '!level',
  async execute({ message, userId }) {
    const progress = getPlayerProgress(userId);
    const remaining = Math.max(0, progress.nextLevelXp - progress.xp);
    await message.reply({
      embeds: [infoEmbed('Player Level', [
        `Level: **${progress.level}**`,
        `EXP: **${formatNumber(progress.xp)} / ${formatNumber(progress.nextLevelXp)}**`,
        `Menuju level berikutnya: ${formatNumber(remaining)} EXP`,
        '',
        'EXP didapat dari panen dan adventure.',
      ].join('\n'))],
    });
  },
};
