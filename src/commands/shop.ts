import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder,
  type ButtonInteraction,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command } from '../types/command.js';
import { getShop } from '../services/economy.service.js';
import { formatNumber } from '../utils/format.js';
import { infoEmbed } from '../utils/embed.js';

const CATEGORIES = [
  { label: 'Seeds / Benih', value: 'SEEDS' },
  { label: 'Items / Boost', value: 'ITEMS' },
  { label: 'Equipment', value: 'EQUIPMENT' },
  { label: 'Special', value: 'SPECIAL' },
] as const;
const PAGE_SIZE = 5;

function renderShop(userId: string, category: string, page: number) {
  const items = getShop(category);
  const pages = Math.max(1, Math.ceil(items.length / PAGE_SIZE));
  const safePage = Math.min(Math.max(0, page), pages - 1);
  const visible = items.slice(safePage * PAGE_SIZE, (safePage + 1) * PAGE_SIZE);
  const categoryLabel = CATEGORIES.find((entry) => entry.value === category)?.label ?? category;
  const description = visible.length
    ? visible.map((item) => `**${item.name}** · \`${item.id}\`\n${formatNumber(item.buy_price)} SC — ${item.description}`).join('\n\n')
    : 'Belum ada barang yang tersedia di kategori ini.';
  const select = new StringSelectMenuBuilder()
    .setCustomId(`shop-category:${userId}`)
    .setPlaceholder('Pilih kategori toko')
    .addOptions(CATEGORIES.map((entry) => ({
      label: entry.label,
      value: entry.value,
      default: entry.value === category,
    })));
  const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`shop-page:${userId}:${category}:${safePage - 1}`).setLabel('Sebelumnya').setStyle(ButtonStyle.Secondary).setDisabled(safePage <= 0),
    new ButtonBuilder().setCustomId(`shop-page:${userId}:${category}:${safePage + 1}`).setLabel(`Halaman ${safePage + 1}/${pages}`).setStyle(ButtonStyle.Secondary).setDisabled(true),
    new ButtonBuilder().setCustomId(`shop-page:${userId}:${category}:${safePage + 1}`).setLabel('Berikutnya').setStyle(ButtonStyle.Secondary).setDisabled(safePage >= pages - 1),
  );
  return {
    embeds: [infoEmbed(`Shop · ${categoryLabel}`, `${description}\n\nGunakan `!buy <item> <jumlah>` untuk membeli.`)],
    components: [
      new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(select),
      buttons,
    ],
  };
}

export const shopCommand: Command = {
  name: 'shop',
  description: 'Lihat toko berdasarkan kategori.',
  usage: '!shop',
  async execute({ message, userId }) {
    await message.reply(renderShop(userId, 'SEEDS', 0));
  },
};

export async function handleShopInteraction(interaction: StringSelectMenuInteraction | ButtonInteraction): Promise<void> {
  const parts = interaction.customId.split(':');
  const ownerId = parts[1];
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: 'Menu toko ini bukan milik lo. Jalankan !shop sendiri.', ephemeral: true });
    return;
  }
  if (interaction.isStringSelectMenu() && parts[0] === 'shop-category') {
    const category = interaction.values[0];
    if (!category || !CATEGORIES.some((entry) => entry.value === category)) {
      await interaction.reply({ content: 'Kategori tidak valid.', ephemeral: true });
      return;
    }
    await interaction.update(renderShop(ownerId, category, 0));
    return;
  }
  if (interaction.isButton() && parts[0] === 'shop-page') {
    const category = parts[2];
    const page = Number(parts[3]);
    if (!CATEGORIES.some((entry) => entry.value === category) || !Number.isSafeInteger(page)) {
      await interaction.reply({ content: 'Halaman toko tidak valid.', ephemeral: true });
      return;
    }
    await interaction.update(renderShop(ownerId, category, page));
  }
}
