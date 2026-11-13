import { formatDuration } from './format.js';

export function friendlyError(error: unknown): string {
  if (!(error instanceof Error)) return 'Terjadi error yang tidak diketahui.';

  const availableAt = (error as Error & { availableAt?: number }).availableAt;
  switch (error.message) {
    case 'COMPANY_NAME_TAKEN': return 'Nama koperasi itu sudah digunakan.';
    case 'COMPANY_NAME_INVALID': return 'Nama koperasi harus 3–24 karakter dan hanya boleh berisi huruf, angka, spasi, garis bawah, atau tanda hubung.';
    case 'COMPANY_ALREADY_MEMBER': return 'Lo sudah menjadi anggota koperasi lain.';
    case 'COMPANY_INVITE_SELF': return 'Lo nggak bisa mengundang diri sendiri.';
    case 'COMPANY_NOT_FOUND': return 'Lo belum tergabung dalam koperasi.';
    case 'COMPANY_OWNER_ONLY': return 'Aksi ini hanya bisa dilakukan pemilik koperasi.';
    case 'COMPANY_INVITE_NOT_FOUND': return 'Undangan koperasi tidak ditemukan atau sudah kedaluwarsa.';
    case 'COMPANY_FULL': return 'Koperasi sudah mencapai batas 20 anggota.';
    case 'COMPANY_OWNER_TRANSFER_REQUIRED': return 'Pindahkan kepemilikan dengan !koperasi transfer @anggota sebelum keluar.';
    case 'COMPANY_CANNOT_KICK_OWNER': return 'Pemilik tidak bisa mengeluarkan dirinya sendiri. Gunakan transfer atau disband.';
    case 'COMPANY_MEMBER_NOT_FOUND': return 'Anggota tersebut tidak ditemukan di koperasi lo.';
    case 'COMPANY_TRANSFER_SELF': return 'Pilih anggota lain untuk menerima kepemilikan.';
    case 'COMPANY_ID_INVALID': return 'ID koperasi tidak valid.';
    case 'COMPANY_PROGRESS_LIMIT': return 'Progres koperasi mencapai batas aman sistem.';
    case 'MARRIAGE_SELF': return 'Lo nggak bisa mengajukan pasangan untuk diri sendiri.';
    case 'MARRIAGE_ALREADY_MARRIED': return 'Salah satu pemain sudah punya pasangan game.';
    case 'MARRIAGE_PROPOSAL_RECEIVED': return 'Pemain itu sudah mengirim proposal ke lo. Gunakan !nikah accept @pemain.';
    case 'MARRIAGE_PROPOSAL_PENDING': return 'Proposal ke pemain itu masih menunggu jawaban.';
    case 'MARRIAGE_PROPOSAL_NOT_FOUND': return 'Proposal pasangan tidak ditemukan.';
    case 'MARRIAGE_PROPOSAL_PENDING': return 'Proposal pasangan ke pemain itu masih menunggu jawaban.';
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
