import { db } from "./firebase-config.js";
import {
  ref, get, set, push, update, remove, onValue, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  BANDARA, rupiah, formatTanggal, getSession, setSession, clearSession,
  renderNavbar, showAlert, hashPassword, setLoading
} from "./common.js";

const sesi = getSession();
if (!sesi) { location.href = "anggota.html"; throw new Error("Belum masuk"); }
renderNavbar("akun");

const $ = (id) => document.getElementById(id);
const memberRef = ref(db, `members/${sesi.id}`);
let member = null;
let formSudahDiisi = false;

//read(realtime): onValue akan terpanggil setiap kali data
//anggota berubah, jadi tampilan selalu sinkron dengan database
onValue(memberRef, (snap) => {
  if (!snap.exists()) {   // akun sudah dihapus
    clearSession();
    location.href = "index.html";
    return;
  }
  member = snap.val();
  tampilkanProfil();
  tampilkanKartu();
  tampilkanBooking();
  if (!formSudahDiisi) isiFormProfil();
});

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
    if ($("uPassword").value) perubahan.password = await hashPassword($("uPassword").value);
    await update(memberRef, perubahan);
    setSession({ id: sesi.id, nama: perubahan.nama });
    renderNavbar("akun");
    $("uPassword").value = "";
    showAlert("alertAkun", "success", "Profil tersimpan.");
  } catch (err) {
    showAlert("alertAkun", "danger", "Gagal menyimpan profil: " + err.message);
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

//delete: hapus akun anggota
$("formHapus").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!confirm("Akun akan dihapus permanen. Lanjutkan?")) return;
  const btn = $("btnHapus");
  setLoading(btn, true, "Menghapus...");
  try {
    const updates = { [`members/${sesi.id}`]: null };   //null = hapus node
    //melepaskan tautan akun di setiap booking agar data tiket tetap valid
    for (const kode of Object.keys(member.bookings || {})) {
      updates[`bookings/${kode}/memberId`] = null;
    }
    await update(ref(db), updates);
    //onValue di atas akan mendeteksi akun hilang lalu mengarahkan ke beranda
  } catch (err) {
    showAlert("alertAkun", "danger", "Gagal menghapus akun: " + err.message);
    setLoading(btn, false);
  }
});
