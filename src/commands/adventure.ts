import type { Command } from '../types/command.js';
import { explore, getAdventureHistory, getAdventureZones } from '../services/adventure.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const adventureCommand: Command = {
  name: 'adventure',
  aliases: ['jelajah', 'petualangan'],
  description: 'Jelajahi area dan dapatkan hadiah global.',
  usage: '!adventure [explore <zona>|history]',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'zones';
    if (action === 'explore') {
      const zoneId = args[1]?.toLowerCase();
      if (!zoneId) throw new Error('ADVENTURE_ZONE_REQUIRED');
      const result = explore(userId, zoneId);
      await message.reply({ embeds: [successEmbed('Petualangan selesai', [
        `Zona: **${result.zone_name}**`,
        `Hadiah dasar: ${formatNumber(result.base_reward)} SawitCoin`,
        `Hadiah akhir: **${formatNumber(result.final_reward)} SawitCoin**`,
        `Rumah: Level ${result.house_level}`,
        `Teman petualangan: ${result.pet_name ? `${result.pet_name} (Lv. ${result.pet_level})` : 'Tidak ada'}`,
        `Event: ${result.event_name}`,
        `Saldo: ${formatNumber(result.balance)} SawitCoin`,
        `Bisa jelajah lagi <t:${Math.floor(result.next_at / 1000)}:R>`,
      ].join('\n'))] });
      return;
    }
    if (action === 'history') {
      const history = getAdventureHistory(userId);
      const lines = history.map((entry) => `• ${entry.zone_name} — ${formatNumber(entry.final_reward)} SawitCoin • <t:${Math.floor(entry.completed_at / 1000)}:R>`);
      await message.reply({ embeds: [infoEmbed('Riwayat Petualangan', lines.join('\n') || 'Belum ada petualangan.')] });
      return;
    }
    const zones = getAdventureZones(userId);
    const lines = zones.map((zone) =>
      `**${zone.name}** (${zone.id}) — ${zone.unlocked ? 'Terbuka' : `Butuh rumah Lv. ${zone.min_house_level}`}\nHadiah: ${formatNumber(zone.min_reward)}–${formatNumber(zone.max_reward)} SawitCoin • Cooldown ${zone.cooldown_minutes} menit`,
    );
    await message.reply({ embeds: [infoEmbed('Area Petualangan', [
      'Pilih zona yang sudah terbuka. Rumah dan hewan aktif memberi bonus hadiah.',
      '',
      ...lines,
      '',
      'Contoh: `!adventure explore river`',
    ].join('\n'))] });
  },
};
