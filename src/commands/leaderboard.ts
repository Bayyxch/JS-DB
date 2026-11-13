import { AttachmentBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { getLeaderboard } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';
import { renderLeaderboardCard } from '../services/visual.service.js';

export const leaderboardCommand: Command = {
  name: 'leaderboard',
  aliases: ['lb'],
  description: 'Lihat 10 saldo terbesar.',
  usage: '!leaderboard',
  cooldownMs: 5000,
  async execute({ message }) {
    const entries = getLeaderboard(10);
    if (entries.length === 0) {
      await message.reply({ embeds: [infoEmbed('Leaderboard', 'Belum ada pemain.')] });
      return;
    }
    try {
      const image = await renderLeaderboardCard(entries);
      await message.reply({ files: [new AttachmentBuilder(image, { name: 'leaderboard.png' })] });
    } catch {
      const lines = entries.map((entry, index) => `${index + 1}. **${entry.username}** — ${formatNumber(entry.balance)} ${config.emoji.coin}`);
      await message.reply({ embeds: [infoEmbed(`${config.emoji.coin} Leaderboard`, lines.join('\n'))] });
    }
  },
};
