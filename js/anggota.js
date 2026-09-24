import { db } from "./firebase-config.js";
import {
  ref, get, push, set, query, orderByChild, equalTo, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import { renderNavbar, showAlert, getSession, setSession, hashPassword, setLoading } from "./common.js";

renderNavbar("anggota");
if (getSession()) location.href = "akun.html";

const $ = (id) => document.getElementById(id);

async function cariMemberByEmail(email) {
  const snap = await get(query(ref(db, "members"), orderByChild("email"), equalTo(email)));
  let hasil = null;
  snap.forEach((c) => { hasil = { id: c.key, ...c.val() }; });
  return hasil;
}

//create:pendaftaran anggota skyhop club
$("formDaftar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnDaftar");
  setLoading(btn, true, "Mendaftarkan...");
  try {
    const email = $("email").value.trim().toLowerCase();
    if (await cariMemberByEmail(email)) {
      showAlert("alertAnggota", "warning", "Email ini sudah terdaftar. Silakan masuk dengan kata sandimu.");
      return;
    }
    const baru = push(ref(db, "members"));          // id unik otomatis
    const data = {
      nama: $("nama").value.trim(),
      email,
      password: await hashPassword($("password").value),
      telepon: $("telepon").value.trim(),
      tanggalLahir: $("tglLahir").value,
      kewarganegaraan: $("kewarganegaraan").value,
      jenisKelamin: $("gender").value,
      nomorAnggota: "SH" + Date.now().toString().slice(-8),
      bergabungPada: serverTimestamp()
    };
    await set(baru, data);
    setSession({ id: baru.key, nama: data.nama });
    location.href = "akun.html";
  } catch (err) {
    showAlert("alertAnggota", "danger", "Pendaftaran gagal: " + err.message);
  } finally {
    setLoading(btn, false);
  }
});

//read: masuk akun (cocokkan email dan hash kata sandi)
$("formMasuk").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnMasuk");
  setLoading(btn, true, "Memeriksa...");
  try {
    const m = await cariMemberByEmail($("emailMasuk").value.trim().toLowerCase());
    const hash = await hashPassword($("passwordMasuk").value);
    if (!m || m.password !== hash) {
      showAlert("alertAnggota", "danger", "Email atau kata sandi salah. Periksa kembali lalu coba lagi.");
      return;
    }
    setSession({ id: m.id, nama: m.nama });
    location.href = "akun.html";
  } catch (err) {
    showAlert("alertAnggota", "danger", "Gagal masuk: " + err.message);
  } finally {
    setLoading(btn, false);
  }
});
