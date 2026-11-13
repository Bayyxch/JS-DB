import type { Command } from '../types/command.js';
import { getCurrentWorldEvent, getWorldEventCycle } from '../services/world-event.service.js';
import { infoEmbed } from '../utils/embed.js';

export const eventCommand: Command = {
  name: 'event',
  aliases: ['acara'],
  description: 'Lihat event dunia global yang berlaku hari ini.',
  usage: '!event',
  async execute({ message }) {
    const current = getCurrentWorldEvent();
    const cycle = getWorldEventCycle();
    const lines = cycle.map((event) => `${event.id === current.id ? '▶' : '•'} **${event.name}**\n${event.description}`);
    await message.reply({ embeds: [infoEmbed(`Event Dunia: ${current.name}`, [
      current.description,
      '',
      'Event berlaku sama untuk semua pemain dan berganti setiap hari UTC.',
      '',
      ...lines,
    ].join('\n'))] });
  },
};
