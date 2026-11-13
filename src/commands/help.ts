import {
  ActionRowBuilder,
  StringSelectMenuBuilder,
  type StringSelectMenuInteraction,
} from 'discord.js';
import type { Command } from '../types/command.js';
import { config } from '../config/env.js';
import { infoEmbed } from '../utils/embed.js';

const HELP_CATEGORIES = [
  { id: 'CATEGORY_CMD', label: 'Umum', description: 'Profil, saldo, status, dan bantuan.' },
  { id: 'FARM_CMD', label: 'Perkebunan Sawit', description: 'Kebun, tanam, panen, lahan, dan koleksi.' },
  { id: 'ECONOMY_CMD', label: 'Ekonomi', description: 'Shop, jual-beli, saldo, pasar, dan leaderboard.' },
  { id: 'SOCIAL_CMD', label: 'Sosial', description: 'Teman, pasangan, dan pertukaran item.' },
  { id: 'COMPANY_CMD', label: 'Koperasi', description: 'Kelola koperasi dan anggota.' },
  { id: 'ADVENTURE_CMD', label: 'Aktivitas', description: 'Rumah, hewan peliharaan, dan petualangan.' },
] as const;

const CATEGORY_COMMANDS: Record<string, string[]> = {
  CATEGORY_CMD: ['help', 'ping', 'profil', 'balance', 'status'],
  FARM_CMD: ['kebun', 'tanam', 'panen', 'luasin', 'koleksi', 'event'],
  ECONOMY_CMD: ['shop', 'buy', 'sell', 'inventory', 'market', 'daily', 'work', 'leaderboard', 'economy'],
  SOCIAL_CMD: ['teman', 'nikah', 'trade'],
  COMPANY_CMD: ['koperasi'],
  ADVENTURE_CMD: ['rumah', 'pet', 'adventure'],
};

function categoryMenu(ownerId: string): ActionRowBuilder<StringSelectMenuBuilder> {
  const menu = new StringSelectMenuBuilder()
    .setCustomId(`help-category:${ownerId}`)
    .setPlaceholder('Pilih kategori command')
    .addOptions(HELP_CATEGORIES.map((category) => ({
      label: category.label,
      value: category.id,
      description: category.description,
    })));
  return new ActionRowBuilder<StringSelectMenuBuilder>().addComponents(menu);
}

function commandDetails(command: Command): string {
  const aliases = command.aliases?.length ? command.aliases.join(', ') : 'Tidak ada';
  return [
    `**Deskripsi:** ${command.description}`,
    `**Cara pakai:** \`${command.usage.replace(/^!/, config.prefix)}\``,
    `**Alias:** ${aliases}`,
  ].join('\n');
}

function categoryEmbed(commands: Command[], categoryId: string) {
  const category = HELP_CATEGORIES.find((item) => item.id === categoryId);
  const names = CATEGORY_COMMANDS[categoryId] ?? [];
  const selected = names
    .map((name) => commands.find((command) => command.name === name))
    .filter((command): command is Command => Boolean(command));
  const lines = selected.map((command) =>
    `**${config.prefix}${command.name}** — ${command.description}\nCara pakai: \`${command.usage.replace(/^!/, config.prefix)}\``,
  );
  return infoEmbed(
    `Bantuan: ${category?.label ?? 'Command'}`,
    lines.join('\n\n') || 'Belum ada command di kategori ini.',
  );
}

export async function handleHelpSelectInteraction(
  interaction: StringSelectMenuInteraction,
  commands: Command[],
): Promise<void> {
  if (!interaction.customId.startsWith('help-category:')) return;
  const ownerId = interaction.customId.slice('help-category:'.length);
  if (interaction.user.id !== ownerId) {
    await interaction.reply({ content: 'Menu bantuan ini dibuat oleh pemain lain. Jalankan !help untuk membuka menu milik lo sendiri.', ephemeral: true });
    return;
  }
  await interaction.update({
    embeds: [categoryEmbed(commands, interaction.values[0] ?? 'CATEGORY_CMD')],
    components: [categoryMenu(ownerId)],
  });
}

export function createHelpCommand(commands: Command[]): Command {
  return {
    name: 'help',
    aliases: ['h'],
    description: 'Lihat panduan command dan kategori bot.',
    usage: '!help [command]',
    async execute({ message, args }) {
      const requested = args[0]?.toLowerCase();
      if (requested) {
        const command = commands.find((entry) =>
          entry.name === requested || entry.aliases?.some((alias) => alias.toLowerCase() === requested),
        );
        if (!command) {
          await message.reply({ embeds: [infoEmbed('Command tidak ditemukan', `Command **${requested}** tidak tersedia. Gunakan \`${config.prefix}help\` untuk melihat kategori command.`)] });
          return;
        }
        await message.reply({ embeds: [infoEmbed(`Bantuan: ${config.prefix}${command.name}`, commandDetails(command))] });
        return;
      }

      const embed = infoEmbed(
        `${config.emoji.palm} Juragan Sawit`,
        [
          'Kelola perkebunan sawit, kumpulkan TBS, bangun ekonomi, dan main bareng pemain lain.',
          '',
          '**Pilih kategori** dari menu di bawah untuk melihat command.',
          `Butuh panduan spesifik? Gunakan \`${config.prefix}help <command>\`.`,
          `Contoh: \`${config.prefix}help tanam\`, \`${config.prefix}help profil\`.`,
        ].join('\n'),
      );
      await message.reply({
        embeds: [embed],
        components: [categoryMenu(message.author.id)],
      });
    },
  };
}
