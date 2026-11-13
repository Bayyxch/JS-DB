import { formatDuration } from './format.js';

export function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Terjadi error yang tidak diketahui.';

  const availableAt = (error as Error & { availableAt?: number }).availableAt;
  switch (error.message) {
    case 'ADVENTURE_PROGRESS_LIMIT': return 'Progres ekspedisi sudah mencapai batas aman sistem.';
    case 'EXPEDITION_NO_REWARDS': return 'Belum ada resource yang bisa ditemukan dalam ekspedisi.';
    case 'HOME_MAX_LEVEL': return 'Rumah lo sudah mencapai level maksimum.';
    case 'PET_INVALID_NAME': return 'Nama hewan harus 2–16 karakter dan hanya memakai huruf, angka, spasi, _ atau -.';
    case 'PET_NAME_TAKEN': return 'Lo sudah punya hewan dengan nama tersebut.';
    case 'PET_SLOTS_FULL': return 'Slot hewan penuh. Upgrade rumah untuk membuka slot tambahan.';
    case 'PET_NOT_FOUND': return 'Hewan peliharaan tidak ditemukan.';
    case 'PET_NEEDS_TBS': return 'Butuh minimal 5 TBS untuk memberi makan hewan.';
    case 'PET_XP_LIMIT': return 'XP hewan sudah mencapai batas aman sistem.';
    case 'MARKET_INVALID_PRICE': return 'Harga per item harus berupa angka bulat positif yang aman.';
    case 'MARKET_LISTING_NOT_FOUND': return 'Listing pasar tidak ditemukan.';
    case 'MARKET_LISTING_EXPIRED': return 'Listing ini sudah kedaluwarsa. Minta penjual membatalkannya agar item kembali.';
    case 'MARKET_SELF_PURCHASE': return 'Lo nggak bisa membeli listing milik sendiri.';
    case 'MARKET_NOT_ENOUGH_STOCK': return 'Jumlah yang diminta melebihi stok listing.';
    case 'MARKET_NOT_OWNER': return 'Hanya pemilik listing yang bisa membatalkannya.';
    case 'FAMILY_INVALID_NAME': return 'Nama keluarga harus 3–24 karakter dan hanya memakai huruf, angka, spasi, _ atau -.';
    case 'FAMILY_ALREADY_MEMBER': return 'Lo sudah menjadi anggota keluarga. Satu pemain hanya bisa bergabung dengan satu keluarga.';
    case 'FAMILY_SELF_INVITE': return 'Lo nggak bisa mengundang diri sendiri.';
    case 'FAMILY_OWNER_ONLY': return 'Hanya pemimpin keluarga yang bisa melakukan itu.';
    case 'FAMILY_FULL': return 'Keluarga sudah mencapai batas 8 anggota.';
    case 'FAMILY_INVITE_PENDING': return 'Undangan ke pemain itu sudah menunggu jawaban.';
    case 'FAMILY_INVITE_NOT_FOUND': return 'Undangan keluarga tidak ditemukan.';
    case 'FAMILY_TARGET_NOT_MEMBER': return 'Pemain tersebut bukan anggota keluarga lo.';
    case 'FAMILY_CANNOT_KICK_SELF': return 'Pemimpin tidak bisa mengeluarkan dirinya sendiri. Pindahkan kepemimpinan terlebih dahulu.';
    case 'FAMILY_NOT_FOUND': return 'Lo belum tergabung dalam keluarga.';
    case 'FAMILY_TRANSFER_FIRST': return 'Pindahkan kepemimpinan ke anggota lain sebelum keluar.';
    case 'FAMILY_ID_INVALID': return 'ID keluarga harus berupa angka positif.';
    case 'FAMILY_POINTS_LIMIT': return 'Poin keluarga mencapai batas aman sistem.';
    case 'MARRIAGE_SELF': return 'Lo nggak bisa mengajukan pasangan untuk diri sendiri.';
    case 'MARRIAGE_ALREADY_MARRIED': return 'Salah satu pemain sudah punya pasangan game.';
    case 'MARRIAGE_PROPOSAL_RECEIVED': return 'Pemain itu sudah mengirim proposal ke lo. Gunakan !nikah accept @pemain.';
    case 'MARRIAGE_PROPOSAL_PENDING': return 'Proposal ke pemain itu masih menunggu jawaban.';
    case 'MARRIAGE_PROPOSAL_NOT_FOUND': return 'Proposal pasangan tidak ditemukan.';
    case 'MARRIAGE_NOT_FOUND': return 'Lo belum punya pasangan game.';
    case 'BOND_LIMIT': return 'Poin bond sudah mencapai batas aman sistem.';
    case 'BIO_TOO_LONG': return 'Bio maksimal 160 karakter.';
    case 'FRIEND_SELF': return 'Lo nggak bisa menambahkan diri sendiri sebagai teman.';
    case 'FRIEND_USER_NOT_FOUND': return 'Akun pemain itu belum terdaftar. Minta dia memakai command bot dulu.';
    case 'ALREADY_FRIENDS': return 'Kalian sudah berteman.';
    case 'FRIEND_REQUEST_RECEIVED': return 'Pemain itu sudah mengirim permintaan. Gunakan !teman accept @pemain.';
    case 'FRIEND_REQUEST_PENDING': return 'Permintaan pertemanan ke pemain itu masih menunggu.';
    case 'FRIEND_REQUEST_NOT_FOUND': return 'Permintaan pertemanan tidak ditemukan.';
    case 'FRIEND_NOT_FOUND': return 'Pemain itu tidak ada di daftar teman lo.';
    case 'FRIEND_TARGET_REQUIRED': return 'Tandai pemain dengan mention. Contoh: !teman add @pemain.';
    case 'ACCOUNT_NOT_FOUND': return 'Akun belum siap. Coba ulangi command ini.';
    case 'INSUFFICIENT_FUNDS': return 'Saldo lo kurang buat transaksi itu.';
    case 'INVALID_AMOUNT': return 'Jumlah harus berupa angka bulat positif yang aman.';
    case 'INVALID_QUANTITY': return 'Jumlah harus berupa angka bulat positif yang aman.';
    case 'ITEM_NOT_FOUND': return 'Item itu nggak tersedia di shop.';
    case 'ITEM_NOT_SELLABLE': return 'Item itu belum bisa dijual.';
    case 'INSUFFICIENT_ITEM': return 'Jumlah item yang lo punya nggak cukup.';
    case 'INVENTORY_LIMIT': return 'Jumlah item sudah mencapai batas aman sistem.';
    case 'CROP_NOT_FOUND': return 'Jenis tanaman itu belum tersedia.';
    case 'CROP_REWARD_ITEM_NOT_FOUND': return 'Data hasil panen belum lengkap. Admin perlu memeriksa konfigurasi tanaman.';
    case 'INSUFFICIENT_SEEDS': return 'Bibit lo nggak cukup. Beli dulu di !shop lalu !buy.';
    case 'INSUFFICIENT_LAND': return 'Lahan kosong lo nggak cukup. Gunakan !luasin buat buka plot baru.';
    case 'NOT_READY': return 'Belum ada tanaman yang siap dipanen.';
    case 'MAX_LAND': return 'Lahan lo sudah mencapai batas maksimum untuk versi ini.';
    case 'BALANCE_LIMIT': return 'Saldo sudah mencapai batas aman sistem. Admin perlu audit economy.';
    case 'LAND_COST_LIMIT': return 'Biaya ekspansi melewati batas aman sistem. Admin perlu menyesuaikan konfigurasi.';
    case 'COOLDOWN': {
      const remaining = typeof availableAt === 'number' ? Math.max(0, availableAt - Date.now()) : 0;
      return `Belum bisa dipakai. Tunggu ${formatDuration(remaining)} lagi.`;
    }
    default: return 'Terjadi error saat memproses command. Coba lagi sebentar.';
  }
}
