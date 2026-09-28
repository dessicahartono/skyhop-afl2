// Utilitas yang dipakai di semua halaman
import { db, auth } from "./firebase-config.js";
import {
  ref, get, query, orderByChild, equalTo
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  onAuthStateChanged, signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

export const DB_SDK = "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

export const BANDARA = {
  MDC: "Manado (MDC)",
  CGK: "Jakarta (CGK)",
  DPS: "Bali (DPS)",
  SIN: "Singapura (SIN)",
  KUL: "Kuala Lumpur (KUL)",
  BKK: "Bangkok (BKK)"
};

//paket bagasi tercatat: kg, harga
export const BAGASI = { 0: 0, 15: 185000, 20: 230000, 25: 290000, 30: 350000 };

export const rupiah = (n) => "Rp " + Number(n || 0).toLocaleString("id-ID");

export function tanggalLokal(d = new Date()) {
  const p = (x) => String(x).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

export function formatTanggal(iso) {
  return new Date(iso + "T00:00:00").toLocaleDateString("id-ID", {
    weekday: "short", day: "numeric", month: "short", year: "numeric"
  });
}

//sesi login dikelola Firebase Authentication.
//Firebase menyimpan status login sendiri di browser dan memulihkannya setiap halaman dibuka.
//Pemulihan butuh waktu sebentar, jadi halaman yang butuh status login menunggu authSiap dulu.
//Akun email yang belum diverifikasi dianggap belum login dan langsung dikeluarkan.
export const authSiap = new Promise((resolve) => {
  const berhenti = onAuthStateChanged(auth, async (user) => {
    berhenti();
    if (belumVerifikasi(user)) {
      await signOut(auth);
      user = null;
    }
    resolve(user);
  });
});

//akun daftar lewat email dan kata sandi yang belum klik link verifikasi.
//Akun Google tidak termasuk, karena emailnya sudah diverifikasi oleh Google.
export function belumVerifikasi(user) {
  return !!user && !user.emailVerified && user.providerData.some((p) => p.providerId === "password");
}

//data pengguna yang sedang login; id = uid dari Firebase Auth, dipakai sebagai kunci members/{uid}
export function getSession() {
  const u = auth.currentUser;
  return u && !belumVerifikasi(u) ? { id: u.uid, nama: u.displayName || u.email, email: u.email } : null;
}

//kode error Firebase Auth diterjemahkan ke pesan yang mudah dipahami
const PESAN_AUTH = {
  "auth/email-already-in-use": "Email ini sudah terdaftar. Silakan masuk dengan kata sandimu atau dengan Google.",
  "auth/invalid-email": "Format email tidak valid.",
  "auth/weak-password": "Kata sandi terlalu lemah. Gunakan minimal 6 karakter.",
  "auth/missing-password": "Kata sandi belum diisi.",
  //invalid-credential muncul kalau Email enumeration protection di Firebase masih aktif:
  //Firebase sengaja tidak memberi tahu apakah yang salah emailnya atau kata sandinya
  "auth/invalid-credential": "Email atau kata sandi salah. Periksa kembali lalu coba lagi.",
  "auth/wrong-password": "Kata sandi salah. Coba lagi, atau klik Lupa kata sandi untuk membuat yang baru.",
  "auth/user-not-found": "Akun dengan email ini tidak ditemukan. Periksa lagi emailnya, atau daftar akun baru.",
  "auth/user-disabled": "Akun ini sedang dinonaktifkan. Hubungi admin SkyHop.",
  "auth/invalid-action-code": "Link sudah tidak berlaku atau sudah pernah dipakai. Minta link baru lalu coba lagi.",
  "auth/expired-action-code": "Link sudah kedaluwarsa. Minta link baru lalu coba lagi.",
  "auth/unauthorized-continue-uri": "Alamat website belum ada di Authorized domains Firebase.",
  "auth/too-many-requests": "Terlalu banyak percobaan gagal. Tunggu beberapa menit lalu coba lagi.",
  "auth/network-request-failed": "Tidak bisa terhubung ke server. Periksa koneksi internetmu.",
  "auth/requires-recent-login": "Demi keamanan, masukkan kata sandimu saat ini lalu coba lagi.",
  "auth/operation-not-allowed": "Login email dan kata sandi belum diaktifkan di Firebase Console.",
  "auth/configuration-not-found": "Firebase Authentication belum diaktifkan di Firebase Console.",
  "auth/popup-blocked": "Popup login diblokir browser. Izinkan popup untuk situs ini lalu coba lagi.",
  "auth/unauthorized-domain": "Domain ini belum diizinkan. Tambahkan di Firebase Console > Authentication > Settings > Authorized domains.",
  "auth/account-exists-with-different-credential": "Email ini sudah terdaftar dengan cara masuk lain. Masuk dengan kata sandi dulu.",
  "auth/user-mismatch": "Akun Google yang dipilih berbeda dengan akun yang sedang masuk."
};
export const pesanAuth = (err) => PESAN_AUTH[err?.code] || err?.message || "Terjadi kesalahan.";

//komponen UI
let menuAktif = "";
let navbarDidengar = false;

//navbar digambar ulang otomatis setiap status login berubah (masuk / keluar)
export function renderNavbar(aktif = menuAktif) {
  menuAktif = aktif;
  gambarNavbar();
  if (!navbarDidengar) {
    navbarDidengar = true;
    onAuthStateChanged(auth, gambarNavbar);
  }
}

function gambarNavbar() {
  const s = getSession();
  const link = (href, id, label) =>
    `<li class="nav-item"><a class="nav-link ${menuAktif === id ? "active" : ""}" href="${href}">${label}</a></li>`;
  document.getElementById("navbar").innerHTML = `
  <nav class="navbar navbar-expand-lg brand-nav">
    <div class="container">
      <a class="navbar-brand logo" href="index.html">skyhop</a>
      <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navMenu"
        aria-label="Buka menu"><span class="navbar-toggler-icon"></span></button>
      <div class="collapse navbar-collapse" id="navMenu">
        <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-2">
          ${link("index.html", "beranda", "Cari penerbangan")}
          ${link("kelola.html", "kelola", "Kelola pemesanan")}
          ${s
            ? `${link("akun.html", "akun", "Hai, " + s.nama.split(" ")[0])}
               <li class="nav-item"><button class="btn btn-ink btn-sm ms-lg-2" id="btnKeluar">Keluar</button></li>`
            : `<li class="nav-item"><a class="btn btn-ink btn-sm ms-lg-2" href="anggota.html">SkyHop Club</a></li>`}
        </ul>
      </div>
    </div>
  </nav>`;
  document.getElementById("btnKeluar")?.addEventListener("click", async () => {
    await signOut(auth);          // keluar dari Firebase Auth
    location.href = "index.html";
  });
}

export function showAlert(el, type, msg) {
  const box = typeof el === "string" ? document.getElementById(el) : el;
  box.innerHTML = `<div class="alert alert-${type} alert-dismissible fade show" role="alert">
    ${msg}<button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Tutup"></button></div>`;
}

export function isiBandara(select, placeholder) {
  select.innerHTML = `<option value="">${placeholder}</option>` +
    Object.entries(BANDARA).map(([k, v]) => `<option value="${k}">${v}</option>`).join("");
}

//kursi yang sudah terisi di satu penerbangan (dari semua booking)
//kecualiKode: booking milik sendiri tidak dihitung sebagai "terisi"
export async function kursiTerisi(flightId, kecualiKode = "") {
  const snap = await get(query(ref(db, "bookings"), orderByChild("flightId"), equalTo(flightId)));
  const terisi = new Set();
  snap.forEach((c) => { if (c.key !== kecualiKode) terisi.add(c.val().kursi); });
  return terisi;
}

//error dari rules .validate di node kursi = kursi keburu diambil orang lain
export const kursiBentrok = (err) => String(err?.message || "").includes("PERMISSION_DENIED");

export function isiKursi(select, terpilih = "", terisi = new Set()) {
  const semua = [];
  for (let r = 1; r <= 30; r++) for (const c of "ABCDEF") semua.push(`${r}${c}`);
  //kalau kursi yang diminta sudah terisi, pilih kursi kosong pertama
  const pilih = terpilih && !terisi.has(terpilih) ? terpilih : semua.find((k) => !terisi.has(k));
  select.innerHTML = semua.map((k) => {
    const c = k.slice(-1);
    const ket = terisi.has(k) ? " (terisi)" : "AF".includes(c) ? " (jendela)" : "CD".includes(c) ? " (lorong)" : "";
    return `<option value="${k}" ${k === pilih ? "selected" : ""} ${terisi.has(k) ? "disabled" : ""}>${k}${ket}</option>`;
  }).join("");
}

export function isiBagasi(select, minimal = 0, terpilih = 0) {
  select.innerHTML = Object.entries(BAGASI)
    .filter(([kg]) => Number(kg) >= minimal)
    .map(([kg, h]) => `<option value="${kg}" ${Number(kg) === Number(terpilih) ? "selected" : ""}>
      ${kg == 0 ? "Tanpa bagasi tercatat" : kg + " kg"} ${h ? "(+" + rupiah(h) + ")" : ""}</option>`)
    .join("");
}

export function setLoading(btn, loading, teks) {
  if (loading) {
    btn.dataset.label = btn.innerHTML;
    btn.disabled = true;
    btn.innerHTML = `<span class="spinner-border spinner-border-sm me-2"></span>${teks || "Memproses..."}`;
  } else {
    btn.disabled = false;
    btn.innerHTML = btn.dataset.label;
  }
}
