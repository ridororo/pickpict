/**
 * PickPict - Konfigurasi & Penyimpanan Data
 * Menggunakan Google Drive API v3 resmi & Firebase Firestore Cloud Database
 */

// 1. KONFIGURASI API
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyDoqhl1cSHCPNZ5tWkXUP_Aa07l8WVptwc",
  authDomain: "pickpict.firebaseapp.com",
  projectId: "pickpict",
  storageBucket: "pickpict.firebasestorage.app",
  messagingSenderId: "1047979643617",
  appId: "1:1047979643617:web:8863b05c02770e41d4dda0",
  measurementId: "G-ZWY5YGXMDZ"
};

// Kosongkan untuk keamanan GitHub publik. Kunci asli akan dibaca serverless via process.env.GDRIVE_API_KEY di Vercel
const GDRIVE_API_KEY = "";

// Kredensial default untuk demo Admin
const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "admin123"
};

// 2. DATA SESI AWAL (Tanpa foto demo mock)
const DEFAULT_INITIAL_SESSIONS = [
  {
    id: "session-1234",
    code: "1234",
    clientName: "Sesi Photobox Nabila & Sahabat",
    gdriveUrl: "https://drive.google.com/drive/folders/1Nabila-Bestie-Photobox-Demo-2026",
    folderId: "1Nabila-Bestie-Photobox-Demo-2026",
    maxSelect: 10,
    notes: "Photobox Studio - 10 Foto Pilihan",
    createdAt: "2026-11-01 09:30",
    selectedPhotos: [],
    status: "Sedang Memilih",
    files: []
  }
];

const STORAGE_KEYS = {
  SESSIONS: "pickpict_sessions",
  ADMIN_AUTH: "pickpict_admin_auth",
  ACTIVE_CLIENT_CODE: "pickpict_active_client_code"
};

// 3. INISIALISASI FIREBASE SDK (COMPAT)
let firebaseApp = null;
let firestoreDb = null;

try {
  if (typeof firebase !== "undefined" && FIREBASE_CONFIG && FIREBASE_CONFIG.apiKey) {
    if (!firebase.apps || firebase.apps.length === 0) {
      firebaseApp = firebase.initializeApp(FIREBASE_CONFIG);
    } else {
      firebaseApp = firebase.app();
    }
    if (typeof firebase.firestore === "function") {
      firestoreDb = firebase.firestore();
    }
  }
} catch (err) {
  console.warn("Inisialisasi Firebase gagal, sistem otomatis beralih ke mode offline/LocalStorage:", err);
}

// 4. DATABASE UTILITIES (HYBRID: FIRESTORE CLOUD + LOCALSTORAGE FALLBACK)
class PickPictDatabase {
  constructor() {
    this.cachedSessions = [];
    this.firestore = firestoreDb;
    this.init();
  }

  getDb() {
    if (!this.firestore && typeof firebase !== "undefined" && typeof firebase.firestore === "function") {
      try {
        this.firestore = firebase.firestore();
      } catch (e) {}
    }
    return this.firestore;
  }

  init() {
    // 1. Baca cache dari localStorage terlebih dahulu agar instan
    const existing = localStorage.getItem(STORAGE_KEYS.SESSIONS);
    if (!existing) {
      this.cachedSessions = [...DEFAULT_INITIAL_SESSIONS];
      this.saveLocalCache(this.cachedSessions);
    } else {
      try {
        const parsed = JSON.parse(existing);
        let updated = false;
        // Bersihkan foto demo lama jika sebelumnya tersimpan
        parsed.forEach(s => {
          if (s.files && s.files.some(f => f.url && f.url.includes("unsplash.com"))) {
            s.files = [];
            updated = true;
          }
        });
        this.cachedSessions = parsed;
        if (updated) {
          this.saveLocalCache(parsed);
        }
      } catch (e) {
        this.cachedSessions = [...DEFAULT_INITIAL_SESSIONS];
        this.saveLocalCache(this.cachedSessions);
      }
    }

    // 2. Sinkronisasi latar belakang dengan Firestore jika tersedia
    const db = this.getDb();
    if (db) {
      this.syncWithFirestore().catch(err => {
        console.warn("Sinkronisasi Firestore latar belakang tertunda:", err);
      });
    }
  }

  saveLocalCache(sessions) {
    try {
      this.cachedSessions = sessions;
      localStorage.setItem(STORAGE_KEYS.SESSIONS, JSON.stringify(sessions));
    } catch (e) {
      console.error("Gagal menyimpan ke LocalStorage:", e);
    }
  }

  // Sinkronisasi data Firestore dengan local cache
  async syncWithFirestore() {
    const db = this.getDb();
    if (!db) return;

    try {
      const snapshot = await db.collection("sessions").get();
      if (snapshot.empty) {
        // Jika Firestore masih kosong, seed sesi awal
        for (const session of this.cachedSessions) {
          await db.collection("sessions").doc(session.code.toString()).set(session, { merge: true });
        }
      } else {
        const cloudSessions = [];
        snapshot.forEach(doc => {
          cloudSessions.push(doc.data());
        });
        cloudSessions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
        this.saveLocalCache(cloudSessions);
      }
    } catch (err) {
      console.warn("Gagal sinkronisasi data dari Firestore:", err);
    }
  }

  // Realtime subscription (untuk Admin Dashboard Live Update)
  subscribeSessions(callback) {
    const db = this.getDb();
    if (!db) {
      if (typeof callback === "function") callback(this.getAllSessions());
      return () => {};
    }

    try {
      return db.collection("sessions").onSnapshot(
        snapshot => {
          const sessions = [];
          snapshot.forEach(doc => sessions.push(doc.data()));
          sessions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          this.saveLocalCache(sessions);
          if (typeof callback === "function") callback(sessions);
        },
        error => {
          console.warn("Firestore snapshot listener error, menggunakan cache lokal:", error);
          if (typeof callback === "function") callback(this.getAllSessions());
        }
      );
    } catch (err) {
      console.warn("Gagal mengaktifkan onSnapshot:", err);
      if (typeof callback === "function") callback(this.getAllSessions());
      return () => {};
    }
  }

  // Mengambil semua sesi (Sinkron dari cache lokal untuk rendering cepat)
  getAllSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : this.cachedSessions;
    } catch (e) {
      return this.cachedSessions;
    }
  }

  // Mengambil semua sesi secara asinkron dari Firestore
  async getAllSessionsAsync() {
    const db = this.getDb();
    if (db) {
      try {
        const snapshot = await db.collection("sessions").get();
        if (!snapshot.empty) {
          const cloudSessions = [];
          snapshot.forEach(doc => cloudSessions.push(doc.data()));
          cloudSessions.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
          this.saveLocalCache(cloudSessions);
          return cloudSessions;
        }
      } catch (err) {
        console.warn("Firestore getAllSessionsAsync error, fallback ke local:", err);
      }
    }
    return this.getAllSessions();
  }

  // Mengambil sesi berdasarkan kode 4 digit (Asinkron: Cek Firestore + Fallback Cache)
  async getSessionByCode(code) {
    if (!code) return null;
    const cleanCode = code.toString().trim();

    // 1. Cek Firestore langsung untuk memastikan sinkron antar-perangkat (HP/Laptop)
    const db = this.getDb();
    if (db) {
      try {
        const docRef = db.collection("sessions").doc(cleanCode);
        const docSnap = await docRef.get();
        if (docSnap.exists) {
          const data = docSnap.data();
          this.updateLocalSessionCache(data);
          return data;
        }
      } catch (err) {
        console.warn("Firestore lookup error, beralih ke cache lokal:", err);
      }
    }

    // 2. Fallback: cari di cache lokal
    return this.getSessionByCodeSync(cleanCode);
  }

  // Mengambil sesi secara sinkron dari cache lokal
  getSessionByCodeSync(code) {
    if (!code) return null;
    const cleanCode = code.toString().trim();
    const sessions = this.getAllSessions();
    return sessions.find(s => s.code.toString() === cleanCode) || null;
  }

  updateLocalSessionCache(sessionData) {
    const sessions = this.getAllSessions();
    const index = sessions.findIndex(s => s.code.toString() === sessionData.code.toString());
    if (index >= 0) {
      sessions[index] = { ...sessions[index], ...sessionData };
    } else {
      sessions.unshift(sessionData);
    }
    this.saveLocalCache(sessions);
  }

  // Simpan / Buat Sesi Baru (Simpan ke Firestore Cloud + LocalStorage)
  async saveSession(newSession) {
    // 1. Simpan ke local cache terlebih dahulu untuk responsivitas instan
    this.updateLocalSessionCache(newSession);

    // 2. Simpan ke Firestore jika aktif
    const db = this.getDb();
    if (db) {
      try {
        await db
          .collection("sessions")
          .doc(newSession.code.toString())
          .set(newSession, { merge: true });
      } catch (err) {
        console.error("Gagal menyimpan sesi ke Firestore:", err);
      }
    }

    return newSession;
  }

  // Update pilihan foto klien (Simpan ke Firestore Cloud + LocalStorage)
  async updateClientSelection(code, selectedPhotos) {
    const cleanCode = code.toString().trim();
    const nowFormatted = new Date().toLocaleString("id-ID");
    const status = selectedPhotos.length > 0 ? "Pilihan Disimpan" : "Sedang Memilih";

    const updatePayload = {
      selectedPhotos: selectedPhotos,
      status: status,
      lastUpdated: nowFormatted
    };

    // 1. Update ke local cache
    const sessions = this.getAllSessions();
    const target = sessions.find(s => s.code.toString() === cleanCode);
    if (target) {
      Object.assign(target, updatePayload);
      this.saveLocalCache(sessions);
    }

    // 2. Update ke Firestore
    const db = this.getDb();
    if (db) {
      try {
        await db
          .collection("sessions")
          .doc(cleanCode)
          .set(updatePayload, { merge: true });
      } catch (err) {
        console.error("Gagal update pilihan foto ke Firestore:", err);
      }
    }

    return target || { code: cleanCode, ...updatePayload };
  }

  // Hapus Sesi (Hapus dari Firestore Cloud + LocalStorage)
  async deleteSession(code) {
    const cleanCode = code.toString().trim();

    // 1. Hapus dari local cache
    let sessions = this.getAllSessions();
    sessions = sessions.filter(s => s.code.toString() !== cleanCode);
    this.saveLocalCache(sessions);

    // 2. Hapus dari Firestore
    const db = this.getDb();
    if (db) {
      try {
        await db.collection("sessions").doc(cleanCode).delete();
      } catch (err) {
        console.error("Gagal menghapus sesi dari Firestore:", err);
      }
    }

    return true;
  }

  // Generator Kode Unik 4 Digit
  generateUniqueCode() {
    const sessions = this.getAllSessions();
    const existingCodes = new Set(sessions.map(s => s.code.toString()));
    existingCodes.add("9999"); // Reservasi kode 9999 untuk bypass admin

    let attempts = 0;
    while (attempts < 500) {
      const code = Math.floor(1000 + Math.random() * 8999).toString();
      if (!existingCodes.has(code)) {
        return code;
      }
      attempts++;
    }
    return Math.floor(2000 + Math.random() * 7000).toString();
  }
}

// 5. EKSTRAK FOLDER ID GOOGLE DRIVE
function extractGdriveFolderId(urlOrId) {
  if (!urlOrId) return "";
  const trimmed = urlOrId.trim();
  const match = trimmed.match(/[-\w]{25,}/);
  if (match) {
    return match[0];
  }
  return trimmed;
}

// 6. FETCH FILE FOTO GOOGLE DRIVE API V3
async function fetchFolderPhotos(folderId, gdriveUrl = "") {
  if (!folderId) return [];

  // 1. Coba panggil melalui Vercel Serverless Function jika tersedia
  try {
    const response = await fetch(`/api/drive-files?folderId=${encodeURIComponent(folderId)}`);
    if (response.ok) {
      const data = await response.json();
      if (data && data.success && Array.isArray(data.files) && data.files.length > 0) {
        return data.files;
      }
    }
  } catch (err) {
    // Mode offline / serverless function belum berjalan di lingkungan lokal
  }

  // 2. Panggil langsung Google Drive API v3 jika GDRIVE_API_KEY diisi
  if (GDRIVE_API_KEY) {
    try {
      const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
      const fields = encodeURIComponent('nextPageToken,files(id, name, mimeType, thumbnailLink, webContentLink, size)');

      let allRawFiles = [];
      let pageToken = null;
      let pageCount = 0;
      const maxPages = 50; // Pengaman hingga 50.000 file foto

      do {
        let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=1000&key=${GDRIVE_API_KEY}`;
        if (pageToken) {
          url += `&pageToken=${encodeURIComponent(pageToken)}`;
        }

        const response = await fetch(url);
        if (!response.ok) {
          console.warn("Google Drive API response error:", await response.text());
          break;
        }

        const data = await response.json();
        if (data.files && Array.isArray(data.files)) {
          allRawFiles.push(...data.files);
        }

        pageToken = data.nextPageToken || null;
        pageCount++;
      } while (pageToken && pageCount < maxPages);

      if (allRawFiles.length > 0) {
        // Natural sort agar urutan foto rapi dan berurutan
        allRawFiles.sort((a, b) =>
          (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })
        );

        return allRawFiles.map((file, index) => {
          const gridUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;
          const zoomUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w4000`;
          const originalDownloadUrl = GDRIVE_API_KEY
            ? `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${GDRIVE_API_KEY}`
            : `/api/download-proxy?fileId=${file.id}&name=${encodeURIComponent(file.name || `FOTO_${index + 1}.JPG`)}`;

          const sizeFormatted = file.size
            ? `${(parseInt(file.size, 10) / (1024 * 1024)).toFixed(1)} MB`
            : "Foto Asli";

          return {
            id: file.id,
            name: file.name || `FOTO_${index + 1}.JPG`,
            gridUrl: gridUrl,
            zoomUrl: zoomUrl,
            url: gridUrl,
            thumbnailUrl: gridUrl,
            downloadUrl: originalDownloadUrl,
            originalDownloadUrl: originalDownloadUrl,
            size: sizeFormatted
          };
        });
      }
    } catch (e) {
      console.error("Gagal mengambil foto dari Google Drive API:", e);
    }
  }

  return [];
}

// 7. POP-UP KANAN ATAS DINONAKTIFKAN
function showToast(message, type = "info") {
  // Pop-up di kanan atas dinonaktifkan sesuai permintaan pengguna
  const existingContainer = document.getElementById("pickpict-toast-container");
  if (existingContainer) {
    existingContainer.remove();
  }
}

// 8. AUTENTIKASI ADMIN
const AuthManager = {
  isLoggedIn() {
    return (
      sessionStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === "true" ||
      localStorage.getItem(STORAGE_KEYS.ADMIN_AUTH) === "true"
    );
  },
  login(username, password, remember = true) {
    if (
      username.trim() === ADMIN_CREDENTIALS.username &&
      password.trim() === ADMIN_CREDENTIALS.password
    ) {
      if (remember) {
        localStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, "true");
      }
      sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, "true");
      return true;
    }
    return false;
  },
  logout() {
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
};

// Inisialisasi instance database global
const db = new PickPictDatabase();
window.PickPictDB = db;
window.PickPictAuth = AuthManager;
window.PickPictToast = showToast;
