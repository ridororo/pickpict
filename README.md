# PickPict ✨ - Platform Galeri & Pemilihan Foto Klien Studio

**PickPict** adalah platform pemilihan foto interaktif berbasis Google Drive dan Firebase Firestore yang dirancang khusus untuk studio foto, photobox, fotografer wisuda, pre-wedding, dan portrait photography dengan tema visual **Soft Coquette / Girly Pink Aesthetic**.

---

## 🌸 Fitur Unggulan

### 1. Halaman Pelanggan (`index.html`)
- **Layar Masuk Kode 4 Digit**:
  - 4 kotak input angka otomatis berpindah (*auto-focus*), mendukung tombol hapus (*Backspace*) dan *Paste* 4 digit angka sekaligus.
  - Verifikasi kode secara asinkron langsung ke **Firebase Firestore Cloud** dengan fallback *LocalStorage*.
  - Jalur pintas rahasia: ketik `9999` langsung membuka modal Login Admin Studio.
  - Tombol demo cepat untuk kode `1234` (*Sesi Nabila & Sahabat*) dan `9999` (*Admin*).
- **Galeri Foto Interaktif**:
  - Sapaan hangat personal untuk klien (`Halo, [Nama Klien] 🌸`).
  - Badge status Google Drive dan kuota foto dinamis (`Terpilih: 3 / 10 Foto`).
  - Grid foto estetik dengan badge nama file (`IMG_8801.JPG`) dan indikator ukuran foto.
  - Tombol hati interaktif (`💖`) dengan efek seleksi border glow pink (`ring-4 ring-pink-400`).
  - **Lightbox / Zoom Fullscreen**: Menampilkan detail foto resolusi ekstra tinggi (`w4000`) lengkap dengan navigasi panah keyboard (`←` / `→`) dan tombol unduh satuan.
- **Floating Bottom Bar (Bar Melayang Bawah)**:
  - **Unduh ZIP**: Mengompres seluruh foto pilihan klien ke file `.ZIP` (`PickPict_[NamaKlien].zip`) menggunakan **JSZip** melalui endpoint serverless CORS-safe lengkap dengan progress bar persentase unduhan.
  - **Kirim ke Admin ✨**: Menyimpan daftar foto yang dipilih ke Firebase Firestore secara real-time dan membuka jendela konfirmasi WhatsApp otomatis ke admin studio.

### 2. Dashboard Admin Studio (`admin.html`)
- **Login Guard**: Menjaga keamanan dashboard, hanya dapat diakses setelah login (Kredensial Default: `admin` / `admin123`).
- **Real-Time Cloud Synchronization**:
  - Terhubung langsung ke **Firebase Firestore** dengan listener `onSnapshot`.
  - Ketika klien di HP memilih dan mengirim foto, dashboard admin di komputer otomatis memperbarui status dan jumlah foto tanpa perlu reload halaman!
- **Tambah Sesi Baru**:
  - Form input Nama Pelanggan, Link Google Drive, Batas Kuota, dan Catatan Paket.
  - Otomatis mengekstrak **Folder ID** Google Drive dengan regex `/[-\w]{25,}/`.
  - Otomatis membuat **4 Digit Kode Acak Unik**.
  - Pop-up sukses dengan angka kode besar, tombol **"Salin Kode"**, dan **"Salin Pesan WhatsApp untuk Pelanggan"**.
- **Daftar Sesi Pelanggan Aktif**:
  - Menampilkan semua sesi, status pemilihan foto klien, dan tautan Google Drive.
  - Modal **"Lihat Foto Pilihan"**:
    - Melihat daftar nama file yang dipilih klien.
    - Tombol **"Salin Nama File (Untuk Lightroom/Photoshop)"** untuk filter cepat saat proses editing.
    - Tombol simpan ke file teks (`.txt`).
  - Pencarian langsung (*live search filter*) berdasarkan nama klien, catatan, atau 4 digit kode.

---

## 🎀 Arsitektur Hybrid Cloud & Anti-Error

Aplikasi ini dirancang untuk **langsung berfungsi 100% tanpa error** baik di preview lokal maupun saat di-deploy ke produksi Vercel:

1. **Penyimpanan Data (Firebase Firestore + LocalStorage Hybrid)**:
   - Terhubung aktif ke database cloud **Firebase Firestore** project `pickpict`.
   - Menggunakan mekanisme cache ganda: data dibaca dan disimpan ke Firestore cloud sekaligus dicadangkan ke `localStorage` browser.
   - Sesi yang dibuat admin dapat langsung dibuka oleh pelanggan dari perangkat mana pun (HP / Tablet / Laptop) melalui 4 digit kode.
2. **Koneksi Google Drive API v3**:
   - Terintegrasi dengan Google Drive API v3 resmi melalui serverless function [api/drive-files.js](file:///d:/VS%20CODE/PickPict/api/drive-files.js) dan [js/config.js](file:///d:/VS%20CODE/PickPict/js/config.js).
   - Mendukung pengambilan file tanpa batas dengan `pageSize=1000` dan perulangan `nextPageToken` otomatis hingga puluhan ribu foto.
3. **CORS Safe Image Proxy**:
   - Dilengkapi fungsi serverless [api/download-proxy.js](file:///d:/VS%20CODE/PickPict/api/download-proxy.js) untuk download file ukuran asli 100% (`alt=media`) bebas CORS di browser, dengan fallback resolusi tinggi jika API key dibatasi.

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
   - Name: `GDRIVE_API_KEY`
   - Value: *[Masukkan Google Drive API Key v3 Anda]* (Diperlukan agar serverless function dapat membaca isi folder Google Drive publik klien).
5. Klik **"Deploy"**. Vercel akan otomatis mengenali serverless functions di folder `/api` dan menyajikan halaman statis `index.html` dan `admin.html`.
