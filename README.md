# JS-DB — Juragan Sawit Discord Bot

Discord bot simulasi pertanian sawit dengan **global economy**, sistem sosial, progres kebun, dan aktivitas PvE. Pemain mengelola kebun, menanam berbagai komoditas, memanen hasil, berdagang, membangun relasi, serta mengembangkan perusahaan bersama pemain lain.

Alur dasar permainan:

`!tanam` → `!panen` → `!jual` → `!luasin`

## Fitur

### Farming & economy
- Akun pemain dibuat otomatis saat pertama kali bermain.
- Kebun dengan plot yang bisa ditanami dan diperluas.
- Multi-crop: sawit, jagung, padi, dan kakao.
- Timer pertumbuhan tanaman.
- Panen dengan event acak, seperti hujan berkah, panen melimpah, serangan hama, musim kering, dan gagal panen sebagian.
- Event dunia yang berotasi dan dapat memengaruhi hasil panen, petualangan, atau perkembangan pet.
- Inventory, toko benih, penjualan hasil panen, daily reward, dan work.
- Market komoditas dengan harga yang dipengaruhi aktivitas jual pemain.
- Trade antarpemain dengan sistem escrow dan masa kedaluwarsa.
- Ledger untuk mencatat perubahan saldo.

### Profile & social
- Profil pemain berbentuk kartu gambar dengan avatar, bio, saldo, data kebun, dan statistik sosial.
- Bio profil yang dapat diubah.
- Pertemanan global dengan request dan persetujuan.
- Sistem pasangan game dengan proposal, status hubungan, dan perkembangan bond.
- Perusahaan/koperasi global dengan undangan, role anggota, progres bersama, dan leaderboard.

### Progression & adventure
- Upgrade rumah untuk membuka zona petualangan dan bonus.
- Pet yang bisa diadopsi, diberi makan, dan dikembangkan.
- Adventure dengan zona, reward, dan riwayat aktivitas.
- Koleksi penemuan tanaman dan catatan total panen.
- Leaderboard pemain dan koperasi.

### Technical
- TypeScript dan discord.js.
- SQLite melalui better-sqlite3.
- Database migrations dan transaksi ekonomi atomik.
- SQLite WAL mode dan foreign keys.
- Canvas rendering menggunakan `@napi-rs/canvas`.
- Configurable custom Discord emoji.
- Unit tests dengan Vitest.
- GitHub Actions untuk type-check, test, dan build.

## Tech stack

| Komponen | Teknologi |
|---|---|
| Runtime | Node.js 24 |
| Language | TypeScript |
| Discord API | discord.js 14 |
| Database | SQLite + better-sqlite3 |
| Image rendering | @napi-rs/canvas |
| Testing | Vitest |
| Development runner | tsx |

## Persyaratan

- Node.js 24.x
- npm
- Discord bot application dan token dari Discord Developer Portal

## Instalasi

1. Clone repository:

   ```bash
   git clone https://github.com/Bayyxch/JS-DB.git
   cd JS-DB
   ```

2. Install dependency:

   ```bash
   npm install
   ```

3. Salin `.env.example` menjadi `.env`, lalu isi `DISCORD_TOKEN`.

   Windows CMD:

   ```cmd
   copy .env.example .env
   ```

   PowerShell:

   ```powershell
   Copy-Item .env.example .env
   ```

4. Di Discord Developer Portal, aktifkan **Message Content Intent** pada halaman Bot. Berikan bot permission yang diperlukan untuk membaca dan mengirim pesan serta embed/attachment.

5. Jalankan pemeriksaan, test, dan build:

   ```bash
   npm run check
   npm test
   npm run build
   ```

6. Jalankan bot:

   ```bash
   npm start
   ```

Untuk development dengan auto-reload:

```bash
npm run dev
```

## Konfigurasi

Konfigurasi utama tersedia di `.env.example`.

| Variable | Fungsi |
|---|---|
| `DISCORD_TOKEN` | Token bot (wajib) |
| `DISCORD_GUILD_ID` | Guild untuk kebutuhan development tertentu |
| `DATABASE_PATH` | Lokasi file database SQLite |
| `PREFIX` | Prefix command, default `!` |
| `EMOJI_*` | Custom emoji Discord |
| `STARTING_*` | Saldo, benih, dan plot awal |
| `BASIC_*` | Pengaturan benih dan hasil panen dasar |
| `TBS_SELL_PRICE` | Harga jual TBS |
| `FIRST_LAND_COST`, `LAND_COST_MULTIPLIER`, `MAX_PLOTS` | Pengaturan ekspansi lahan |
| `WORK_*`, `DAILY_*` | Reward dan cooldown |

Contoh custom emoji:

```env
EMOJI_PALM=<:sawit:123456789012345678>
EMOJI_COIN=<:coin:123456789012345678>
```

Jika custom emoji tidak diatur, bot menggunakan fallback teks.

## Daftar command

```text
!help
!ping

!balance
!daily
!work
!leaderboard

!kebun
!tanam
!panen
!jual
!luasin
!inventory
!shop
!buy

!profil
!profil bio <teks>

!teman add @pemain
!nikah propose @pemain

!koleksi
!koperasi create <nama>
!market
!market history <komoditas>
!trade offer @pemain <item> <jumlah>
!trade list

!rumah
!rumah upgrade
!pet shop
!pet adopt <jenis>
!pet feed <id>

!adventure
!adventure explore <zona>
!adventure history
!event
```

Alias tersedia untuk beberapa command, misalnya `!saldo`, `!farm`, `!inv`, `!beli`, `!jual`, `!luas`, `!lb`, dan `!harvest`.

Gunakan `!help` di Discord untuk melihat bantuan command yang tersedia pada versi bot yang sedang berjalan.

## Global economy & social

Progres pemain bersifat **global berdasarkan Discord user ID**, bukan terpisah per server. Saldo, kebun, inventory, profil, pertemanan, pasangan, koleksi, pet, rumah, dan progres sosial pemain tetap sama di semua server tempat bot digunakan.

Perusahaan/koperasi dan market juga menggunakan sistem global. `guild_id` digunakan untuk konteks atau konfigurasi server, bukan untuk membuat ekonomi pemain yang terpisah.

## Prinsip ekonomi

Ekonomi dirancang dengan sumber uang (*faucet*) dan pengeluaran uang (*sink*) agar saldo tidak terus meningkat tanpa kontrol.

- Penjualan hasil panen menjadi sumber pemasukan utama.
- Pembelian benih dan ekspansi lahan menjadi pengeluaran utama.
- Reward `!work` dan `!daily` dijaga agar tidak mengalahkan progres farming.
- Perubahan saldo dicatat dalam ledger dan diproses melalui transaksi SQLite.

## Struktur project

```text
JS-DB/
├─ .github/
│  └─ workflows/
├─ src/
│  ├─ commands/
│  ├─ config/
│  ├─ db/
│  ├─ events/
│  ├─ migrations/
│  ├─ services/
│  ├─ types/
│  ├─ utils/
│  └─ index.ts
├─ tests/
├─ data/
├─ .env.example
├─ .gitignore
├─ package.json
├─ tsconfig.json
└─ README.md
```

## Development scripts

| Script | Kegunaan |
|---|---|
| `npm run dev` | Menjalankan bot dengan auto-reload |
| `npm run check` | Type-check tanpa menghasilkan file build |
| `npm test` | Menjalankan seluruh test |
| `npm run test:watch` | Menjalankan test dalam watch mode |
| `npm run build` | Compile TypeScript ke `dist/` |
| `npm start` | Menjalankan hasil build |
| `npm run ci` | Check, test, dan build berurutan |

---

Dibuat untuk mengembangkan pengalaman farming, economy, dan social yang bisa dimainkan bersama lintas server Discord.
