import { AttachmentBuilder, EmbedBuilder } from 'discord.js';
import type { Command } from '../types/command.js';
import { getPlayerProfile, setPlayerBio } from '../services/social.service.js';
import { infoEmbed } from '../utils/embed.js';
import { renderProfileCard } from '../services/visual.service.js';

export const profileCommand: Command = {
  name: 'profile',
  aliases: ['me', 'profil'],
  description: 'Lihat profil pemain global atau atur bio.',
  usage: '!profile [bio <teks>] atau !profile @pemain',
  async execute({ message, userId, args }) {
    if (args[0]?.toLowerCase() === 'bio') {
      const bio = setPlayerBio(userId, args.slice(1).join(' '));
      await message.reply({ embeds: [infoEmbed('Bio diperbarui', bio || 'Bio dikosongkan.')] });
      return;
    }

    const target = message.mentions.users.first() ?? message.author;
    const profile = getPlayerProfile(target.id);
    if (!profilee) {
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
        .setColor(0x3f6f44)
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
