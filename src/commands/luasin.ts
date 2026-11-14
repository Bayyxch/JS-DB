import type { Command } from '../types/command.js';
import { expandLand, calculateLandExpansionCost } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { getFarmPlots } from '../services/economy.service.js';
import { formatNumber } from '../utils/format.js';
import { successEmbed, errorEmbed, infoEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';

export const luasCommand: Command = {
  name: 'expand',
  aliases: ['luasin', 'luas'],
  description: 'Buka satu plot lahan baru.',
  usage: '!expand',
  cooldownMs: 2000,
  async execute({ message, userId }) {
    const current = getFarmPlots(userId).length;
    if (current >= config.economy.maxPlots) {
      await message.reply({ embeds: [infoEmbed(`${config.emoji.land} Lahan`, 'Lahan sudah mencapai batas maksimum untuk MVP.')] });
      return;
    }
    const cost = calculateLandExpansionCost(current);
    try {
      const result = expandLand(userId);
      await message.reply({ embeds: [successEmbed(`${config.emoji.land} Lahan bertambah`, `Plot baru: #${result.plotIndex}\nTotal lahan: ${result.totalPlots}/${config.economy.maxPlots}\nBiaya: ${formatNumber(result.cost)} SawitCoin\nSaldo: ${formatNumber(result.balance)}`)] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Gagal memperluas lahan', `${friendlyError(error)}\n\nBiaya plot berikutnya: ${formatNumber(cost)} SawitCoin`)] });
    }
  },
};
