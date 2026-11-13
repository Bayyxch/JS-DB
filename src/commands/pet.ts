import type { Command } from '../types/command.js';
import { adoptPet, feedPet, getPets, renamePet } from '../services/pet.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

function petId(raw: string | undefined): number {
  const id = Number(raw);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('PET_NOT_FOUND');
  return id;
}

export const petCommand: Command = {
  name: 'pet',
  aliases: ['hewan'],
  description: 'Adopsi, rawat, dan beri nama hewan peliharaan.',
  usage: '!pet | adopt <nama> | feed <id> | rename <id> <nama>',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'list';
    if (action === 'adopt') {
      const result = adoptPet(userId, args.slice(1).join(' '));
      await message.reply({ embeds: [successEmbed('Hewan berhasil diadopsi', [
        '**' + result.pet.name + '** — ' + result.pet.species_name,
        'Rarity: **' + result.pet.rarity + '**',
        'Biaya adopsi: **' + formatNumber(result.cost) + ' SawitCoin**',
        'Slot terpakai: **' + getPets(userId).length + '/' + result.slots + '**',
        'Rawat hewan dengan !pet feed ' + result.pet.id + '.',
      ].join('\n'))] });
      return;
    }
    if (action === 'feed') {
      const result = feedPet(userId, petId(args[1]));
      await message.reply({ embeds: [successEmbed('Hewan diberi makan', [
        '**' + result.pet.name + '** sekarang Lv. ' + result.pet.level,
        'XP: **' + result.pet.xp + '**',
        'Makanan digunakan: **5 TBS**',
        'Bisa diberi makan lagi <t:' + Math.floor(result.nextFeedAt / 1000) + ':R>.',
      ].join('\n'))] });
      return;
    }
    if (action === 'rename') {
      const name = renamePet(userId, petId(args[1]), args.slice(2).join(' '));
      await message.reply({ embeds: [successEmbed('Nama hewan diperbarui', 'Nama hewan sekarang **' + name + '**.')] });
      return;
    }
    if (action === 'list' || action === 'status') {
      const pets = getPets(userId);
      const lines = pets.length
        ? pets.map((pet) => '**#' + pet.id + ' ' + pet.name + '** — ' + pet.species_name + ' (' + pet.rarity + ') — Lv. ' + pet.level + ' — ' + pet.xp + ' XP')
        : ['Belum punya hewan. Adopsi dengan !pet adopt <nama>.'];
      await message.reply({ embeds: [infoEmbed('Hewan Peliharaan', lines.join('\n'))] });
      return;
    }
    await message.reply({ embeds: [infoEmbed('Cara pakai', [
      '!pet',
      '!pet adopt <nama>',
      '!pet feed <id>',
      '!pet rename <id> <nama_baru>',
    ].join('\n'))] });
  },
};
