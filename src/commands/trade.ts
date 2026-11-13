import type { Command } from '../types/command.js';
import { acceptTradeOffer, cancelTradeOffer, createTradeOffer, listTradeOffers } from '../services/trade.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

function parseId(value?: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('TRADE_ID_INVALID');
  return id;
}

export const tradeCommand: Command = {
  name: 'trade',
  aliases: ['tukar'],
  description: 'Tukar item secara langsung dengan pemain lain.',
  usage: '!trade offer @pemain <item> <jumlah> <item> <jumlah> | accept/cancel/list',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'list';

    if (action === 'offer') {
      const mentionedUser = message.mentions.users.first();
      if (mentionedUser?.bot) throw new Error('TRADE_TARGET_INVALID');
      const targetId = mentionedUser?.id ?? args[1];
      if (!targetId || !/^\d{17,20}$/.test(targetId)) throw new Error('TRADE_TARGET_REQUIRED');
      const [giveRawItem, giveRaw, wantRawItem, wantRaw] = args.slice(2);
      const normalizeAsset = (value: string | undefined) => value?.toLowerCase() === 'sc' ? 'currency_sc' : value?.toLowerCase() === 'gem' ? 'currency_gem' : value?.toLowerCase();
      const giveItem = normalizeAsset(giveRawItem);
      const wantItem = normalizeAsset(wantRawItem);
      const giveQuantity = Number(giveRaw);
      const wantQuantity = Number(wantRaw);
      if (!giveItem || !wantItem || !Number.isSafeInteger(giveQuantity) || !Number.isSafeInteger(wantQuantity)) {
        throw new Error('TRADE_FORMAT_INVALID');
      }
      const offerId = createTradeOffer(userId, targetId, giveItem, giveQuantity, wantItem, wantQuantity);
      await message.reply({ embeds: [successEmbed('Penawaran dibuat', `Penawaran **#${offerId}** dikirim ke <@${targetId}>. Item yang ditawarkan diamankan sementara. Berlaku 48 jam.`)] });
      return;
    }

    if (action === 'accept') {
      acceptTradeOffer(userId, parseId(args[1]));
      await message.reply({ embeds: [successEmbed('Trade berhasil', 'Kedua pemain sudah menerima item sesuai penawaran.')] });
      return;
    }

    if (action === 'cancel') {
      cancelTradeOffer(userId, parseId(args[1]));
      await message.reply({ embeds: [infoEmbed('Penawaran dibatalkan', 'Item yang ditawarkan sudah dikembalikan ke inventory lo.')] });
      return;
    }

    if (action === 'list') {
      const offers = listTradeOffers(userId);
      const lines = offers.map((offer) => {
        const outgoing = offer.proposer_id === userId;
        return `**#${offer.id}** — ${outgoing ? 'Dari lo' : 'Untuk lo'}\n${outgoing ? 'Lo' : offer.proposer_username} menawarkan ${formatNumber(offer.give_quantity)} ${offer.give_item_name} untuk ${formatNumber(offer.want_quantity)} ${offer.want_item_name}\n${outgoing ? 'Target' : 'Pengirim'}: <@${outgoing ? offer.target_id : offer.proposer_id}>${outgoing ? '' : `\nTerima: !trade accept ${offer.id}`}`;
      });
      await message.reply({ embeds: [infoEmbed('Penawaran Trade Aktif', lines.join('\n\n') || 'Tidak ada penawaran aktif.')] });
      return;
    }

    await message.reply({ embeds: [infoEmbed('Cara pakai Trade', [
      '`!trade offer @pemain tbs 20 sc 500`',
      '`!trade offer @pemain gem 2 gold_glove 1`',
      '`!trade list`',
      '`!trade accept <id>`',
      '`!trade cancel <id>`',
      'Penawaran berlaku 48 jam. Item penawaran diamankan sampai diterima, dibatalkan, atau kedaluwarsa.',
    ].join('\n'))] });
  },
};
