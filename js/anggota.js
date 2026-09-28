import { db, auth } from "./firebase-config.js";
import {
  ref, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword,
  updateProfile, sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderNavbar, showAlert, authSiap, pesanAuth, setLoading } from "./common.js";

renderNavbar("anggota");
const $ = (id) => document.getElementById(id);

//kalau sudah login, tidak perlu daftar/masuk lagi
authSiap.then((user) => { if (user) location.href = "akun.html"; });

//huruf pertama setiap kata di nama otomatis jadi kapital, walaupun diketik huruf kecil
const kapitalAwal = (s) => s.replace(/(^|\s)(\p{Ll})/gu, (_, spasi, huruf) => spasi + huruf.toUpperCase());
$("nama").addEventListener("input", (e) => {
  const el = e.target;
  const posisi = el.selectionStart;   //panjang teks tidak berubah, jadi posisi kursor bisa dikembalikan
  el.value = kapitalAwal(el.value);
  el.setSelectionRange(posisi, posisi);
});

//register: buat akun di Firebase Auth, lalu simpan profil di members/{uid}
$("formDaftar").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnDaftar");
  setLoading(btn, true, "Mendaftarkan...");
  try {
    const email = $("email").value.trim().toLowerCase();
    const nama = kapitalAwal($("nama").value.trim());

    //1. akun login dibuat oleh Firebase Auth (email unik dan kata sandi dicek otomatis)
    const { user } = await createUserWithEmailAndPassword(auth, email, $("password").value);

    //2. nama disimpan juga di profil Auth, supaya navbar bisa menampilkannya
    await updateProfile(user, { displayName: nama });

    //3. data profil lain disimpan di Realtime Database dengan kunci uid dari Auth
    await set(ref(db, `members/${user.uid}`), {
      nama,
      email,
      telepon: $("telepon").value.trim(),
      tanggalLahir: $("tglLahir").value,
      kewarganegaraan: $("kewarganegaraan").value,
      jenisKelamin: $("gender").value,
      nomorAnggota: "SH" + Date.now().toString().slice(-8),
      bergabungPada: serverTimestamp()
    });
    location.href = "akun.html";
  } catch (err) {
    showAlert("alertAnggota", err.code === "auth/email-already-in-use" ? "warning" : "danger",
      "Pendaftaran gagal: " + pesanAuth(err));
  } finally {
    setLoading(btn, false);
  }
});

//login: Firebase Auth yang mencocokkan email dan kata sandi
$("formMasuk").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnMasuk");
  setLoading(btn, true, "Memeriksa...");
  try {
    await signInWithEmailAndPassword(auth, $("emailMasuk").value.trim().toLowerCase(), $("passwordMasuk").value);
    location.href = "akun.html";
  } catch (err) {
    showAlert("alertAnggota", "danger", "Gagal masuk: " + pesanAuth(err));
  } finally {
    setLoading(btn, false);
  }
});

//lupa kata sandi: Firebase mengirim email berisi tautan untuk membuat kata sandi baru
$("btnLupa").addEventListener("click", async () => {
  const email = $("emailMasuk").value.trim().toLowerCase();
  if (!email) {
    $("emailMasuk").focus();
    return showAlert("alertAnggota", "info", "Isi email di form Masuk dulu, lalu klik Lupa kata sandi.");
  }
  try {
    await sendPasswordResetEmail(auth, email);
    showAlert("alertAnggota", "success",
      `Kalau <strong>${email}</strong> terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Cek juga folder spam.`);
  } catch (err) {
    showAlert("alertAnggota", "danger", "Gagal mengirim email: " + pesanAuth(err));
  }
});
