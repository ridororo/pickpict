# PickPict ✨ - Platform Galeri & Pemilihan Foto Klien Studio

**PickPict** adalah platform pemilihan foto interaktif berbasis Google Drive, Firebase Authentication, dan Firestore Cloud Database yang dirancang khusus untuk fotografer profesional, photobox, studio foto, wisuda, pre-wedding, dan portrait photography dengan tema visual **Soft Coquette / Girly Pink Aesthetic**.

---

## 🌸 Fitur Unggulan

### 1. Halaman Pelanggan (`index.html`)
- **Layar Masuk Kode 4 Digit**:
  - 4 kotak input angka otomatis berpindah (*auto-focus*), mendukung tombol hapus (*Backspace*) dan *Paste* 4 digit angka sekaligus.
  - Verifikasi kode instan secara asinkron ke **Firebase Firestore Cloud** berdasarkan `accessCode`.
  - **Bebas Akses Backdoor**: Tidak ada PIN statis bypass `9999`. Seluruh akses klien divalidasi ke database sesi.
  - Tombol contoh cepat untuk sesi demo `1234` (*Sesi Nabila & Sahabat*).
- **Galeri Foto Interaktif**:
  - Sapaan personal untuk klien (`Halo, [Nama Klien] 🌸`).
  - Badge kuota foto dinamis (`Terpilih: 3 / 10 Foto`).
  - Grid foto estetik dengan badge nama file (`IMG_8801.JPG`) dan indikator ukuran file.
  - Tombol hati interaktif (`💖`) dengan efek seleksi border glow pink (`ring-4 ring-pink-400`).
  - **Lightbox / Zoom Fullscreen**: Menampilkan detail foto resolusi ekstra tinggi (`w4000`) lengkap dengan navigasi panah keyboard (`←` / `→`) dan tombol unduh satuan.
- **Floating Bottom Bar (Bar Melayang Bawah)**:
  - **Unduh ZIP**: Mengompres seluruh foto pilihan klien ke file `.ZIP` (`PickPict_[NamaKlien].zip`) menggunakan **JSZip** melalui endpoint serverless CORS-safe lengkap dengan progress bar persentase unduhan.
  - **Kirim ke Admin ✨**: Menyimpan daftar foto yang dipilih ke database cloud secara real-time dan membuka konfirmasi WhatsApp otomatis ke admin studio.

### 2. Dashboard Multi-Admin Resmi (`admin.html`)
- **Firebase Authentication Multi-Tenancy**:
  - **Login**: Masuk dengan Email & Password terdaftar.
  - **Register**: Pendaftaran mandiri untuk fotografer/studio baru (Nama Studio, Email, dan Password minimal 6 karakter). Data profil otomatis tersimpan di Firestore koleksi `admins/{uid}`.
  - **Logout**: Membersihkan sesi dan mengembalikan ke layar login secara aman.
- **Isolasi Data Klien per-Admin (Strict Multi-Tenancy)**:
  - Setiap admin/fotografer HANYA dapat melihat, mengelola, dan menghapus sesi foto miliknya sendiri melalui filter query:
    `where("adminId", "==", auth.currentUser.uid)`.
  - Didukung listener real-time `onSnapshot` terisolasi: ketika klien memilih foto, dashboard admin terkait langsung terupdate otomatis tanpa mengekspos data ke fotografer lain.
- **Tambah Sesi Baru**:
  - Form input Nama Pelanggan, Link Google Drive, Batas Kuota, dan Catatan Paket.
  - Otomatis mengekstrak **Folder ID** Google Drive dengan regex `/[-\w]{25,}/`.
  - Otomatis membuat **4 Digit Kode Acak Unik** (`accessCode`).
  - Pop-up sukses dengan angka kode besar, tombol **"Salin Kode"**, dan **"Salin Pesan WhatsApp untuk Pelanggan"**.
- **Daftar Sesi Pelanggan Aktif**:
  - Menampilkan sesi privat milik admin yang sedang login beserta status pemilihan foto.
  - Modal **"Lihat Foto Pilihan"**:
    - Melihat daftar nama file yang dipilih klien.
    - Tombol **"Salin Nama File (Untuk Lightroom/Photoshop)"** untuk filter cepat saat proses editing.
    - Tombol simpan ke file teks (`.txt`).
  - Pencarian langsung (*live search filter*) berdasarkan nama klien, catatan, atau 4 digit kode.

---

## 🎀 Arsitektur Multi-Admin & Keamanan

Aplikasi ini dirancang dengan standar keamanan tinggi untuk lingkungan publik dan produksi:

1. **Autentikasi Multi-Admin**:
   - Dikelola langsung oleh **Firebase Authentication**.
   - Password di-hash dan diverifikasi secara aman di server Google Firebase.
2. **Isolasi Dokumen Sesi**:
   - Seluruh sesi baru dicatat dengan metadata kepemilikan:
     `{ adminId: auth.currentUser.uid, adminEmail: auth.currentUser.email, accessCode, ... }`.
   - Admin hanya dapat membaca dan menghapus dokumen sesi yang memiliki `adminId` miliknya.
3. **Alur Klien Tanpa Hambatan**:
   - Klien tidak perlu membuat akun atau login. Klien cukup memasukkan 4 digit `accessCode`.
   - Update pilihan klien hanya memodifikasi field `selectedFiles`, `status`, dan `lastUpdated` tanpa mengubah kepemilikan admin.
4. **Koneksi Google Drive API v3 & CORS Safe Proxy**:
   - Serverless functions di folder `/api` membaca `process.env.GDRIVE_API_KEY` di server Vercel, menjaga kerahasiaan kunci dari browser.
   - File `.gitignore` memastikan file lokal `.env`, `.env.local`, `.vercel`, dan `node_modules` tidak terunggah ke repositori publik.

---

## 🚀 Cara Menjalankan Secara Lokal

```bash
# Pasang dependensi lokal
npm install

# Jalankan server lokal
npm run dev

# Buka browser di http://localhost:3000
```

---

## ☁️ Cara Deploy ke Vercel (Produksi)

1. Push atau upload seluruh kode repositori ini ke **GitHub** / **GitLab**.
2. Buka dashboard [Vercel](https://vercel.com) dan pilih **"Add New Project"**.
3. Import repositori **PickPict**.
4. Tambahkan **Environment Variable** di Vercel:
   - **Key**: `GDRIVE_API_KEY`
   - **Value**: *[Masukkan Google Drive API Key v3 Anda]* (Diperlukan agar serverless function dapat membaca isi folder Google Drive publik klien).
5. Klik **"Deploy"**. Vercel akan otomatis mengenali serverless functions di folder `/api` dan menyajikan halaman statis `index.html` dan `admin.html`.
