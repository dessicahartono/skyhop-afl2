import { db } from "./firebase-config.js";
import {
  ref, get, update, onValue, query, orderByChild, equalTo, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  BANDARA, BAGASI, rupiah, tanggalLokal, formatTanggal, getSession,
  renderNavbar, showAlert, isiKursi, isiBagasi, setLoading
} from "./common.js";

renderNavbar("kelola");
const $ = (id) => document.getElementById(id);

let kodeAktif = null;
let booking = null;
let berhentiDengar = null;      // fungsi unsubscribe listener realtime
let jadwalAlternatif = {};

//read: buka pemesanan dengan kode booking dan nama belakang
async function bukaBooking(kode, namaBelakang) {
  const snap = await get(ref(db, `bookings/${kode}`));
  if (!snap.exists()) throw new Error("Kode booking tidak ditemukan. Periksa 6 karakter kodenya.");
  const b = snap.val();
  if (namaBelakang !== null &&
      b.penumpang.namaBelakang.toLowerCase() !== namaBelakang.toLowerCase()) {
    throw new Error("Nama belakang tidak cocok dengan kode booking ini.");
  }

  kodeAktif = kode;
  berhentiDengar?.();
  berhentiDengar = onValue(ref(db, `bookings/${kode}`), (s) => {
    if (!s.exists()) {
      $("areaBooking").classList.add("d-none");
      showAlert("alertKelola", "success", `Pemesanan <strong>${kode}</strong> sudah dibatalkan dan dihapus.`);
      return;
    }
    booking = s.val();
    tampilkanTiket();
  });
  $("areaBooking").classList.remove("d-none");
  await muatJadwalAlternatif(b);
}

function tampilkanTiket() {
  const b = booking, f = b.penerbangan, p = b.penumpang;
  $("tiket").innerHTML = `
    <div class="tiket-atas d-flex justify-content-between align-items-start">
      <div><div class="small fw-bold">Kode booking</div><div class="tiket-kode">${b.kodeBooking}</div></div>
      <span class="badge-status">${b.status}</span>
    </div>
    <div class="tiket-isi">
      <div class="d-flex align-items-center mb-3">
        <div><div class="display-font fs-2 fw-bold lh-1">${f.asal}</div><small>${f.jamBerangkat}</small></div>
        <span class="flex-fill mx-3 border-top border-2 border-dark" style="border-style:dashed!important"></span>
        <div class="text-end"><div class="display-font fs-2 fw-bold lh-1">${f.tujuan}</div><small>${f.jamTiba}</small></div>
      </div>
      <dl class="row mb-0">
        <dt class="col-6">Penerbangan</dt><dd class="col-6">${f.kode}</dd>
        <dt class="col-6">Tanggal</dt><dd class="col-6">${formatTanggal(f.tanggal)}</dd>
        <dt class="col-6">Penumpang</dt><dd class="col-6">${p.namaDepan} ${p.namaBelakang}</dd>
        <dt class="col-6">Paspor</dt><dd class="col-6">${p.noPaspor}</dd>
        <dt class="col-6">Kursi</dt><dd class="col-6">${b.kursi}</dd>
        <dt class="col-6">Bagasi</dt><dd class="col-6">${b.bagasiKg ? b.bagasiKg + " kg" : "Kabin saja"}</dd>
        <dt class="col-6">Total bayar</dt><dd class="col-6">${rupiah(b.totalHarga)}</dd>
      </dl>
      ${b.diperbaruiPada ? `<small class="text-muted">Terakhir diubah ${new Date(b.diperbaruiPada).toLocaleString("id-ID")}</small>` : ""}
    </div>`;
  isiKursi($("pilihKursi"), b.kursi);
  isiBagasi($("pilihBagasi"), b.bagasiKg, b.bagasiKg);
}

async function muatJadwalAlternatif(b) {
  const f = b.penerbangan;
  const snap = await get(query(ref(db, "flights"), orderByChild("rute"), equalTo(`${f.asal}-${f.tujuan}`)));
  const besok = new Date(); besok.setDate(besok.getDate() + 1);
  jadwalAlternatif = {};
  snap.forEach((c) => {
    const x = c.val();
    if (c.key !== b.flightId && x.tanggal >= tanggalLokal(besok) && x.kursiTersedia > 0) jadwalAlternatif[c.key] = x;
  });
  const opsi = Object.entries(jadwalAlternatif)
    .sort(([, a], [, z]) => (a.tanggal + a.jamBerangkat).localeCompare(z.tanggal + z.jamBerangkat));
  $("pilihJadwal").innerHTML = `<option value="">Pilih jadwal baru</option>` + opsi.map(([id, x]) =>
    `<option value="${id}">${formatTanggal(x.tanggal)}, ${x.jamBerangkat} (${x.kode}) ${rupiah(x.harga)}</option>`).join("");
  $("infoSelisih").textContent = "";
}

$("pilihJadwal").addEventListener("change", () => {
  const x = jadwalAlternatif[$("pilihJadwal").value];
  if (!x) return ($("infoSelisih").textContent = "");
  const selisih = x.harga - booking.penerbangan.harga;
  $("infoSelisih").textContent = selisih > 0
    ? `Kamu perlu menambah ${rupiah(selisih)}.`
    : selisih < 0 ? `Tarif baru lebih murah ${rupiah(-selisih)}.` : "Tarif sama, tidak ada biaya tambahan.";
});

$("formCariBooking").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnCariBooking");
  setLoading(btn, true, "Mencari...");
  $("alertKelola").innerHTML = "";
  try {
    await bukaBooking($("kodeBooking").value.trim().toUpperCase(), $("namaBelakangCari").value.trim());
  } catch (err) {
    $("areaBooking").classList.add("d-none");
    showAlert("alertKelola", "danger", err.message);
  } finally {
    setLoading(btn, false);
  }
});

//update 1: reschedule jadwal terbang
$("formJadwal").addEventListener("submit", async (e) => {
  e.preventDefault();
  const idBaru = $("pilihJadwal").value;
  const x = jadwalAlternatif[idBaru];
  if (!x) return;
  const btn = $("btnJadwal");
  setLoading(btn, true);
  try {
    const idLama = booking.flightId;
    await update(ref(db), {
      [`bookings/${kodeAktif}/flightId`]: idBaru,
      [`bookings/${kodeAktif}/penerbangan`]: {
        kode: x.kode, asal: x.asal, tujuan: x.tujuan, tanggal: x.tanggal,
        jamBerangkat: x.jamBerangkat, jamTiba: x.jamTiba, harga: x.harga
      },
      [`bookings/${kodeAktif}/totalHarga`]: x.harga + BAGASI[booking.bagasiKg],
      [`bookings/${kodeAktif}/status`]: "Jadwal diubah",
      [`bookings/${kodeAktif}/diperbaruiPada`]: serverTimestamp(),
      [`flights/${idLama}/kursiTersedia`]: increment(1),
      [`flights/${idBaru}/kursiTersedia`]: increment(-1)
    });
    showAlert("alertKelola", "success", "Jadwal penerbangan diganti.");
    await muatJadwalAlternatif({ ...booking, flightId: idBaru });
  } catch (err) {
    showAlert("alertKelola", "danger", "Gagal mengganti jadwal: " + err.message);
  } finally {
    setLoading(btn, false);
  }
});

//update 2: ubah nomor kursi yg belum dipakai penumpang lain
$("formKursi").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kursi = $("pilihKursi").value;
  if (kursi === booking.kursi) return showAlert("alertKelola", "info", "Itu sudah kursimu saat ini.");
  const btn = $("btnKursi");
  setLoading(btn, true);
  try {
    const snap = await get(query(ref(db, "bookings"), orderByChild("flightId"), equalTo(booking.flightId)));
    let terpakai = false;
    snap.forEach((c) => { if (c.key !== kodeAktif && c.val().kursi === kursi) terpakai = true; });
    if (terpakai) throw new Error(`Kursi ${kursi} sudah dipilih penumpang lain. Pilih kursi lain.`);

    await update(ref(db, `bookings/${kodeAktif}`), { kursi, diperbaruiPada: serverTimestamp() });
    showAlert("alertKelola", "success", `Kursi diubah ke ${kursi}.`);
  } catch (err) {
    showAlert("alertKelola", "danger", err.message);
  } finally {
    setLoading(btn, false);
  }
});

//update 3: tambah bagasi ekstra
$("formBagasi").addEventListener("submit", async (e) => {
  e.preventDefault();
  const kg = Number($("pilihBagasi").value);
  if (kg === booking.bagasiKg) return showAlert("alertKelola", "info", "Pilih paket bagasi yang lebih besar.");
  const btn = $("btnBagasi");
  setLoading(btn, true);
  try {
    await update(ref(db, `bookings/${kodeAktif}`), {
      bagasiKg: kg,
      totalHarga: booking.penerbangan.harga + BAGASI[kg],
      diperbaruiPada: serverTimestamp()
    });
    showAlert("alertKelola", "success", `Bagasi ditambah menjadi ${kg} kg.`);
  } catch (err) {
    showAlert("alertKelola", "danger", "Gagal menambah bagasi: " + err.message);
  } finally {
    setLoading(btn, false);
  }
});

//delete: batalkan pemesanan
$("formBatal").addEventListener("submit", async (e) => {
  e.preventDefault();
  if (booking.penerbangan.tanggal <= tanggalLokal()) {
    return showAlert("alertKelola", "warning",
      "Pemesanan ini tidak bisa dibatalkan karena penerbangannya hari ini atau sudah lewat.");
  }
  if (!confirm(`Batalkan pemesanan ${kodeAktif}?`)) return;
  const btn = $("btnBatal");
  setLoading(btn, true, "Membatalkan...");
  try {
    const updates = {
      [`bookings/${kodeAktif}`]: null,                              // hapus booking
      [`flights/${booking.flightId}/kursiTersedia`]: increment(1)    // kembalikan kursi
    };
    if (booking.memberId) updates[`members/${booking.memberId}/bookings/${kodeAktif}`] = null;
    await update(ref(db), updates);
    e.target.reset();
  } catch (err) {
    showAlert("alertKelola", "danger", "Gagal membatalkan: " + err.message);
  } finally {
    setLoading(btn, false);
  }
});

//jika dibuka dari tautan (?kode=XXXXXX)
const kodeUrl = new URLSearchParams(location.search).get("kode");
if (kodeUrl) {
  $("kodeBooking").value = kodeUrl;
  const s = getSession();
  //member yang login dan memiliki booking ini bisa langsung membukanya
  if (s) {
    get(ref(db, `members/${s.id}/bookings/${kodeUrl}`)).then((snap) => {
      if (snap.exists()) bukaBooking(kodeUrl, null).catch((err) => showAlert("alertKelola", "danger", err.message));
    });
  }
  //tamu dari halaman sukses pemesanan: pesan tetap minta nama belakang
  if (!s) $("namaBelakangCari").focus();
}
