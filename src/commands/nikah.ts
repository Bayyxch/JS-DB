import type { Command } from '../types/command.js';
import {
  acceptMarriageProposal,
  claimBond,
  declineMarriageProposal,
  divorce,
  getMarriage,
  sendMarriageProposal,
} from '../services/social.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';

function requiredTarget(mentionedId?: string, args: string[] = []): string {
  const id = mentionedId ?? args.find((part) => /^\d{17,20}$/.test(part));
  if (!id) throw new Error('FRIEND_TARGET_REQUIRED');
  return id;
}

export const marriageCommand: Command = {
  name: 'nikah',
  aliases: ['marry', 'pasangan'],
  description: 'Ajukan pasangan game dan tingkatkan bond bersama.',
  usage: '!nikah propose/accept/decline @pemain | !nikah status/bond/divorce',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'status';
    const mentionId = message.mentions.users.first()?.id;

    if (action === 'propose') {
      const targetId = requiredTarget(mentionId, args.slice(1));
      sendMarriageProposal(userId, targetId);
      await message.reply({ embeds: [successEmbed('Proposal terkirim', `Permintaan menjadi pasangan game sudah dikirim ke <@${targetId}>. Mereka harus menerima dulu.`)] });
      return;
    }

    if (action === 'accept') {
      const targetId = requiredTarget(mentionId, args.slice(1));
      acceptMarriageProposal(userId, targetId);
      await message.reply({ embeds: [successEmbed('Pasangan terdaftar', `<@${targetId}> sekarang menjadi pasangan game lo. Gunakan ` + '`!nikah bond`' + ` untuk menaikkan level bond.`)] });
      return;
    }

    if (action === 'decline') {
      const targetId = requiredTarget(mentionId, args.slice(1));
      declineMarriageProposal(userId, targetId);
      await message.reply({ embeds: [infoEmbed('Proposal ditolak', 'Proposal pasangan game sudah ditolak.')] });
      return;
    }

    if (action === 'status') {
      const marriage = getMarriage(userId);
      if (!marriage) {
        await message.reply({ embeds: [infoEmbed('Belum punya pasangan game', 'Gunakan `!nikah propose @pemain` untuk mengirim proposal.')] });
        return;
      }
      const level = Math.floor(marriage.bond_points / 100) + 1;
      await message.reply({ embeds: [infoEmbed('Status pasangan', [
        `Pasangan: <@${marriage.partner_id}> (${marriage.partner_username})`,
        `Bond: **Lv. ${level}** — ${marriage.bond_points} poin`,
        `Terdaftar: <t:${Math.floor(marriage.married_at / 1000)}:D>`,
        'Klaim bond tersedia sekali setiap 24 jam untuk pasangan.',
      ].join('\n'))] });
      return;
    }

    if (action === 'bond') {
      const result = claimBond(userId);
      await message.reply({ embeds: [successEmbed('Bond bertambah', `Bond sekarang **${result.points} poin (Lv. ${result.level})**. Klaim berikutnya <t:${Math.floor(result.nextAt / 1000)}:R>.`)] });
      return;
    }

    if (action === 'divorce') {
      divorce(userId);
      await message.reply({ embeds: [infoEmbed('Status pasangan dihapus', 'Hubungan pasangan game sudah diakhiri. Progres bond tidak bisa dipulihkan.')] });
      return;
    }

    await message.reply({ embeds: [infoEmbed('Cara pakai', [
      '`!nikah propose @pemain`',
      '`!nikah accept @pemain`',
      '`!nikah decline @pemain`',
      '`!nikah status`',
      '`!nikah bond`',
      '`!nikah divorce`',
    ].join('\n'))] });
  },
};
