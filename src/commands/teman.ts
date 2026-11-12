import type { Command } from '../types/command.js';
import {
  acceptFriendRequest,
  declineFriendRequest,
  listFriends,
  listIncomingFriendRequests,
  removeFriend,
  sendFriendRequest,
} from '../services/social.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';

function targetId(args: string[], mentionedId?: string): string {
  const id = mentionedId ?? args.find((part) => /^\d{17,20}$/.test(part));
  if (!id) throw new Error('FRIEND_TARGET_REQUIRED');
  return id;
}

export const friendCommand: Command = {
  name: 'teman',
  aliases: ['friend', 'friends'],
  description: 'Kelola pertemanan global pemain.',
  usage: '!teman add/accept/decline/remove @pemain | !teman list',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase();
    const mentionId = message.mentions.users.first()?.id;
    if (action === 'list' || !action) {
      const friends = listFriends(userId);
      const incoming = listIncomingFriendRequests(userId);
      const lines = [
        `**Teman (${friends.length})**`,
        friends.length ? friends.map((friend) => `• <@${friend.id}>`).join('\n') : 'Belum punya teman.',
        '',
        '**Permintaan masuk**',
        incoming.length ? incoming.map((request) => `• <@${request.id}> — ` + '`!teman accept @pemain`').join('\n') : 'Tidak ada permintaan masuk.',
      ];
      await message.reply({ embeds: [infoEmbed('Daftar Teman', lines.join('\n'))] });
      return;
    }

    const otherId = targetId(args.slice(1), mentionId);
    if (action === 'add') {
      sendFriendRequest(userId, otherId);
      await message.reply({ embeds: [successEmbed('Permintaan terkirim', `Permintaan pertemanan dikirim ke <@${otherId}>.`)] });
      return;
    }
    if (action === 'accept') {
      acceptFriendRequest(userId, otherId);
      await message.reply({ embeds: [successEmbed('Sekarang berteman', `<@${otherId}> sekarang menjadi teman global lo.`)] });
      return;
    }
    if (action === 'decline') {
      declineFriendRequest(userId, otherId);
      await message.reply({ embeds: [infoEmbed('Permintaan ditolak', 'Permintaan pertemanan sudah ditolak.')] });
      return;
    }
    if (action === 'remove') {
      removeFriend(userId, otherId);
      await message.reply({ embeds: [infoEmbed('Teman dihapus', 'Pemain tersebut sudah dihapus dari daftar teman.')] });
      return;
    }
    await message.reply({ embeds: [infoEmbed('Cara pakai', '`!teman add @pemain`\n`!teman accept @pemain`\n`!teman decline @pemain`\n`!teman remove @pemain`\n`!teman list`')] });
  },
};
