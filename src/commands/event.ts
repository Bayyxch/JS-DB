import type { Command } from '../types/command.js';
import { getCurrentEvent, getWorldEvents } from '../services/event.service.js';
import { infoEmbed } from '../utils/embed.js';

export const eventCommand: Command = {
  name: 'event',
  aliases: ['acara'],
  description: 'Lihat event global mingguan yang sedang aktif.',
  usage: '!event',
  async execute({ message }) {
    const current = getCurrentEvent();
    const schedule = getWorldEvents().map((event) =>
      (event.id === current.id ? '▶ ' : '• ') + '**' + event.name + '** — ' + event.description
    );
    await message.reply({ embeds: [infoEmbed('Event Global Mingguan', [
      '**Sedang berlangsung: ' + current.name + '**',
      current.description,
      '',
      '**Rotasi event**',
      ...schedule,
      '',
      'Event berganti otomatis setiap minggu dan berlaku sama di semua server.',
    ].join('\n'))] });
  },
};
