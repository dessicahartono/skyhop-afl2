import { db } from "./firebase-config.js";
import {
  ref, get, update, query, orderByChild, equalTo, increment, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  BANDARA, BAGASI, rupiah, tanggalLokal, formatTanggal, getSession,
  renderNavbar, showAlert, isiBandara, isiKursi, isiBagasi, setLoading
} from "./common.js";

renderNavbar("beranda");

const $ = (id) => document.getElementById(id);
isiBandara($("asal"), "Pilih kota asal");
isiBandara($("tujuan"), "Pilih kota tujuan");
$("tanggal").min = tanggalLokal();
$("tanggal").value = tanggalLokal();
$("asal").value = "CGK";
$("tujuan").value = "SIN";


const RUTE = [
  // asal, tujuan, kode, harga dasar, berangkat, waktu tiba
  ["MDC", "SIN", "SH 275", 960000, "15:15", "18:55"],
  ["SIN", "MDC", "SH 274", 955000, "02:15", "06:45"],
  ["CGK", "SIN", "SH 277", 850000, "08:15", "11:05"],
  ["CGK", "SIN", "SH 279", 790000, "17:40", "20:30"],
  ["SIN", "CGK", "SH 276", 780000, "12:30", "13:20"],
  ["DPS", "SIN", "SH 285", 920000, "09:40", "12:20"],
  ["SIN", "DPS", "SH 284", 880000, "06:10", "08:50"],
  ["SIN", "BKK", "SH 612", 650000, "07:25", "08:50"],
  ["BKK", "SIN", "SH 613", 670000, "10:05", "13:20"],
  ["KUL", "SIN", "SH 451", 420000, "14:00", "15:05"],
  ["SIN", "KUL", "SH 450", 410000, "11:10", "12:15"],
  ["CGK", "KUL", "SH 431", 690000, "13:15", "16:20"]
];

//seeding data jadwal penerbangan ke database jika belum ada
async function seedJadwal() {
  const snap = await get(ref(db, "flights"));
  const sudahAda = snap.exists() ? snap.val() : {};
  const updates = {};

  for (let d = 0; d < 30; d++) {
    const tgl = new Date();
    tgl.setDate(tgl.getDate() + d);
    const iso = tanggalLokal(tgl);
    for (const [asal, tujuan, kode, harga, jb, jt] of RUTE) {
      const id = `${kode.replace(" ", "")}_${iso}`;
      if (sudahAda[id]) continue;          // lewati jika sudah tersimpan
      updates[`flights/${id}`] = {
        kode, asal, tujuan, rute: `${asal}-${tujuan}`, tanggal: iso,
        jamBerangkat: jb, jamTiba: jt,
        harga: harga + (d % 5) * 35000,
        kursiTersedia: 180
      };
    }
  }

  const jumlah = Object.keys(updates).length;
  if (jumlah) {
    await update(ref(db), updates);
    $("infoSeed").textContent = `${jumlah} jadwal baru ditambahkan ke database.`;
  }
}
let hasil = {};

async function cariPenerbangan(e) {
  e?.preventDefault();
  const asal = $("asal").value, tujuan = $("tujuan").value, tanggal = $("tanggal").value;
  $("alertCari").innerHTML = "";
  if (asal === tujuan) return showAlert("alertCari", "warning", "Kota asal dan tujuan tidak boleh sama.");

  setLoading($("btnCari"), true, "Mencari...");
  try {
    const snap = await get(query(ref(db, "flights"), orderByChild("rute"), equalTo(`${asal}-${tujuan}`)));
    hasil = {};
    snap.forEach((c) => {
      const f = c.val();
      if (f.tanggal === tanggal) hasil[c.key] = f;
    });
    tampilkanHasil(asal, tujuan, tanggal);
  } catch (err) {
    showAlert("alertCari", "danger", "Gagal membaca data: " + err.message);
  } finally {
    setLoading($("btnCari"), false);
  }
}

function tampilkanHasil(asal, tujuan, tanggal) {
  const daftar = Object.entries(hasil)
    .sort(([, a], [, b]) => (a.tanggal + a.jamBerangkat).localeCompare(b.tanggal + b.jamBerangkat))
    .slice(0, 8);

  if (!daftar.length) {
    $("hasilCari").innerHTML = `<div class="panel kosong">Belum ada penerbangan ${BANDARA[asal]} ke ${BANDARA[tujuan]}
      mulai ${formatTanggal(tanggal)}. Coba rute lain, misalnya Jakarta ke Singapura.</div>`;
    return;
  }

  $("hasilCari").innerHTML = `<h2 class="h4 mb-0">${BANDARA[asal]} ke ${BANDARA[tujuan]}</h2>` +
    daftar.map(([id, f]) => `
      <article class="hasil-penerbangan">
        <div class="row align-items-center g-3">
          <div class="col-md-2 small"><strong>${formatTanggal(f.tanggal)}</strong><br>${f.kode}</div>
          <div class="col-md-5 d-flex align-items-center">
            <div><div class="jam">${f.jamBerangkat}</div><div class="small">${f.asal}</div></div>
            <span class="garis-rute"></span>
            <div class="text-end"><div class="jam">${f.jamTiba}</div><div class="small">${f.tujuan}</div></div>
          </div>
          <div class="col-md-2 small">${f.kursiTersedia} kursi tersisa</div>
          <div class="col-md-3 d-flex justify-content-md-end align-items-center gap-3">
            <span class="harga">${rupiah(f.harga)}</span>
            <button class="btn btn-ink" data-pesan="${id}" ${f.kursiTersedia < 1 ? "disabled" : ""}>Pilih</button>
          </div>
        </div>
      </article>`).join("");
}

//create: pesan tiket baru lalu simpan ke bookings
const modal = new bootstrap.Modal($("modalPesan"));
const formHTML = $("bodyPesan").innerHTML;
let flightDipilih = null;

document.addEventListener("click", async (e) => {
  const id = e.target.dataset?.pesan;
  if (!id) return;
  flightDipilih = { id, ...hasil[id] };
  $("bodyPesan").innerHTML = formHTML;
  siapkanFormPesan();
  modal.show();
});

async function siapkanFormPesan() {
  const f = flightDipilih;
  $("ringkasanFlight").innerHTML = `<strong>${f.kode}</strong> ${BANDARA[f.asal]} ke ${BANDARA[f.tujuan]}<br>
    ${formatTanggal(f.tanggal)}, ${f.jamBerangkat} sampai ${f.jamTiba}`;
  isiKursi($("kursiP"), "12A");
  isiBagasi($("bagasiP"));
  const hitung = () => ($("totalP").textContent = rupiah(f.harga + BAGASI[$("bagasiP").value]));
  $("bagasiP").addEventListener("change", hitung);
  hitung();

  //read: jika anggota SkyHop Club yang login lansgung isi otomatis dari profilnya
  const s = getSession();
  if (s) {
    const m = (await get(ref(db, `members/${s.id}`))).val();
    if (m) {
      const [depan, ...belakang] = m.nama.split(" ");
      $("namaDepan").value = depan;
      $("namaBelakang").value = belakang.join(" ") || depan;
      $("emailP").value = m.email;
      $("teleponP").value = m.telepon;
    }
  }
  $("formPesan").addEventListener("submit", simpanPesanan);
}

function buatKode() {
  const huruf = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  return Array.from({ length: 6 }, () => huruf[Math.floor(Math.random() * huruf.length)]).join("");
}

async function simpanPesanan(e) {
  e.preventDefault();
  const btn = $("btnPesan");
  setLoading(btn, true, "Menyimpan...");
  try {
    const f = flightDipilih;
    let kode = buatKode();
    while ((await get(ref(db, `bookings/${kode}`))).exists()) kode = buatKode();

    const s = getSession();
    const bagasiKg = Number($("bagasiP").value);
    const booking = {
      kodeBooking: kode,
      flightId: f.id,
      penerbangan: {
        kode: f.kode, asal: f.asal, tujuan: f.tujuan, tanggal: f.tanggal,
        jamBerangkat: f.jamBerangkat, jamTiba: f.jamTiba, harga: f.harga
      },
      penumpang: {
        namaDepan: $("namaDepan").value.trim(),
        namaBelakang: $("namaBelakang").value.trim(),
        email: $("emailP").value.trim().toLowerCase(),
        telepon: $("teleponP").value.trim(),
        noPaspor: $("paspor").value.trim().toUpperCase()
      },
      kursi: $("kursiP").value,
      bagasiKg,
      totalHarga: f.harga + BAGASI[bagasiKg],
      status: "Terkonfirmasi",
      memberId: s?.id || "",
      dibuatPada: serverTimestamp()
    };

    //multipath update: simpan booking + kurangi kursi + tautkan ke akun
    const updates = {
      [`bookings/${kode}`]: booking,
      [`flights/${f.id}/kursiTersedia`]: increment(-1)
    };
    if (s) updates[`members/${s.id}/bookings/${kode}`] = true;
    await update(ref(db), updates);

    $("bodyPesan").innerHTML = `
      <div class="tiket">
        <div class="tiket-atas">
          <div class="small fw-bold">Kode booking</div>
          <div class="tiket-kode">${kode}</div>
        </div>
        <div class="tiket-isi">
          <p class="mb-2">Pemesanan tersimpan. Simpan kode ini untuk membuka <strong>Kelola pemesanan</strong>
          bersama nama belakang <strong>${booking.penumpang.namaBelakang}</strong>.</p>
          <a class="btn btn-kuning" href="kelola.html?kode=${kode}">Buka kelola pemesanan</a>
        </div>
      </div>`;
    cariPenerbangan();
  } catch (err) {
    showAlert("alertPesan", "danger", "Gagal menyimpan pemesanan: " + err.message);
    setLoading(btn, false);
  }
}

$("formCari").addEventListener("submit", cariPenerbangan);
seedJadwal()
  .then(() => cariPenerbangan())
  .catch((err) => showAlert("alertCari", "danger",
    "Tidak bisa terhubung ke Firebase. Periksa js/firebase-config.js dan rules database. (" + err.message + ")"));