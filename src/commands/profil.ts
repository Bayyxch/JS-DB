import { EmbedBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { getPlayerProfile, setPlayerBio } from '../services/social.service.js';
import { infoEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

export const profileCommand: Command = {
  name: 'profil',
  aliases: ['profile', 'me'],
  description: 'Lihat profil pemain global atau atur bio.',
  usage: '!profil [bio <teks>] atau !profil @pemain',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'bio') {
      const bio = setPlayerBio(userId, args.slice(1).join(' '));
      await message.reply({ embeds: [infoEmbed('Bio diperbarui', bio || 'Bio dikosongkan.')] });
      return;
    }

    const target = message.mentions.users.first() ?? message.author;
    const profile = getPlayerProfile(target.id);
    if (!profile) {
      await message.reply({ embeds: [infoEmbed('Pemain belum terdaftar', 'Pemain ini perlu menggunakan command bot terlebih dahulu.')] });
      return;
    }

    const description = [
      profile.bio || 'Belum ada bio.',
      '',
      `SawitCoin: **${formatNumber(profile.balance)}**`,
      `Teman: **${profile.friend_count}**`,
      `Lahan: **${profile.planted_plots}/${profile.farm_plots}** plot terisi`,
      `Bergabung: <t:${Math.floor(profile.created_at / 1000)}:D>`,
    ].join('\n');
    const embed = new EmbedBuilder()
      .setColor(0x3f6f44)
      .setTitle(`Profil ${profile.username}`)
      .setThumbnail(target.displayAvatarURL())
      .setDescription(description)
      .setFooter({ text: `Global Player ID: ${profile.id}` });
    await message.reply({ embeds: [embed] });
  },
};
