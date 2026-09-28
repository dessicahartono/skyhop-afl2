# SkyHop

SkyHop adalah website pemesanan tiket pesawat sederhana. Website ini dibuat dengan HTML, CSS, Bootstrap 5, dan JavaScript. Untuk penyimpanan data saya memakai Firebase Realtime Database sebagai BaaS (Backend as a Service), jadi aplikasi ini tidak punya server atau backend sendiri. JavaScript di browser langsung membaca dan menulis data ke Firebase lewat Firebase SDK.

Register dan login anggota memakai **Firebase Authentication** (metode Email/Password). Firebase Auth yang menyimpan dan memeriksa kata sandi, sedangkan data profil anggota disimpan di Realtime Database dengan kunci `uid` dari Firebase Auth.

Proyek Firebase yang dipakai adalah `skyhop-project`, dengan database di region asia-southeast1 (Singapura).

## Fitur

Pengguna bisa mencari jadwal penerbangan, memesan tiket, mendaftar dan masuk akun anggota (SkyHop Club) dengan Firebase Authentication, meminta tautan reset kata sandi, mengubah profil, menyimpan kartu pembayaran, dan mengelola tiket yang sudah dipesan. Di menu Kelola pemesanan, tiket bisa diganti jadwalnya, diganti kursinya, ditambah bagasinya, atau dibatalkan.

Halaman akun dan halaman kelola pemesanan memakai fitur realtime dari Firebase. Kalau data di database berubah, tampilannya ikut berubah tanpa perlu refresh.

## Struktur folder

```
skyhop-firebase/
├── index.html              Beranda, cari penerbangan dan pesan tiket
├── anggota.html            Daftar dan masuk SkyHop Club
├── akun.html               Profil, ubah profil, kartu, hapus akun
├── kelola.html             Kelola pemesanan
├── css/style.css           Tampilan dan warna
├── js/firebase-config.js   Konfigurasi koneksi ke Firebase
├── js/common.js            Fungsi yang dipakai di semua halaman
├── js/index.js             Logika halaman beranda
├── js/anggota.js           Logika daftar dan masuk
├── js/akun.js              Logika halaman akun
├── js/kelola.js            Logika kelola pemesanan
└── database.rules.json     Rules dan index database
```

Setiap halaman HTML punya satu file JS sendiri. Fungsi yang dipakai bersama, misalnya navbar, status login dari Firebase Auth, terjemahan pesan error login, dan format rupiah, dikumpulkan di `common.js`.

## Cara menjalankan

1. Aktifkan Firebase Authentication: buka Firebase Console > Authentication > Get started > tab Sign-in method > pilih **Email/Password** > Enable > Save. Ulangi untuk **Google** (isi Project support email lalu Save).
2. Publish rules: salin isi `database.rules.json` ke Firebase Console > Realtime Database > tab Rules, lalu klik Publish.
3. Jalankan lewat server lokal, misalnya dengan Live Server di VS Code (klik kanan `index.html` > Open with Live Server). Website tidak bisa dibuka dengan klik dua kali file HTML karena file JS memakai ES module (`import` dan `export`).

## Cara pemakaian

Mencari dan memesan tiket

1. Di halaman beranda, pilih kota asal, kota tujuan, dan tanggal berangkat, lalu klik Cari penerbangan.
2. Klik Pilih pada jadwal yang diinginkan.
3. Isi data penumpang, pilih kursi dan bagasi, lalu klik Pesan sekarang.
4. Simpan kode booking yang muncul. Kode ini dipakai untuk membuka tiket di menu Kelola pemesanan.

Kalau sedang login, data penumpang akan terisi otomatis dari profil dan tiketnya tercatat di halaman akun.

Mendaftar dan masuk

1. Klik SkyHop Club di navbar.
2. Isi form Daftar akun baru lalu klik Buat akun, atau isi email dan kata sandi di form sebelah kanan lalu klik Masuk.
3. Kalau lupa kata sandi, isi email di form Masuk lalu klik Lupa kata sandi. Firebase akan mengirim email berisi tautan untuk membuat kata sandi baru.
4. Klik Keluar di navbar untuk logout.

Mengelola akun

1. Klik nama di navbar untuk membuka halaman akun.
2. Profil bisa diubah lewat form Ubah profil. Untuk mengganti kata sandi, isi Kata sandi baru dan Kata sandi saat ini.
3. Kartu pembayaran bisa ditambah dan dihapus di bagian Metode pembayaran.
4. Untuk menghapus akun, ketik HAPUS dan kata sandi di kotak merah lalu klik Hapus akun saya. Akun login di Firebase Auth dan profil di database ikut terhapus.

Mengelola pemesanan

1. Klik Kelola pemesanan di navbar.
2. Masukkan kode booking dan nama belakang penumpang, lalu klik Buka pemesanan.
3. Pilih tab Ganti jadwal, Ubah kursi, Tambah bagasi, atau Batalkan sesuai kebutuhan.

## Struktur data

Realtime Database menyimpan data dalam bentuk JSON bertingkat, tidak dalam bentuk tabel. Ada tiga node utama:

```
flights/{SH277_2026-09-30}
  kode, asal, tujuan, rute, tanggal, jamBerangkat, jamTiba, harga, kursiTersedia

members/{uid dari Firebase Auth}
  nama, email, telepon, tanggalLahir,
  kewarganegaraan, jenisKelamin, nomorAnggota, bergabungPada
  metodePembayaran/{id}: jenis, empatDigit, namaPemilik, berlakuSampai
  bookings/{kodeBooking}: true

bookings/{kodeBooking}
  kodeBooking, flightId, penerbangan{...}, penumpang{namaDepan, namaBelakang,
  email, telepon, noPaspor}, kursi, bagasiKg, totalHarga, status, memberId, dibuatPada

kursi/{flightId}/{nomorKursi}
  kodeBooking pemilik kursi, misalnya kursi/SH277_2026-09-30/12A: "K7XQ2M"
```

Node `kursi` adalah "kunci" kursi. Setiap kali tiket dipesan, kursi diganti, jadwal diganti, atau tiket dibatalkan, node ini ikut diubah dalam multi-path update yang sama. Rules `.validate` menolak penulisan ke kursi yang sudah dimiliki booking lain, jadi walaupun dua orang menekan Pesan di detik yang sama, hanya satu yang berhasil.

Di dalam data booking saya menyimpan salinan data penerbangan (`penerbangan{...}`). Ini sengaja, karena Realtime Database tidak punya JOIN seperti SQL. Dengan cara ini detail tiket cukup dibaca satu kali, dan harga yang tersimpan adalah harga saat tiket dibeli.

Kata sandi tidak disimpan di database sama sekali, karena sudah dikelola Firebase Authentication. Kunci node `members` memakai `uid` dari Firebase Auth, sehingga rules bisa memastikan setiap anggota hanya bisa membaca dan mengubah datanya sendiri (`auth.uid === $uid`).

Node `members/{uid}/bookings` dipakai untuk mencatat tiket mana saja yang dimiliki seorang anggota.

## Penerapan CRUD

| Operasi | Halaman      | Kegiatan                                      | Fungsi Firebase                                                              |
| ------- | ------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Create  | anggota.html | Daftar akun baru                              | `createUserWithEmailAndPassword()` (Auth), lalu `set()` ke `/members/{uid}`  |
| Create  | index.html   | Pesan tiket                                   | `update()` multi-path ke `/bookings`, kursi dikurangi dengan `increment(-1)` |
| Create  | akun.html    | Tambah kartu pembayaran                       | `push()` dan `set()` ke `/members/{id}/metodePembayaran`                     |
| Read    | index.html   | Cari jadwal penerbangan pada tanggal tertentu | `get()` dengan `orderByChild("rute")` dan `equalTo()`                        |
| Read    | anggota.html | Masuk akun                                    | `signInWithEmailAndPassword()` (Auth)                                        |
| Read    | akun.html    | Lihat profil dan daftar tiket                 | `onValue()` (realtime)                                                       |
| Read    | kelola.html  | Buka pemesanan                                | `get()` lalu `onValue()` (realtime)                                          |
| Update  | akun.html    | Ubah profil atau kata sandi                   | `update()`, `updateProfile()` dan `updatePassword()` (Auth)                  |
| Update  | kelola.html  | Ganti jadwal, ubah kursi, tambah bagasi       | `update()`                                                                   |
| Delete  | kelola.html  | Batalkan pemesanan (paling lambat H-1)        | `update()` dengan nilai `null`                                               |
| Delete  | akun.html    | Hapus kartu pembayaran                        | `remove()`                                                                   |
| Delete  | akun.html    | Hapus akun                                    | `update()` dengan nilai `null`, lalu `deleteUser()` (Auth)                   |

Beberapa proses memakai multi-path `update()`, misalnya saat memesan tiket. Data booking disimpan, jumlah kursi dikurangi, dan tiket dicatat ke akun anggota dalam satu kali proses. Semua perubahan itu berhasil bersamaan atau gagal bersamaan, jadi datanya tidak setengah tersimpan. Di Firebase, menulis nilai `null` ke suatu path sama dengan menghapus data di path tersebut.

Jumlah kursi diubah dengan `increment()` supaya perhitungannya dilakukan langsung di server Firebase. Dengan begitu jumlah kursi tetap benar walaupun ada dua orang yang memesan di waktu yang sama.

## Firebase Authentication

| Fitur            | File          | Fungsi Firebase Auth                                  |
| ---------------- | ------------- | ----------------------------------------------------- |
| Register         | js/anggota.js | `createUserWithEmailAndPassword()`, `updateProfile()` |
| Login            | js/anggota.js | `signInWithEmailAndPassword()`                        |
| Daftar / masuk dengan Google | js/anggota.js | `signInWithPopup()` dengan `GoogleAuthProvider` |
| Lupa kata sandi  | js/anggota.js | `sendPasswordResetEmail()`                            |
| Cek status login | js/common.js  | `onAuthStateChanged()`                                |
| Logout           | js/common.js  | `signOut()`                                           |
| Ganti kata sandi | js/akun.js    | `reauthenticateWithCredential()`, `updatePassword()`  |
| Hapus akun       | js/akun.js    | `reauthenticateWithCredential()`, `deleteUser()`      |

Firebase Auth menyimpan status login di browser dan memulihkannya setiap halaman dibuka. Karena pemulihan ini butuh waktu sebentar, `common.js` menyediakan `authSiap`, yaitu Promise yang selesai saat status login sudah diketahui. Halaman akun menunggu `authSiap` sebelum memutuskan apakah pengunjung boleh masuk atau harus diarahkan ke halaman login.

Untuk ganti kata sandi dan hapus akun, Firebase mewajibkan pengguna login ulang. Karena itu kedua form meminta kata sandi saat ini, lalu dicocokkan dengan `reauthenticateWithCredential()`.

## Aturan dalam aplikasi

- Satu email hanya bisa dipakai untuk satu akun (dicek otomatis oleh Firebase Auth).
- Kata sandi minimal 6 karakter (aturan Firebase Auth).
- Data anggota di `members/{uid}` hanya bisa dibaca dan diubah oleh pemiliknya sendiri.
- Satu kursi di penerbangan yang sama tidak bisa dipilih dua penumpang, baik saat pesan tiket, ganti jadwal, maupun ubah kursi. Kursi yang sudah terisi ditandai "(terisi)" dan tidak bisa dipilih. Satu orang tetap boleh memesan beberapa kursi (satu kode booking per kursi).
- Pengecekan kursi dilakukan dua lapis: di browser (query `bookings` berdasarkan `flightId`) dan di server (rules `.validate` pada node `kursi`). Rules di `database.rules.json` harus di-publish ke Firebase Console supaya lapis kedua aktif.
- Bagasi hanya bisa ditambah, tidak bisa dikurangi.
- Pembatalan tiket hanya bisa dilakukan paling lambat satu hari sebelum keberangkatan.

## Catatan

- Harga dan jadwal penerbangan adalah data contoh, bukan harga asli dari maskapai.
- Node `members` sudah dilindungi rules berbasis Firebase Auth. Node `flights`, `bookings`, dan `kursi` masih terbuka karena tamu yang tidak login tetap boleh memesan dan mengelola tiket dengan kode booking.
- Akun lama dari versi sebelumnya (login buatan sendiri dengan hash SHA-256) tidak bisa dipakai lagi dan perlu mendaftar ulang, karena akunnya belum ada di Firebase Authentication.
- Nomor kartu pembayaran tidak disimpan lengkap, hanya 4 digit terakhir.
