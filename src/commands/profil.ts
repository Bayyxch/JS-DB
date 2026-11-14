import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { getPlayerProfile, setPlayerBio, setPlayerTheme } from '../services/social.service.js';
import { infoEmbed } from '../utils/embed.js';
import { renderProfileCard } from '../services/visual.service.js';

export const profileCommand: Command = {
  name: 'profile',
  aliases: ['me', 'profil'],
  description: 'Lihat profil pemain global, atur bio, dan ubah warna tema.',
  usage: '!profile [bio <teks>] | !profile theme <color/hexcode> | !profile @pemain',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'theme') {
      if (!args[1]) {
        await message.reply({ embeds: [infoEmbed('Profile theme', 'Pilih warna dengan `!profile theme green` atau hex seperti `!profile theme #2E8B57`. Gunakan `default` untuk reset.\nWarna: green, forest, blue, sky, purple, pink, red, orange, gold, teal, white, black.')] });
        return;
      }
      const color = setPlayerTheme(userId, args[1]);
      await message.reply({ embeds: [infoEmbed('Theme diperbarui', `Warna profile lo sekarang ${color}. Jalankan !profile untuk melihat hasilnya.`)] });
      return;
    }

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

    try {
      const image = await renderProfileCard(
        profile,
        target.displayAvatarURL({ extension: 'png', size: 256 }),
      );
      const attachment = new AttachmentBuilder(image, { name: 'profile.png' });
      await message.reply({ files: [attachment] });
    } catch {
      const fallback = new EmbedBuilder()
        .setColor(Number.parseInt((profile.theme_color ?? '#3f6f44').replace('#', ''), 16))
        .setTitle(`Profil ${profile.username}`)
        .setDescription(profile.bio || 'Belum ada bio.')
        .addFields(
          { name: 'SawitCoin', value: String(profile.balance), inline: true },
          { name: 'Teman', value: String(profile.friend_count), inline: true },
          { name: 'Lahan', value: `${profile.planted_plots}/${profile.farm_plots}`, inline: true },
        );
      await message.reply({ embeds: [fallback] });
    }
  },
};
