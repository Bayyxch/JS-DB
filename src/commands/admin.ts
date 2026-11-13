import type { Command } from '../types/command.js';
import { config } from '../config/env.js';
import { adjustAdminAsset, adjustAdminItem, banUser, unbanUser } from '../services/admin.service.js';
import { errorEmbed, infoEmbed, successEmbed } from '../utils/embed.js';
import { friendlyError } from '../utils/errors.js';
import { formatNumber } from '../utils/format.js';

function parseAmount(raw?: string): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error('INVALID_AMOUNT');
  return value;
}

export const adminCommand: Command = {
  name: 'admin',
  description: 'Perintah owner untuk moderasi dan mengelola aset pemain.',
  usage: '!admin <ban|unban|addmoney|removemoney|addgem|removegem|additem|removeitem> @pemain ...',
  async execute({ message, userId, args }) {
    if (!config.ownerId || userId !== config.ownerId) {
      await message.reply({ embeds: [errorEmbed('Akses ditolak', 'Command ini hanya tersedia untuk OWNER_ID.')] });
      return;
    }
    const action = args[0]?.toLowerCase();
    const target = message.mentions.users.first();
    if (!target || target.bot) {
      await message.reply({ embeds: [infoEmbed('Admin', 'Tandai pemain yang ingin dikelola.')] });
      return;
    }
    try {
      if (action === 'ban') {
        const reason = args.slice(2).join(' ') || 'Tidak ada alasan';
        banUser(userId, target.id, reason);
        await message.reply({ embeds: [successEmbed('Pemain diblokir', `<@${target.id}> tidak bisa menggunakan bot lagi.\nAlasan: ${reason}`)] });
        return;
      }
      if (action === 'unban') {
        unbanUser(userId, target.id);
        await message.reply({ embeds: [successEmbed('Pemain dibuka blokirnya', `<@${target.id}> bisa menggunakan bot lagi.`)] });
        return;
      }
      if (action === 'addmoney' || action === 'removemoney' || action === 'addgem' || action === 'removegem') {
        const amount = parseAmount(args[2]);
        const delta = action.startsWith('remove') ? -amount : amount;
        const asset = action.endsWith('gem') ? 'GEM' : 'SC';
        const balance = adjustAdminAsset(userId, target.id, asset, delta);
        await message.reply({ embeds: [successEmbed('Aset pemain diperbarui', `<@${target.id}>: ${delta > 0 ? '+' : ''}${formatNumber(delta)} ${asset}\nSaldo baru: ${formatNumber(balance)} ${asset}`)] });
        return;
      }
      if (action === 'additem' || action === 'removeitem') {
        const itemId = args[2]?.toLowerCase();
        const amount = parseAmount(args[3]);
        if (!itemId) throw new Error('ADMIN_ITEM_FORMAT');
        const delta = action === 'removeitem' ? -amount : amount;
        const quantity = adjustAdminItem(userId, target.id, itemId, delta);
        await message.reply({ embeds: [successEmbed('Inventory pemain diperbarui', `<@${target.id}>: ${delta > 0 ? '+' : ''}${formatNumber(delta)} ${itemId}\nJumlah baru: ${formatNumber(quantity)}`)] });
        return;
      }
      await message.reply({ embeds: [infoEmbed('Admin Commands', [
        '`!admin ban @user [alasan]`',
        '`!admin unban @user`',
        '`!admin addmoney @user <jumlah>` / `removemoney`',
        '`!admin addgem @user <jumlah>` / `removegem`',
        '`!admin additem @user <item_id> <jumlah>` / `removeitem`',
      ].join('\n'))] });
    } catch (error) {
      await message.reply({ embeds: [errorEmbed('Admin gagal', friendlyError(error))] });
    }
  },
};
