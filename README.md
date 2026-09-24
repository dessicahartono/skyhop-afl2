# SkyHop

SkyHop adalah website pemesanan tiket pesawat sederhana. Website ini dibuat dengan HTML, CSS, Bootstrap 5, dan JavaScript. Untuk penyimpanan data saya memakai Firebase Realtime Database sebagai BaaS (Backend as a Service), jadi aplikasi ini tidak punya server atau backend sendiri. JavaScript di browser langsung membaca dan menulis data ke Firebase lewat Firebase SDK.

Proyek Firebase yang dipakai adalah `skyhop-project`, dengan database di region asia-southeast1 (Singapura).

## Fitur

Pengguna bisa mencari jadwal penerbangan, memesan tiket, mendaftar akun anggota (SkyHop Club), mengubah profil, menyimpan kartu pembayaran, dan mengelola tiket yang sudah dipesan. Di menu Kelola pemesanan, tiket bisa diganti jadwalnya, diganti kursinya, ditambah bagasinya, atau dibatalkan.

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

Setiap halaman HTML punya satu file JS sendiri. Fungsi yang dipakai bersama, misalnya navbar, sesi login, hash kata sandi, dan format rupiah, dikumpulkan di `common.js`.

## Cara menjalankan

1. Jalankan lewat server lokal, misalnya dengan Live Server di VS Code (klik kanan `index.html` > Open with Live Server). Website tidak bisa dibuka dengan klik dua kali file HTML karena file JS memakai ES module (`import` dan `export`).

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

Mengelola akun

1. Klik nama di navbar untuk membuka halaman akun.
2. Profil bisa diubah lewat form Ubah profil.
3. Kartu pembayaran bisa ditambah dan dihapus di bagian Metode pembayaran.
4. Untuk menghapus akun, ketik HAPUS di kotak merah lalu klik Hapus akun saya.

Mengelola pemesanan

1. Klik Kelola pemesanan di navbar.
2. Masukkan kode booking dan nama belakang penumpang, lalu klik Buka pemesanan.
3. Pilih tab Ganti jadwal, Ubah kursi, Tambah bagasi, atau Batalkan sesuai kebutuhan.

## Struktur data

Realtime Database menyimpan data dalam bentuk JSON bertingkat, tidak dalam bentuk tabel. Ada tiga node utama:

```
flights/{SH277_2026-09-30}
  kode, asal, tujuan, rute, tanggal, jamBerangkat, jamTiba, harga, kursiTersedia

members/{id dari push()}
  nama, email, password (hash SHA-256), telepon, tanggalLahir,
  kewarganegaraan, jenisKelamin, nomorAnggota, bergabungPada
  metodePembayaran/{id}: jenis, empatDigit, namaPemilik, berlakuSampai
  bookings/{kodeBooking}: true

bookings/{kodeBooking}
  kodeBooking, flightId, penerbangan{...}, penumpang{namaDepan, namaBelakang,
  email, telepon, noPaspor}, kursi, bagasiKg, totalHarga, status, memberId, dibuatPada
```

Di dalam data booking saya menyimpan salinan data penerbangan (`penerbangan{...}`). Ini sengaja, karena Realtime Database tidak punya JOIN seperti SQL. Dengan cara ini detail tiket cukup dibaca satu kali, dan harga yang tersimpan adalah harga saat tiket dibeli.

Node `members/{id}/bookings` dipakai untuk mencatat tiket mana saja yang dimiliki seorang anggota.

## Penerapan CRUD

| Operasi | Halaman      | Kegiatan                                      | Fungsi Firebase                                                              |
| ------- | ------------ | --------------------------------------------- | ---------------------------------------------------------------------------- |
| Create  | anggota.html | Daftar akun baru                              | `push()` dan `set()` ke `/members`                                           |
| Create  | index.html   | Pesan tiket                                   | `update()` multi-path ke `/bookings`, kursi dikurangi dengan `increment(-1)` |
| Create  | akun.html    | Tambah kartu pembayaran                       | `push()` dan `set()` ke `/members/{id}/metodePembayaran`                     |
| Read    | index.html   | Cari jadwal penerbangan pada tanggal tertentu | `get()` dengan `orderByChild("rute")` dan `equalTo()`                        |
| Read    | anggota.html | Masuk akun                                    | `get()` dengan `orderByChild("email")`                                       |
| Read    | akun.html    | Lihat profil dan daftar tiket                 | `onValue()` (realtime)                                                       |
| Read    | kelola.html  | Buka pemesanan                                | `get()` lalu `onValue()` (realtime)                                          |
| Update  | akun.html    | Ubah profil atau kata sandi                   | `update()`                                                                   |
| Update  | kelola.html  | Ganti jadwal, ubah kursi, tambah bagasi       | `update()`                                                                   |
| Delete  | kelola.html  | Batalkan pemesanan (paling lambat H-1)        | `update()` dengan nilai `null`                                               |
| Delete  | akun.html    | Hapus kartu pembayaran                        | `remove()`                                                                   |
| Delete  | akun.html    | Hapus akun                                    | `update()` dengan nilai `null`                                               |

Beberapa proses memakai multi-path `update()`, misalnya saat memesan tiket. Data booking disimpan, jumlah kursi dikurangi, dan tiket dicatat ke akun anggota dalam satu kali proses. Semua perubahan itu berhasil bersamaan atau gagal bersamaan, jadi datanya tidak setengah tersimpan. Di Firebase, menulis nilai `null` ke suatu path sama dengan menghapus data di path tersebut.

Jumlah kursi diubah dengan `increment()` supaya perhitungannya dilakukan langsung di server Firebase. Dengan begitu jumlah kursi tetap benar walaupun ada dua orang yang memesan di waktu yang sama.

## Aturan dalam aplikasi

- Satu email hanya bisa dipakai untuk satu akun.
- Satu kursi di penerbangan yang sama tidak bisa dipilih dua penumpang.
- Bagasi hanya bisa ditambah, tidak bisa dikurangi.
- Pembatalan tiket hanya bisa dilakukan paling lambat satu hari sebelum keberangkatan.

## Catatan

- Harga dan jadwal penerbangan adalah data contoh, bukan harga asli dari maskapai.
- Rules database masih dibuka untuk semua orang (`".read": true, ".write": true`) karena aplikasi ini untuk keperluan tugas. Kalau dipakai sungguhan, sebaiknya memakai Firebase Authentication dan rules dibatasi supaya setiap pengguna hanya bisa mengubah datanya sendiri.
- Login dibuat sendiri dengan mencocokkan email dan hash kata sandi, tidak memakai Firebase Authentication, karena fokus tugas ini adalah Realtime Database.
- Nomor kartu pembayaran tidak disimpan lengkap, hanya 4 digit terakhir.
