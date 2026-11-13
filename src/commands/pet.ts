import type { Command } from '../types/command.js';
import { adoptPet, feedPet, getPetShop, getPlayerPets, setActivePet } from '../services/housing-pet.service.js';
import { infoEmbed, successEmbed } from '../utils/embed.js';
import { formatNumber } from '../utils/format.js';

function petId(value?: string): number {
  const id = Number(value);
  if (!Number.isSafeInteger(id) || id <= 0) throw new Error('PET_ID_INVALID');
  return id;
}

export const petCommand: Command = {
  name: 'pet',
  aliases: ['hewan'],
  description: 'Adopsi, rawat, dan aktifkan hewan peliharaan.',
  usage: '!pet shop/list/adopt/equip/feed',
  async execute({ message, userId, args }) {
    const action = args[0]?.toLowerCase() ?? 'list';
    if (action === 'shop') {
      const species = getPetShop();
      const lines = species.map((pet) => `**${pet.name}** (${pet.id}) — ${pet.rarity}\nHarga: ${formatNumber(pet.adoption_cost)} SawitCoin • Bonus petualangan +${pet.power_percent}%`);
      await message.reply({ embeds: [infoEmbed('Tempat Adopsi Hewan', lines.join('\n\n'))] });
      return;
    }
    if (action === 'adopt') {
      const speciesId = args[1]?.toLowerCase();
      if (!speciesId) throw new Error('PET_SPECIES_REQUIRED');
      const pet = adoptPet(userId, speciesId);
      await message.reply({ embeds: [successEmbed('Hewan diadopsi', `**${pet.name}** berhasil diadopsi. ID hewan: **#${pet.id}**.${pet.is_active ? ' Otomatis menjadi hewan aktif.' : ''}`)] });
      return;
    }
    if (action === 'equip') {
      const pet = setActivePet(userId, petId(args[1]));
      await message.reply({ embeds: [successEmbed('Hewan aktif diganti', `**${pet.nickname ?? pet.name}** sekarang menemani petualangan lo.`)] });
      return;
    }
    if (action === 'feed') {
      const pet = feedPet(userId, petId(args[1]));
      await message.reply({ embeds: [successEmbed('Hewan diberi makan', `**${pet.nickname ?? pet.name}** sekarang Level ${pet.level} dengan ${formatNumber(pet.xp)} XP.`)] });
      return;
    }
    const pets = getPlayerPets(userId);
    const lines = pets.map((pet) =>
      `**#${pet.id} ${pet.nickname ?? pet.name}** — ${pet.rarity}\nLevel ${pet.level} • ${formatNumber(pet.xp)} XP • Bonus +${pet.power_percent}%${pet.is_active ? ' • AKTIF' : ''}`,
    );
    await message.reply({ embeds: [infoEmbed('Hewan Peliharaan', lines.join('\n\n') || 'Belum punya hewan. Gunakan `!pet shop` untuk melihat pilihan adopsi.')] });
  },
};
