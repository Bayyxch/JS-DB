import type { Command } from '../types/command.js';
import {
  acceptFamilyInvite,
  createFamily,
  getFamily,
  getFamilyMembers,
  inviteFamilyMember,
  kickFamilyMember,
  leaveFamily,
  listFamilyInvites,
  transferFamilyOwnership,
} from '../services/family.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';

function mentionedTarget(mentionId?: string, args: string[] = []): string {
  const id = mentionId ?? args.find((part) => /^\d{17,20}$/.test(part));
  if (!id) throw new Error('FRIEND_TARGET_REQUIRED');
  return id;
}

export const familyCommand: Command = {
  name: 'keluarga',
  aliases: ['family', 'fam'],
  description: 'Buat dan kelola koperasi keluarga petani global.',
  usage: '!keluarga create <nama> | info | invite/accept/leave/kick/transfer',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'info';
    const mentionId = message.mentions.users.first()?.id;

    if (action === 'create') {
      const family = createFamily(userId, args.slice(1).join(' '));
      await message.reply({ embeds: [successEmbed('Keluarga dibuat', '**' + family.name + '** berhasil dibuat. ID keluarga: **' + family.id + '**. Undang anggota dengan !keluarga invite @pemain.')] });
      return;
    }

    if (action === 'invite') {
      const targetId = mentionedTarget(mentionId, args.slice(1));
      inviteFamilyMember(userId, targetId);
      await message.reply({ embeds: [successEmbed('Undangan terkirim', 'Undangan keluarga dikirim ke <@' + targetId + '>.')] });
      return;
    }

    if (action === 'accept') {
      const familyId = Number(args[1]);
      if (!Number.isSafeInteger(familyId) || familyId <= 0) throw new Error('FAMILY_ID_INVALID');
      acceptFamilyInvite(userId, familyId);
      await message.reply({ embeds: [successEmbed('Bergabung dengan keluarga', 'Undangan keluarga #' + familyId + ' diterima.')] });
      return;
    }

    if (action === 'invites') {
      const invites = listFamilyInvites(userId);
      const lines = invites.length
        ? invites.map((invite) => '• **' + invite.family_name + '** — ID ' + invite.family_id + ' — dari <@' + invite.inviter_id + '> — !keluarga accept ' + invite.family_id)
        : ['Belum ada undangan keluarga.'];
      await message.reply({ embeds: [infoEmbed('Undangan Keluarga', lines.join('\n'))] });
      return;
    }

    if (action === 'info' || action === 'members') {
      const family = getFamily(userId);
      if (!family) {
        await message.reply({ embeds: [infoEmbed('Belum punya keluarga', 'Gunakan !keluarga create <nama> atau !keluarga invites.')] });
        return;
      }
      const members = getFamilyMembers(userId);
      const level = Math.floor(family.points / 100) + 1;
      const lines = [
        'ID: **' + family.id + '**',
        'Pemimpin: <@' + family.owner_id + '>',
        'Anggota: **' + family.member_count + '/8**',
        'Kontribusi kebun: **Lv. ' + level + '** — ' + family.points + ' poin',
        '',
        ...members.map((member) => '• <@' + member.id + '> — ' + (member.role === 'owner' ? 'Pemimpin' : 'Anggota')),
        '',
        'Setiap plot yang berhasil dipanen anggota menambah 1 poin keluarga.',
      ];
      await message.reply({ embeds: [infoEmbed('Keluarga ' + family.name, lines.join('\n'))] });
      return;
    }

    if (action === 'kick') {
      const targetId = mentionedTarget(mentionId, args.slice(1));
      kickFamilyMember(userId, targetId);
      await message.reply({ embeds: [infoEmbed('Anggota dikeluarkan', '<@' + targetId + '> sudah dikeluarkan dari keluarga.')] });
      return;
    }

    if (action === 'transfer') {
      const targetId = mentionedTarget(mentionId, args.slice(1));
      transferFamilyOwnership(userId, targetId);
      await message.reply({ embeds: [successEmbed('Kepemimpinan dipindahkan', '<@' + targetId + '> sekarang menjadi pemimpin keluarga.')] });
      return;
    }

    if (action === 'leave') {
      leaveFamily(userId);
      await message.reply({ embeds: [infoEmbed('Keluar dari keluarga', 'Lo sudah keluar dari keluarga.')] });
      return;
    }

    await message.reply({ embeds: [infoEmbed('Cara pakai', [
      '!keluarga create <nama>',
      '!keluarga invite @pemain',
      '!keluarga invites',
      '!keluarga accept <id>',
      '!keluarga info',
      '!keluarga kick @pemain',
      '!keluarga transfer @pemain',
      '!keluarga leave',
    ].join('\n'))] });
  },
};
