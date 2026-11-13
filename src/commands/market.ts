import type { Command } from '../types/command.js';
import {
  buyMarketListing,
  cancelMarketListing,
  createMarketListing,
  getMarketListings,
  getMyMarketListings,
} from '../services/market.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

function positiveInteger(raw: string | undefined, error = 'INVALID_QUANTITY'): number {
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value <= 0) throw new Error(error);
  return value;
}

function listingLines(listings: ReturnType<typeof getMarketListings>): string {
  if (listings.length === 0) return 'Belum ada listing aktif.';
  return listings.map((listing) =>
    '**#' + listing.id + '** ' + listing.item_name + ' x' + formatNumber(listing.quantity) +
    ' — ' + formatNumber(listing.unit_price) + ' SawitCoin/unit — oleh <@' + listing.seller_id + '>'
  ).join('\n');
}

export const marketCommand: Command = {
  name: 'market',
  aliases: ['pasar', 'trade'],
  description: 'Jual beli item antar pemain di pasar global.',
  usage: '!market list | sell <item> <jumlah> <harga> | buy <id> [jumlah] | mine | cancel <id>',
  cooldownMs: 1200,
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'list';

    if (action === 'sell') {
      const itemId = args[1]?.toLowerCase();
      if (!itemId) throw new Error('ITEM_NOT_FOUND');
      const quantity = positiveInteger(args[2]);
      const price = positiveInteger(args[3], 'MARKET_INVALID_PRICE');
      const result = createMarketListing(userId, itemId, quantity, price);
      await message.reply({ embeds: [successEmbed('Listing dibuat', [
        'ID listing: **#' + result.listingId + '**',
        'Nilai total: **' + formatNumber(result.totalValue) + ' SawitCoin**',
        'Listing kedaluwarsa <t:' + Math.floor(result.expiresAt / 1000) + ':R>.',
        'Item ditahan sementara di escrow sampai terjual atau listing dibatalkan.',
      ].join('\n'))] });
      return;
    }

    if (action === 'buy') {
      const listingId = positiveInteger(args[1], 'MARKET_LISTING_NOT_FOUND');
      const quantity = args[2] ? positiveInteger(args[2]) : 1;
      const result = buyMarketListing(userId, listingId, quantity);
      await message.reply({ embeds: [successEmbed('Pembelian pasar berhasil', [
        result.itemName + ' x' + formatNumber(result.quantity),
        'Total: **' + formatNumber(result.total) + ' SawitCoin**',
        'Saldo lo: **' + formatNumber(result.buyerBalance) + '**',
        'Sisa listing: **' + formatNumber(result.remaining) + '**',
      ].join('\n'))] });
      return;
    }

    if (action === 'cancel') {
      const listingId = positiveInteger(args[1], 'MARKET_LISTING_NOT_FOUND');
      const result = cancelMarketListing(userId, listingId);
      await message.reply({ embeds: [infoEmbed('Listing dibatalkan', result.itemName + ' x' + formatNumber(result.quantity) + ' dikembalikan ke inventory.')] });
      return;
    }

    if (action === 'mine') {
      await message.reply({ embeds: [infoEmbed('Listing Milik Lo', listingLines(getMyMarketListings(userId)))] });
      return;
    }

    if (action === 'list') {
      const itemId = args[1]?.toLowerCase();
      await message.reply({ embeds: [infoEmbed('Pasar Global', listingLines(getMarketListings(itemId)))] });
      return;
    }

    await message.reply({ embeds: [infoEmbed('Cara pakai', [
      '!market list [item_id]',
      '!market sell <item_id> <jumlah> <harga_per_item>',
      '!market buy <listing_id> [jumlah]',
      '!market mine',
      '!market cancel <listing_id>',
    ].join('\n'))] });
  },
};
