# 📸 PickPict — Client Photo Proofing & Selection Gallery

PickPict adalah platform kurasi dan pemilihan foto (*client photo proofing*) berbasis web yang dirancang khusus untuk mempermudah alur kerja fotografer dan studio foto. 

Dengan antarmuka bergaya *soft aesthetic*, PickPict memungkinkan klien menyortir dan memilih foto langsung dari smartphone atau browser tanpa perlu instalasi aplikasi, sementara fotografer dapat memantau hasil seleksi secara *real-time* dan terisolasi per-studio.

🌐 **Akses Aplikasi Langsung:** [pickpict.vercel.app](https://pickpict.vercel.app)

---

## ✨ Fitur Utama

### 1. Panel Fotografer (Studio Admin)
* **Sistem Multi-Admin Resmi:** Setiap fotografer/studio memiliki akun terautentikasi mandiri berbasis Firebase Authentication.
* **Isolasi Data Ketat (Multi-Tenancy):** Data sesi, tautan folder, dan hasil seleksi foto klien terisolasi penuh; admin hanya dapat melihat dan mengelola sesi milik studionya sendiri.
* **Integrasi Google Drive Cepat:** Pembuatan sesi kurasi cukup menggunakan tautan folder Google Drive publik tanpa perlu mengunggah ulang ratusan foto berukuran besar ke server hosting.
* **Kontrol Kuota Seleksi:** Batasi jumlah foto yang dapat dipilih oleh klien sesuai paket sesi pemotretan (misalnya: maksimal 10 foto).
* **Pemantauan Real-time:** Daftar foto yang dipilih klien langsung terbarui di *dashboard* studio saat klien menyelesaikan kurasi.

### 2. Sisi Klien (Client Experience)
* **Akses Praktis Tanpa Akun:** Klien tidak perlu mendaftar atau mengingat kata sandi; galeri dibuka cukup dengan memasukkan **4 digit kode sesi unik**.
* **Pratinjau Ringan & Cepat:** Galeri menampilkan *preview* yang dioptimalkan agar responsif, hemat kuota internet, dan lancar dibuka di perangkat seluler.
* **Kurasi Intuitif & Interaktif:** Klien dapat menandai foto favorit dengan satu ketukan, memantau sisa kuota foto, dan mengirimkan pilihan akhir secara instan.
* **Unduhan Kualitas Asli (Raw/Hi-Res):** Mendukung pengunduhan berkas foto langsung maupun paket ZIP dengan resolusi penuh langsung dari sumber penyimpanan Google Drive.

---

## 🏗️ Arsitektur & Alur Kerja Sistem

```
[ Fotografer ] 
      │ (Login / Buat Sesi via Link GDrive)
      ▼
[ Firestore Database ] ◄── Metadata Sesi & Kuota (Admin ID, Kode Akses, Folder ID)
      ▲
      │ (Akses 4 Digit Kode)
[ Klien / Pengunjung ]
      │ 
      ├─► [ Vercel Serverless API ] ──► [ Google Drive API v3 ]
      │   (Proxy Direktori & Download)  (Penyimpanan Master Foto Asli)
      │
      └─► Kirim Pilihan Foto ──► Update Real-time ke Dashboard Admin
```

---

## 🛠️ Tumpukan Teknologi (Tech Stack)

* **Antarmuka (Frontend):** HTML5, Tailwind CSS, Vanilla JavaScript (ES Modules).
* **Hosting & Backend Serverless:** [Vercel](https://vercel.com/) (Edge Serverless Functions untuk API proxy direktori dan unduhan).
* **Database & Autentikasi:** [Google Firebase](https://firebase.google.com/) (Firestore Database & Firebase Authentication).
* **Penyimpanan Berkas (Asset Storage):** Google Drive API v3.
* **Pemrosesan Arsip:** JSZip (untuk kompilasi unduhan ZIP di sisi klien).

---

## 🔒 Keamanan & Perlindungan Data

* **Server-Side API Masking:** Kredensial Google Drive API dieksekusi secara privat melalui Vercel Environment Variables (`process.env.GDRIVE_API_KEY`), mencegah kebocoran kunci akses di repositori publik maupun browser klien.
* **Firestore Security Rules:** Akses baca/tulis dokumen admin dibatasi hanya untuk pemilik UID yang valid, sementara hak akses klien dibatasi hanya untuk pembaruan array foto pilihan pada sesi terkait.
* **Bypass-Free:** Seluruh akses admin terlindungi secara kriptografis tanpa pintu belakang (*backdoor*) atau kode pintas hardcoded.