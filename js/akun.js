import { db, auth } from "./firebase-config.js";
import {
  ref, get, set, push, update, remove, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  signOut, updateProfile, updatePassword, deleteUser,
  reauthenticateWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  BANDARA, rupiah, formatTanggal, getSession, authSiap, pesanAuth,
  renderNavbar, showAlert, setLoading
} from "./common.js";

renderNavbar("akun");

//halaman ini khusus anggota: tunggu Firebase Auth memulihkan status login dulu
const user = await authSiap;
if (!user) { location.href = "anggota.html"; throw new Error("Belum masuk"); }
const sesi = getSession();

const $ = (id) => document.getElementById(id);
const memberRef = ref(db, `members/${sesi.id}`);
let member = null;
let formSudahDiisi = false;
let sedangMenghapus = false;   // supaya onValue tidak ikut bereaksi saat akun sedang dihapus

//read(realtime): onValue akan terpanggil setiap kali data
//anggota berubah, jadi tampilan selalu sinkron dengan database
onValue(memberRef, async (snap) => {
  if (sedangMenghapus) return;
  if (!snap.exists()) {   // profil tidak ada lagi (misalnya dihapus dari Console)
    await signOut(auth);
    location.href = "index.html";
    return;
  }
  member = snap.val();
  tampilkanProfil();
  tampilkanKartu();
  tampilkanBooking();
  if (!formSudahDiisi) isiFormProfil();
}, (err) => {
  if (!sedangMenghapus) showAlert("alertAkun", "danger", "Gagal membaca profil: " + err.message);
});

//Firebase Auth mewajibkan login ulang sebelum ganti kata sandi atau hapus akun.
//Caranya: cocokkan lagi kata sandi saat ini (reauthenticate).
async function konfirmasiKataSandi(kataSandi) {
  if (!kataSandi) throw new Error("Masukkan kata sandi saat ini.");
  try {
    const kredensial = EmailAuthProvider.credential(auth.currentUser.email, kataSandi);
    await reauthenticateWithCredential(auth.currentUser, kredensial);
  } catch (err) {
    const salah = ["auth/invalid-credential", "auth/wrong-password"].includes(err.code);
    throw new Error(salah ? "Kata sandi saat ini salah." : pesanAuth(err));
  }
}

function tampilkanProfil() {
  $("judulNama").textContent = member.nama;
  $("noAnggota").textContent = member.nomorAnggota;
  const baris = [
    ["Email", member.email],
    ["Telepon", member.telepon],
    ["Tanggal lahir", formatTanggal(member.tanggalLahir)],
    ["Kewarganegaraan", member.kewarganegaraan],
    ["Jenis kelamin", member.jenisKelamin === "P" ? "Perempuan" : "Laki-laki"],
    ["Bergabung", member.bergabungPada ? new Date(member.bergabungPada).toLocaleDateString("id-ID") : "-"]
  ];
  $("profil").innerHTML = baris.map(([k, v]) =>
    `<dt class="col-sm-4 fw-semibold text-muted">${k}</dt><dd class="col-sm-8 fw-bold">${v}</dd>`).join("");
}

function isiFormProfil() {
  $("uNama").value = member.nama;
  $("uTelepon").value = member.telepon;
  $("uTglLahir").value = member.tanggalLahir;
  $("uWn").value = member.kewarganegaraan;
  formSudahDiisi = true;
}

//update: ubah informasi profil
$("formProfil").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnProfil");
  setLoading(btn, true, "Menyimpan...");
  try {
    const perubahan = {
      nama: $("uNama").value.trim(),
      telepon: $("uTelepon").value.trim(),
      tanggalLahir: $("uTglLahir").value,
      kewarganegaraan: $("uWn").value,
      diperbaruiPada: serverTimestamp()
    };

    const pwBaru = $("uPassword").value;
    if (pwBaru) {
      await konfirmasiKataSandi($("uPasswordLama").value);
      await updatePassword(auth.currentUser, pwBaru);
    }
    await update(memberRef, perubahan);
    await updateProfile(auth.currentUser, { displayName: perubahan.nama });  // nama di navbar
    renderNavbar();
    $("uPassword").value = "";
    $("uPasswordLama").value = "";
    showAlert("alertAkun", "success", pwBaru ? "Profil dan kata sandi tersimpan." : "Profil tersimpan.");
  } catch (err) {
    showAlert("alertAkun", "danger", "Gagal menyimpan profil: " + pesanAuth(err));
  } finally {
    setLoading(btn, false);
  }
});

//create, read, delete: metode pembayaran tersimpan
function tampilkanKartu() {
  const kartu = Object.entries(member.metodePembayaran || {});
  $("daftarKartu").innerHTML = kartu.length
    ? kartu.map(([id, k]) => `
      <li class="list-group-item d-flex justify-content-between align-items-center">
        <span><strong>${k.jenis}</strong> •••• ${k.empatDigit}<br>
        <small class="text-muted">${k.namaPemilik}, berlaku s.d. ${k.berlakuSampai}</small></span>
        <button class="btn btn-sm btn-outline-danger" data-hapus-kartu="${id}">Hapus</button>
      </li>`).join("")
    : `<li class="list-group-item text-muted">Belum ada kartu tersimpan.</li>`;
}

$("formKartu").addEventListener("submit", async (e) => {
  e.preventDefault();
  const nomor = $("kNomor").value.replace(/\s/g, "");
  try {
    await set(push(ref(db, `members/${sesi.id}/metodePembayaran`)), {
      jenis: $("kJenis").value,
      empatDigit: nomor.slice(-4),
      namaPemilik: $("kNama").value.trim().toUpperCase(),
      berlakuSampai: $("kExp").value,
      ditambahkanPada: serverTimestamp()
    });
    e.target.reset();
    showAlert("alertAkun", "success", "Kartu ditambahkan.");
  } catch (err) {
    showAlert("alertAkun", "danger", "Gagal menambah kartu: " + err.message);
  }
});

$("daftarKartu").addEventListener("click", async (e) => {
  const id = e.target.dataset.hapusKartu;
  if (!id || !confirm("Hapus kartu ini dari akunmu?")) return;
  try {
    await remove(ref(db, `members/${sesi.id}/metodePembayaran/${id}`));
    showAlert("alertAkun", "success", "Kartu dihapus.");
  } catch (err) {
    showAlert("alertAkun", "danger", "Gagal menghapus kartu: " + err.message);
  }
});

//read: pemesanan milik anggota
async function tampilkanBooking() {
  const kodes = Object.keys(member.bookings || {});
  if (!kodes.length) {
    $("daftarBooking").innerHTML = `<div class="kosong">Belum ada pemesanan.
      <a href="index.html" class="fw-bold text-dark">Cari penerbangan</a> untuk mulai.</div>`;
    return;
  }
  const snaps = await Promise.all(kodes.map((k) => get(ref(db, `bookings/${k}`))));
  $("daftarBooking").innerHTML = snaps.filter((s) => s.exists()).map((s) => {
    const b = s.val(), f = b.penerbangan;
    return `<a class="hasil-penerbangan text-decoration-none text-dark d-flex justify-content-between align-items-center"
      href="kelola.html?kode=${b.kodeBooking}">
      <span><strong class="display-font fs-5">${b.kodeBooking}</strong><br>
      <small>${BANDARA[f.asal]} ke ${BANDARA[f.tujuan]}, ${formatTanggal(f.tanggal)}</small></span>
      <span class="text-end"><span class="badge-status">${b.status}</span><br><small>${rupiah(b.totalHarga)}</small></span>
    </a>`;
  }).join("") || `<div class="kosong">Semua pemesanan sudah dibatalkan.</div>`;
}

//delete: hapus akun anggota (data di database + akun login di Firebase Auth)
$("formHapus").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!confirm("Akun akan dihapus permanen. Lanjutkan?")) return;
  const btn = $("btnHapus");
  setLoading(btn, true, "Menghapus...");
  try {
    //1. pastikan yang menghapus benar-benar pemilik akun
    await konfirmasiKataSandi($("passwordHapus").value);
    sedangMenghapus = true;

    //2. hapus profil dan lepaskan tautan akun di setiap booking (tiket tetap ada)
    const updates = { [`members/${sesi.id}`]: null };   //null = hapus node
    for (const kode of Object.keys(member.bookings || {})) {
      updates[`bookings/${kode}/memberId`] = null;
    }
    await update(ref(db), updates);

    //3. hapus akun login di Firebase Auth (otomatis keluar)
    await deleteUser(auth.currentUser);
    location.href = "index.html";
  } catch (err) {
    sedangMenghapus = false;
    showAlert("alertAkun", "danger", "Gagal menghapus akun: " + pesanAuth(err));
    setLoading(btn, false);
  }
});
