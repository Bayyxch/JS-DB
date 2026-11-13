# Juragan Sawit — Checklist Pengujian Rumah

Dokumen ini untuk pengujian setelah seluruh milestone M0–M6 siap digabung. Jalankan pada **database salinan**, bukan database ekonomi live.

## Persiapan

- [ ] Gunakan Node.js 24.
- [ ] Backup database yang sekarang, lalu buat database uji terpisah lewat `DATABASE_PATH=./data/sawit-test.sqlite`.
- [ ] Jalankan `npm install`.
- [ ] Jalankan `npm run ci` dan pastikan type-check, seluruh test, serta build berhasil.
- [ ] Buat server Discord privat untuk tes.
- [ ] Siapkan minimal dua akun Discord yang bisa memakai bot.
- [ ] Pastikan bot punya Message Content Intent dan izin membaca/mengirim pesan serta embed.
- [ ] Catat saldo, inventory, jumlah plot, dan data awal kedua akun sebelum transaksi.

## M0 — Fondasi dan ekonomi

- [ ] Bot menyala tanpa error konfigurasi atau migrasi.
- [ ] Akun baru mendapat saldo awal, plot, dan bibit sesuai konfigurasi.
- [ ] `!balance`, `!inventory`, dan `!kebun` menampilkan data akun yang benar.
- [ ] Tanam bibit, tunggu sampai siap, lalu panen. Item hasil panen masuk ke inventory.
- [ ] Jual item; saldo bertambah sesuai harga yang ditampilkan.
- [ ] Coba jumlah nol, negatif, terlalu besar, dan item yang tidak bisa dijual. Transaksi harus ditolak tanpa perubahan saldo/inventory.
- [ ] Restart bot; saldo, inventory, plot, tanaman, dan cooldown tetap tersimpan.

## M1 — Profil dan pertemanan global

- [ ] `!profil` menampilkan profil akun sendiri.
- [ ] Ubah bio dengan `!profil bio Halo, petani sawit!`.
- [ ] Bio lebih dari 160 karakter ditolak.
- [ ] Daftarkan akun kedua dengan menjalankan command bot, lalu lihat profilnya.
- [ ] Akun A mengirim `!teman add @B`; akun B menerima dengan `!teman accept @A`.
- [ ] Pastikan kedua akun saling muncul di `!teman list`.
- [ ] Uji decline dan remove; daftar harus ikut berubah.
- [ ] Ulangi dari server Discord kedua. Profil dan pertemanan harus tetap sama karena akun bersifat global.

## M2 — Pasangan game dan bond

- [ ] A mengirim proposal dengan `!nikah propose @B`; B menerima dengan `!nikah accept @A`.
- [ ] `!nikah status` menampilkan pasangan yang sama dari kedua akun.
- [ ] Proposal ke pemain yang sudah punya pasangan ditolak.
- [ ] Klaim bond dari satu akun, lalu coba klaim dari akun pasangan. Cooldown bersama 24 jam harus mencegah klaim kedua.
- [ ] Uji penolakan proposal dan perceraian. Status kedua pemain harus konsisten.
- [ ] Pastikan fitur ini hanya status pasangan dalam game dan tidak mengubah data Discord.

## M3 — Variasi tanaman dan koleksi

- [ ] `!shop` menampilkan bibit yang tersedia.
- [ ] Beli bibit jagung, padi, atau kakao sesuai ID yang ditampilkan.
- [ ] Tanam tanaman selain sawit dan pastikan timer tumbuhnya sesuai.
- [ ] Panen setelah siap; item hasil panen harus cocok dengan jenis tanaman.
- [ ] Jual hasil panen dan pastikan harga yang benar dipakai.
- [ ] `!koleksi` mencatat tanaman yang pernah dipanen dan jumlahnya.
- [ ] Pastikan panen gagal atau tanaman belum siap tidak menambah koleksi maupun inventory.

## M4 — Koperasi global

- [ ] Buat koperasi dengan `!koperasi create Sawit Bersatu`.
- [ ] Undang akun kedua, lalu terima undangan sesuai ID yang ditampilkan.
- [ ] `!koperasi info` menampilkan pemilik dan anggota.
- [ ] Panen sebagai anggota; progres koperasi bertambah sesuai kontribusi.
- [ ] Uji transfer kepemilikan, kick, leave, dan disband bila tersedia pada help.
- [ ] Pastikan satu pemain tidak bisa bergabung dengan dua koperasi sekaligus.
- [ ] Ulangi cek koperasi di server Discord kedua.

## M5 — Pasar global dan trade pemain

- [ ] `!market` menampilkan harga komoditas dan volume global.
- [ ] Jual item dari dua akun; harga transaksi kedua harus mengikuti harga pasar terbaru.
- [ ] `!market history tbs` menampilkan perubahan harga.
- [ ] Pastikan pergantian hari UTC mengatur ulang volume dan harga ke harga dasar.
- [ ] A membuat penawaran: `!trade offer @B tbs 20 corn 5`.
- [ ] Item yang ditawarkan harus dikunci dari inventory A selama penawaran aktif.
- [ ] B menerima dengan `!trade accept <id>`; kedua inventory berubah sesuai kesepakatan.
- [ ] Uji `!trade cancel <id>`; item escrow kembali ke A.
- [ ] Uji penawaran kedaluwarsa setelah 48 jam dengan waktu uji atau test otomatis.
- [ ] Akun selain target tidak boleh menerima penawaran.
- [ ] Pastikan penawaran terlihat lintas server dan batas lima penawaran aktif berlaku.

## M6 — Rumah, pet, petualangan, dan event

- [ ] `!rumah` membuat/menampilkan rumah Level 1.
- [ ] `!rumah upgrade` memotong SawitCoin dan menaikkan level rumah.
- [ ] Upgrade rumah membuka zona petualangan yang sesuai; level maksimum tidak bisa dilewati.
- [ ] `!pet shop` menampilkan spesies, rarity, harga, dan bonus.
- [ ] Adopsi pet dengan `!pet adopt cat`; biaya terpotong dan pet masuk ke daftar.
- [ ] Maksimal lima pet per pemain.
- [ ] `!pet equip <id>` mengganti pet aktif; hanya satu pet yang aktif.
- [ ] Beli Pakan Hewan lewat `!shop`, lalu gunakan `!pet feed <id>`; pakan berkurang dan XP bertambah.
- [ ] Pet yang mencapai level maksimum tidak bisa diberi XP lagi.
- [ ] `!adventure` menampilkan zona dan syarat rumah.
- [ ] Jalankan `!adventure explore river`; saldo bertambah dan transaksi tercatat.
- [ ] Jalankan petualangan lagi sebelum cooldown selesai; harus ditolak.
- [ ] Rumah dan pet aktif memberi bonus sesuai yang ditampilkan.
- [ ] `!adventure history` menampilkan riwayat.
- [ ] `!event` menampilkan event yang sama dari dua server.
- [ ] Event panen memengaruhi hasil panen; event petualangan memengaruhi reward; event pet memengaruhi XP pakan.

## Pemeriksaan lintas milestone

- [ ] Data pemain sama saat bot dipakai dari dua server Discord.
- [ ] Cooldown tetap berlaku lintas server dan setelah restart.
- [ ] Setiap perubahan saldo tercatat di ledger transaksi.
- [ ] Setiap kegagalan transaksi tidak meninggalkan perubahan parsial.
- [ ] Migrasi database mempertahankan saldo, inventory, plot, tanaman, profil, dan relasi pemain yang sudah ada.
- [ ] Tidak ada error unhandled di console selama smoke test.
- [ ] Semua command di `!help` cocok dengan fitur yang benar-benar tersedia.

## Catatan hasil

Catat command, akun penguji, hasil yang diharapkan, hasil aktual, dan screenshot/log bila ada. Jangan menguji migrasi pada satu-satunya salinan database live.
