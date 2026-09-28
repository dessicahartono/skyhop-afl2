import { db, auth } from "./firebase-config.js";
import {
  ref, get, set, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";
import {
  createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut,
  updateProfile, sendPasswordResetEmail, signInWithPopup, GoogleAuthProvider,
  sendEmailVerification, checkActionCode, applyActionCode,
  verifyPasswordResetCode, confirmPasswordReset
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { renderNavbar, showAlert, authSiap, pesanAuth, setLoading } from "./common.js";

renderNavbar("anggota");
const $ = (id) => document.getElementById(id);

//link dari email Firebase (verifikasi email / reset kata sandi) dibuka di halaman ini
//dengan parameter ?mode=...&oobCode=...
const params = new URLSearchParams(location.search);
const mode = params.get("mode");
const oobCode = params.get("oobCode");

//kalau sudah login, tidak perlu daftar/masuk lagi
authSiap.then((user) => { if (user && !mode) location.href = "akun.html"; });

//setelah verifikasi, email boleh dipakai login: isi form Masuk lalu arahkan kursor ke kata sandi
function arahkanKeLogin(email) {
  if (email) $("emailMasuk").value = email;
  $("passwordMasuk").focus();
}

//link di email (verifikasi / reset kata sandi) dikirim dengan alamat kembali ke halaman ini.
//handleCodeInApp: link di email diteruskan langsung ke halaman ini (bukan ke halaman bawaan Firebase),
//lalu diproses sendiri oleh verifikasiEmail() atau tampilkanFormReset() di bawah
const linkKembali = (jenis = "verifikasi") => ({
  url: `${location.origin}${location.pathname}?${jenis}=selesai`,
  handleCodeInApp: true
});

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
    //(ditulis sekarang, selagi masih login, karena rules members butuh auth.uid)
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

    //4. kirim link verifikasi ke email, lalu keluarkan lagi: akun baru boleh login setelah email diverifikasi
    await sendEmailVerification(user, linkKembali());
    await signOut(auth);
    e.target.reset();
    $("emailMasuk").value = email;
    showAlert("alertAnggota", "success",
      `Akun berhasil dibuat. Link verifikasi sudah dikirim ke <strong>${email}</strong>.
      Buka email tersebut dan klik linknya, lalu masuk di form sebelah kanan. Cek juga folder spam.`);
  } catch (err) {
    showAlert("alertAnggota", err.code === "auth/email-already-in-use" ? "warning" : "danger",
      "Pendaftaran gagal: " + pesanAuth(err));
  } finally {
    setLoading(btn, false);
  }
});

//daftar / masuk dengan Google: satu tombol untuk keduanya.
//Kalau akun Google ini baru pertama kali masuk, profil di members/{uid} dibuat dulu
//dengan data yang ada dari Google, lalu sisanya dilengkapi di halaman akun.
document.querySelectorAll("[data-google]").forEach((btn) => btn.addEventListener("click", async () => {
  setLoading(btn, true, "Menunggu Google...");
  try {
    const { user } = await signInWithPopup(auth, new GoogleAuthProvider());
    const memberRef = ref(db, `members/${user.uid}`);
    if ((await get(memberRef)).exists()) {
      location.href = "akun.html";
      return;
    }
    const nama = kapitalAwal((user.displayName || user.email.split("@")[0]).trim());
    await set(memberRef, {
      nama,
      email: user.email.toLowerCase(),
      telepon: "",
      tanggalLahir: "",
      kewarganegaraan: "Indonesia",
      jenisKelamin: "",
      nomorAnggota: "SH" + Date.now().toString().slice(-8),
      bergabungPada: serverTimestamp()
    });
    location.href = "akun.html";   // halaman akun akan meminta profil dilengkapi
  } catch (err) {
    //popup ditutup sendiri oleh pengguna, tidak perlu pesan error
    if (!["auth/popup-closed-by-user", "auth/cancelled-popup-request"].includes(err.code)) {
      showAlert("alertAnggota", "danger", "Gagal masuk dengan Google: " + pesanAuth(err));
    }
    setLoading(btn, false);
  }
}));

//login: Firebase Auth yang mencocokkan email dan kata sandi
$("formMasuk").addEventListener("submit", async (e) => {
  e.preventDefault();
  const btn = $("btnMasuk");
  setLoading(btn, true, "Memeriksa...");
  const email = $("emailMasuk").value.trim().toLowerCase();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, $("passwordMasuk").value);

    //email belum diverifikasi: login ditolak, pengguna langsung dikeluarkan lagi
    if (!user.emailVerified) {
      await signOut(auth);
      showAlert("alertAnggota", "warning",
        `Email <strong>${email}</strong> belum diverifikasi. Klik link verifikasi di emailmu dulu, lalu masuk lagi.
        <br><button type="button" class="btn btn-sm btn-ink mt-2" id="btnKirimUlang">Kirim ulang link verifikasi</button>`);
      $("btnKirimUlang").addEventListener("click", kirimUlangVerifikasi);
      return;
    }
    location.href = "akun.html";
  } catch (err) {
    //akun tidak ditemukan dan kata sandi salah diberi pesan yang berbeda
    const jenis = err.code === "auth/user-not-found" ? "warning" : "danger";
    showAlert("alertAnggota", jenis, "Gagal masuk: " + pesanAuth(err));
  } finally {
    setLoading(btn, false);
  }
});

//kirim ulang link verifikasi: Firebase hanya bisa mengirimnya untuk pengguna yang sedang login,
//jadi masuk sebentar dengan email dan kata sandi di form, kirim, lalu keluar lagi
async function kirimUlangVerifikasi(e) {
  const btn = e.target;
  setLoading(btn, true, "Mengirim...");
  const email = $("emailMasuk").value.trim().toLowerCase();
  try {
    const { user } = await signInWithEmailAndPassword(auth, email, $("passwordMasuk").value);
    await sendEmailVerification(user, linkKembali());
    await signOut(auth);
    showAlert("alertAnggota", "success",
      `Link verifikasi baru sudah dikirim ke <strong>${email}</strong>. Link lama tidak berlaku lagi.`);
  } catch (err) {
    await signOut(auth);
    showAlert("alertAnggota", "danger", "Gagal mengirim ulang link: " + pesanAuth(err));
  }
}

//lupa kata sandi: Firebase mengirim email berisi tautan untuk membuat kata sandi baru
$("btnLupa").addEventListener("click", async () => {
  const email = $("emailMasuk").value.trim().toLowerCase();
  if (!email) {
    $("emailMasuk").focus();
    return showAlert("alertAnggota", "info", "Isi email di form Masuk dulu, lalu klik Lupa kata sandi.");
  }
  try {
    await sendPasswordResetEmail(auth, email, linkKembali("reset"));
    showAlert("alertAnggota", "success",
      `Kalau <strong>${email}</strong> terdaftar, tautan untuk membuat kata sandi baru sudah dikirim. Cek juga folder spam.`);
  } catch (err) {
    showAlert("alertAnggota", "danger", "Gagal mengirim email: " + pesanAuth(err));
  }
});

//halaman ini juga menjadi penangan link dari email Firebase.
//Kode (mode + oobCode) dicek lebih dulu, karena dengan handleCodeInApp
//Firebase menambahkannya ke alamat ?verifikasi=selesai
if (mode && oobCode) {
  history.replaceState(null, "", location.pathname);   // kode di URL hanya berlaku sekali, jadi dibuang dari address bar
  if (mode === "verifyEmail") verifikasiEmail(oobCode);
  else if (mode === "resetPassword") tampilkanFormReset(oobCode);
  else showAlert("alertAnggota", "info", "Link ini tidak dikenali. Silakan masuk seperti biasa.");
} else if (params.get("verifikasi") === "selesai") {
  //kembali dari halaman verifikasi bawaan Firebase (tombol Continue)
  history.replaceState(null, "", location.pathname);
  showAlert("alertAnggota", "success", "Email berhasil diverifikasi. Silakan masuk.");
  arahkanKeLogin();
} else if (params.get("reset") === "selesai") {
  //kembali dari halaman reset kata sandi bawaan Firebase (tombol Continue)
  history.replaceState(null, "", location.pathname);
  showAlert("alertAnggota", "success", "Kata sandi berhasil diubah. Silakan masuk dengan kata sandi baru.");
  arahkanKeLogin();
}

//verifikasi email: cek kodenya dulu untuk tahu emailnya, lalu tandai email sebagai terverifikasi
async function verifikasiEmail(kode) {
  try {
    const info = await checkActionCode(auth, kode);
    await applyActionCode(auth, kode);
    showAlert("alertAnggota", "success",
      `Email <strong>${info.data.email}</strong> berhasil diverifikasi. Silakan masuk dengan kata sandimu.`);
    arahkanKeLogin(info.data.email);
  } catch (err) {
    //link yang sama diklik dua kali: kemungkinan emailnya sudah terverifikasi di klik pertama
    if (err.code === "auth/invalid-action-code") {
      showAlert("alertAnggota", "warning", "Link verifikasi ini sudah pernah dipakai. Kalau emailmu sudah terverifikasi, " +
        "silakan langsung masuk. Kalau belum, masuk lalu klik Kirim ulang link verifikasi.");
      arahkanKeLogin();
      return;
    }
    showAlert("alertAnggota", "danger", "Verifikasi gagal: " + pesanAuth(err));
  }
}

//reset kata sandi: link dari "Lupa kata sandi" juga diarahkan ke halaman ini
async function tampilkanFormReset(kode) {
  try {
    const email = await verifyPasswordResetCode(auth, kode);
    $("emailReset").textContent = email;
    $("panelReset").classList.remove("d-none");
    $("passwordBaru").focus();

    $("formReset").addEventListener("submit", async (e) => {
      e.preventDefault();
      const btn = $("btnReset");
      setLoading(btn, true, "Menyimpan...");
      try {
        await confirmPasswordReset(auth, kode, $("passwordBaru").value);
        $("panelReset").classList.add("d-none");
        showAlert("alertAnggota", "success", "Kata sandi baru tersimpan. Silakan masuk.");
        arahkanKeLogin(email);
      } catch (err) {
        showAlert("alertAnggota", "danger", "Gagal menyimpan kata sandi: " + pesanAuth(err));
        setLoading(btn, false);
      }
    });
  } catch (err) {
    showAlert("alertAnggota", "danger", "Link reset kata sandi tidak bisa dipakai: " + pesanAuth(err));
  }
}
