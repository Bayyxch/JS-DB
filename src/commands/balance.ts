import type { Command } from '../types/command.js';
import { getBalance, getGemBalance } from '../services/economy.service.js';
import { config } from '../config/env.js';
import { formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';

export const balanceCommand: Command = {
  name: 'balance',
  aliases: ['saldo', 'bal'],
  description: 'Lihat saldo SawitCoin.',
  usage: '!balance',
  async execute({ message, userId }) {
    const balance = getBalance(userId);
    const gems = getGemBalance(userId);
    await message.reply({ embeds: [infoEmbed(`${config.emoji.coin} Saldo`, `${formatNumber(balance)} SawitCoin\n${formatNumber(gems)} Gem`)] });
  },
};
