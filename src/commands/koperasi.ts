import type { Command } from '../types/command.js';
import {
  acceptCompanyInvite,
  createCompany,
  declineCompanyInvite,
  disbandCompany,
  getCompanyLeaderboard,
  getUserCompany,
  inviteToCompany,
  kickCompanyMember,
  leaveCompany,
  listCompanyInvites,
  listCompanyMembers,
  transferCompanyOwnership,
} from '../services/company.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

function mentionedTarget(mentionedId?: string, args: string[] = []): string {
  const id = mentionedId ?? args.find((part) => /^\d{17,20}$/.test(part));
  if (!id) throw new Error('FRIEND_TARGET_REQUIRED');
  return id;
}

function numericCompanyId(value?: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('COMPANY_ID_INVALID');
  return id;
}

export const companyCommand: Command = {
  name: 'company',
  aliases: ['koperasi', 'perusahaan'],
  description: 'Bangun koperasi global bersama pemain lain.',
  usage: '!company create/nama | invite/accept/decline | info/members/leave/kick/transfer/disband/top',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'info';
    const mentionId = message.mentions.users.first()?.id;

    if (action === 'create') {
      const company = createCompany(userId, args.slice(1).join(' '));
      await message.reply({ embeds: [successEmbed('Koperasi dibuat', `**${company.name}** berhasil dibuat. ID: **#${company.id}**. Undang anggota dengan ` + '`!company invite @pemain`' + `.`)] });
      return;
    }

    if (action === 'invite') {
      inviteToCompany(userId, mentionedTarget(mentionId, args.slice(1)));
      await message.reply({ embeds: [successEmbed('Undangan terkirim', 'Undangan koperasi dikirim. Pemain harus menerima undangan untuk bergabung.')] });
      return;
    }

    if (action === 'invites') {
      const invites = listCompanyInvites(userId);
      const lines = invites.map((invite) => `**#${invite.company_id} — ${invite.company_name}** dari <@${invite.inviter_id}>\nTerakhir berlaku <t:${Math.floor(invite.expires_at / 1000)}:R>\nTerima: ` + '`!company accept ' + '${invite.company_id}' + '`');
      await message.reply({ embeds: [infoEmbed('Undangan Koperasi', lines.join('\n\n') || 'Tidak ada undangan aktif.')] });
      return;
    }

    if (action === 'accept' || action === 'decline') {
      const id = numericCompanyId(args[1]);
      if (action === 'accept') {
        const company = acceptCompanyInvite(userId, id);
        await message.reply({ embeds: [successEmbed('Berhasil bergabung', `Lo sekarang anggota **${company.name}**.`)] });
      } else {
        declineCompanyInvite(userId, id);
        await message.reply({ embeds: [infoEmbed('Undangan ditolak', 'Undangan koperasi sudah ditolak.')] });
      }
      return;
    }

    if (action === 'info' || action === 'members') {
      const company = getUserCompany(userId);
      if (!company) {
        await message.reply({ embeds: [infoEmbed('Belum bergabung', 'Buat koperasi dengan `!company create Nama` atau cek undangan dengan `!company invites`.')] });
        return;
      }
      const members = listCompanyMembers(company.id);
      const memberLines = members.map((member) => `• <@${member.id}> — ${member.role === 'OWNER' ? 'Pemilik' : 'Anggota'}`);
      const description = [
        `ID: **#${company.id}**`,
        `Pemilik: <@${company.owner_id}>`,
        `Anggota: **${company.member_count}/20**`,
        `Level: **${company.level}**`,
        `Total hasil panen anggota: **${formatNumber(company.total_harvested)}**`,
        '',
        '**Daftar anggota**',
        ...memberLines,
      ].join('\n');
      await message.reply({ embeds: [infoEmbed(`Koperasi ${company.name}`, description)] });
      return;
    }

    if (action === 'leave') {
      leaveCompany(userId);
      await message.reply({ embeds: [infoEmbed('Keluar koperasi', 'Lo sudah keluar dari koperasi.')] });
      return;
    }

    if (action === 'kick') {
      kickCompanyMember(userId, mentionedTarget(mentionId, args.slice(1)));
      await message.reply({ embeds: [infoEmbed('Anggota dikeluarkan', 'Anggota tersebut sudah dikeluarkan dari koperasi.')] });
      return;
    }

    if (action === 'transfer') {
      transferCompanyOwnership(userId, mentionedTarget(mentionId, args.slice(1)));
      await message.reply({ embeds: [successEmbed('Kepemilikan dipindahkan', 'Kepemilikan koperasi berhasil dipindahkan.')] });
      return;
    }

    if (action === 'disband') {
      disbandCompany(userId);
      await message.reply({ embeds: [infoEmbed('Koperasi dibubarkan', 'Koperasi dan seluruh undangannya sudah dihapus.')] });
      return;
    }

    if (action === 'top') {
      const companies = getCompanyLeaderboard(10);
      const lines = companies.map((company, index) =>
        `**${index + 1}. ${company.name}** — Lv. ${company.level}\n${formatNumber(company.total_harvested)} hasil panen • ${company.member_count} anggota`,
      );
      await message.reply({ embeds: [infoEmbed('Peringkat Koperasi', lines.join('\n\n') || 'Belum ada koperasi.')] });
      return;
    }

    await message.reply({ embeds: [infoEmbed('Cara pakai Koperasi', [
      '`!company create Nama Koperasi`',
      '`!company invite @pemain`',
      '`!company invites`',
      '`!company accept <id>` / `!company decline <id>`',
      '`!company info` / `!company members`',
      '`!company leave`',
      '`!company kick @pemain`',
      '`!company transfer @anggota`',
      '`!company disband`',
      '`!company top`',
    ].join('\n'))] });
  },
};
