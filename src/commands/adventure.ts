import { ActionRowBuilder, StringSelectMenuBuilder, type StringSelectMenuInteraction } from 'discord.js';
import type { Command } from '../types/command.js';
import { explore, getAdventureHistory, getAdventureZones } from '../services/adventure.service.js';
import { errorEmbed, infoEmbed, successEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';
import { formatNumber } from '../utils/format.js';

export const adventureCommand: Command = {
  name: 'adventure',
  aliases: ['jelajah', 'petualangan'],
  description: 'Jelajahi area dan dapatkan hadiah global.',
  usage: '!adventure [history]',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'zones';
    if (action === 'history') {
      const history = getAdventureHistory(userId);
      const lines = history.map((entry) => `• ${entry.zone_name} — ${formatNumber(entry.final_reward)} SawitCoin • <t:${Math.floor(entry.completed_at / 1000)}:R>`);
      await message.reply({ embeds: [infoEmbed('Riwayat Petualangan', lines.join('\n') || 'Belum ada petualangan.')] });
      return;
    }

    const zones = getAdventureZones(userId);
    const lines = zones.map((zone) =>
      `**${zone.name}** — ${zone.unlocked ? 'Terbuka' : `Butuh rumah Lv. ${zone.min_house_level}`}\nHadiah: ${formatNumber(zone.min_reward)}–${formatNumber(zone.max_reward)} SC • Cooldown ${zone.cooldown_minutes} menit`,
    );
    const menu = new StringSelectMenuBuilder()
      .setCustomId(`adventure-zone:${userId}`)
      .setPlaceholder('Pilih lokasi untuk dijelajahi')
      .addOptions(zones.slice(0, 25).map((zone) => ({
        label: zone.name.slice(0, 100),
        description: zone.unlocked
          ? `Hadiah ${zone.min_reward}–${zone.max_reward} SC`
          : `Terkunci • Butuh rumah level ${zone.min_house_level}`,
        value: zone.id,
        default: false,
      })))
      .setMinValues(1)
      .setMaxValues(1);
    await message.reply({
      embeds: [infoEmbed('Area Petualangan', [
        'Pilih lokasi yang ingin lo jelajahi dari menu di bawah.',
        'Rumah dan hewan aktif bisa memberi bonus hadiah.',
        '',
        ...lines,
      ].join('\n'))],
      components: [new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu)],
    });
  },
};

export async function handleAdventureSelectInteraction(interaction: StringSelectMenuInteraction): Promise<void> {
  const ownerId = interaction.customId.split(':')[1];
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: 'Menu ini bukan milik lo. Jalankan !adventure sendiri.', ephemeral: true });
    return;
  }
  const zoneId = interaction.values[0];
  if (!zoneId) {
    await interaction.reply({ content: 'Lokasi tidak valid.', ephemeral: true });
    return;
  }
  try {
    const result = explore(interaction.user.id, zoneId);
    await interaction.update({
      embeds: [successEmbed('Petualangan selesai', [
        `Zona: **${result.zone_name}**`,
        `Hadiah: **${formatNumber(result.final_reward)} SawitCoin**`,
        `EXP: +${formatNumber(result.xp_awarded)} • Level: ${result.level}${result.levels_gained ? ` (naik ${result.levels_gained} level!)` : ''}`,
        `Rumah: Level ${result.house_level}`,
        `Teman petualangan: ${result.pet_name ? `${result.pet_name} (Lv. ${result.pet_level})` : 'Tidak ada'}`,
        `Event: ${result.event_name}`,
        `Saldo: ${formatNumber(result.balance)} SC`,
        `Bisa jelajah lagi <t:${Math.floor(result.next_at / 1000)}:R>`,
      ].join('\n'))],
      components: [],
    });
  } catch (error) {
    await interaction.reply({ embeds: [errorEmbed('Petualangan gagal', friendlyError(error))], ephemeral: true });
  }
}
