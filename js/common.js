// Utilitas yang dipakai di semua halaman
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

//sesi login disimpan di browser
const KEY = "skyhopSession";
export const getSession = () => {
  try { return JSON.parse(localStorage.getItem(KEY)); } catch { return null; }
};
export const setSession = (s) => localStorage.setItem(KEY, JSON.stringify(s));
export const clearSession = () => localStorage.removeItem(KEY);

//password di-hash SHA-256
export async function hashPassword(pw) {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(pw));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

//komponen UI
export function renderNavbar(aktif) {
  const s = getSession();
  const link = (href, id, label) =>
    `<li class="nav-item"><a class="nav-link ${aktif === id ? "active" : ""}" href="${href}">${label}</a></li>`;
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
  document.getElementById("btnKeluar")?.addEventListener("click", () => {
    clearSession();
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

export function isiKursi(select, terpilih = "") {
  let html = "";
  for (let r = 1; r <= 30; r++) {
    for (const c of "ABCDEF") {
      const k = `${r}${c}`;
      html += `<option value="${k}" ${k === terpilih ? "selected" : ""}>${k}${"AF".includes(c) ? " (jendela)" : "CD".includes(c) ? " (lorong)" : ""}</option>`;
    }
  }
  select.innerHTML = html;
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
