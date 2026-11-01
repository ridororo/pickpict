/**
 * PickPict - Konfigurasi & Penyimpanan Data
 * Menggunakan Google Drive API v3, Firebase Authentication, & Firestore Cloud Database
 */

// 1. KONFIGURASI API RESMI
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

// 2. DATA SESI AWAL (Untuk demo tamu & pengujian)
const DEFAULT_INITIAL_SESSIONS = [
  {
    id: "session-1234",
    accessCode: "1234",
    code: "1234",
    clientName: "Sesi Photobox Nabila & Sahabat",
    gdriveUrl: "https://drive.google.com/drive/folders/1Nabila-Bestie-Photobox-Demo-2026",
    folderId: "1Nabila-Bestie-Photobox-Demo-2026",
    maxSelection: 10,
    maxSelect: 10,
    notes: "Photobox Studio - 10 Foto Pilihan",
    createdAtFormatted: "2026-11-01 09:30",
    selectedFiles: [],
    selectedPhotos: [],
    status: "active",
    files: []
  }
];

const STORAGE_KEYS = {
  SESSIONS: "pickpict_sessions",
  ADMIN_AUTH: "pickpict_admin_auth",
  ACTIVE_CLIENT_CODE: "pickpict_active_client_code"
};

// 3. INISIALISASI FIREBASE SDK (AUTH & FIRESTORE)
let firebaseApp = null;
let firestoreDb = null;
let firebaseAuth = null;

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
    if (typeof firebase.auth === "function") {
      firebaseAuth = firebase.auth();
    }
  }
} catch (err) {
  console.warn("Inisialisasi Firebase gagal, sistem otomatis beralih ke mode offline/LocalStorage:", err);
}

// 4. DATABASE UTILITIES (MULTI-TENANCY CLOUD FIRESTORE + LOCALSTORAGE FALLBACK)
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
        this.cachedSessions = parsed;
      } catch (e) {
        this.cachedSessions = [...DEFAULT_INITIAL_SESSIONS];
        this.saveLocalCache(this.cachedSessions);
      }
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

  // Mengambil sesi lokal milik admin tertentu
  getLocalAdminSessions(adminId) {
    if (!adminId) return [];
    return this.cachedSessions.filter(s => s.adminId === adminId);
  }

  // Real-time listener sesi HANYA untuk admin yang sedang login (Multi-tenancy ketat)
  subscribeAdminSessions(adminId, callback) {
    const db = this.getDb();
    if (!db || !adminId) {
      if (typeof callback === "function") callback(this.getLocalAdminSessions(adminId));
      return () => {};
    }

    try {
      return db
        .collection("sessions")
        .where("adminId", "==", adminId)
        .onSnapshot(
          snapshot => {
            const sessions = [];
            snapshot.forEach(doc => {
              const data = doc.data();
              data.id = doc.id;
              // Map backward-compatible fields
              data.code = data.accessCode || data.code;
              data.accessCode = data.code;
              data.maxSelect = data.maxSelection ?? data.maxSelect ?? 0;
              data.maxSelection = data.maxSelect;
              data.selectedPhotos = data.selectedFiles || data.selectedPhotos || [];
              data.selectedFiles = data.selectedPhotos;
              sessions.push(data);
            });

            // Urutkan terbaru di atas
            sessions.sort((a, b) => {
              const tA = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
              const tB = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
              if (tA && tB) return tB - tA;
              return (b.createdAtFormatted || b.createdAt || "").localeCompare(a.createdAtFormatted || a.createdAt || "");
            });

            this.saveLocalCache(sessions);
            if (typeof callback === "function") callback(sessions);
          },
          error => {
            console.warn("Firestore snapshot listener error, menggunakan cache lokal:", error);
            if (typeof callback === "function") callback(this.getLocalAdminSessions(adminId));
          }
        );
    } catch (err) {
      console.warn("Gagal mengaktifkan onSnapshot admin:", err);
      if (typeof callback === "function") callback(this.getLocalAdminSessions(adminId));
      return () => {};
    }
  }

  // Mengambil sesi milik admin secara asinkron
  async getAdminSessionsAsync(adminId) {
    const db = this.getDb();
    if (db && adminId) {
      try {
        const snapshot = await db.collection("sessions").where("adminId", "==", adminId).get();
        const cloudSessions = [];
        snapshot.forEach(doc => {
          const data = doc.data();
          data.id = doc.id;
          data.code = data.accessCode || data.code;
          data.accessCode = data.code;
          data.maxSelect = data.maxSelection ?? data.maxSelect ?? 0;
          data.maxSelection = data.maxSelect;
          data.selectedPhotos = data.selectedFiles || data.selectedPhotos || [];
          data.selectedFiles = data.selectedPhotos;
          cloudSessions.push(data);
        });

        cloudSessions.sort((a, b) => {
          const tA = a.createdAt && a.createdAt.seconds ? a.createdAt.seconds : 0;
          const tB = b.createdAt && b.createdAt.seconds ? b.createdAt.seconds : 0;
          if (tA && tB) return tB - tA;
          return (b.createdAtFormatted || b.createdAt || "").localeCompare(a.createdAtFormatted || a.createdAt || "");
        });

        this.saveLocalCache(cloudSessions);
        return cloudSessions;
      } catch (err) {
        console.warn("Firestore getAdminSessionsAsync error, fallback ke local:", err);
      }
    }
    return this.getLocalAdminSessions(adminId);
  }

  // Mengambil semua sesi di cache lokal
  getAllSessions() {
    try {
      const data = localStorage.getItem(STORAGE_KEYS.SESSIONS);
      return data ? JSON.parse(data) : this.cachedSessions;
    } catch (e) {
      return this.cachedSessions;
    }
  }

  // SISI KLIEN: Cari sesi berdasarkan 4 digit accessCode (Firestore Query + Local Fallback)
  async getSessionByCode(code) {
    if (!code) return null;
    const cleanCode = code.toString().trim();

    const db = this.getDb();
    if (db) {
      try {
        // 1. Query berdasarkan accessCode
        let snapshot = await db.collection("sessions").where("accessCode", "==", cleanCode).limit(1).get();

        // 2. Jika kosong, query berdasarkan code (kompatibilitas)
        if (snapshot.empty) {
          snapshot = await db.collection("sessions").where("code", "==", cleanCode).limit(1).get();
        }

        // 3. Jika masih kosong, coba get doc langsung dengan ID = cleanCode
        if (snapshot.empty) {
          const directDoc = await db.collection("sessions").doc(cleanCode).get();
          if (directDoc.exists) {
            const data = directDoc.data();
            data.id = directDoc.id;
            data.code = data.accessCode || data.code;
            data.accessCode = data.code;
            data.maxSelect = data.maxSelection ?? data.maxSelect ?? 0;
            data.maxSelection = data.maxSelect;
            data.selectedPhotos = data.selectedFiles || data.selectedPhotos || [];
            data.selectedFiles = data.selectedPhotos;
            this.updateLocalSessionCache(data);
            return data;
          }
        } else {
          const doc = snapshot.docs[0];
          const data = doc.data();
          data.id = doc.id;
          data.code = data.accessCode || data.code;
          data.accessCode = data.code;
          data.maxSelect = data.maxSelection ?? data.maxSelect ?? 0;
          data.maxSelection = data.maxSelect;
          data.selectedPhotos = data.selectedFiles || data.selectedPhotos || [];
          data.selectedFiles = data.selectedPhotos;
          this.updateLocalSessionCache(data);
          return data;
        }
      } catch (err) {
        console.warn("Firestore lookup error, beralih ke cache lokal:", err);
      }
    }

    // Fallback: cari di cache lokal
    return this.getSessionByCodeSync(cleanCode);
  }

  getSessionByCodeSync(code) {
    if (!code) return null;
    const cleanCode = code.toString().trim();
    const sessions = this.getAllSessions();
    return sessions.find(s => (s.accessCode || s.code || "").toString() === cleanCode) || null;
  }

  updateLocalSessionCache(sessionData) {
    const sessions = this.getAllSessions();
    const code = (sessionData.accessCode || sessionData.code).toString();
    const index = sessions.findIndex(s => (s.accessCode || s.code || "").toString() === code);
    if (index >= 0) {
      sessions[index] = { ...sessions[index], ...sessionData };
    } else {
      sessions.unshift(sessionData);
    }
    this.saveLocalCache(sessions);
  }

  // Simpan / Buat Sesi Baru oleh Admin Terautentikasi
  async saveSession(newSession) {
    const cleanCode = (newSession.accessCode || newSession.code).toString().trim();
    newSession.code = cleanCode;
    newSession.accessCode = cleanCode;
    newSession.maxSelect = newSession.maxSelection ?? newSession.maxSelect ?? 0;
    newSession.maxSelection = newSession.maxSelect;
    newSession.selectedFiles = newSession.selectedFiles || newSession.selectedPhotos || [];
    newSession.selectedPhotos = newSession.selectedFiles;

    // 1. Simpan ke local cache
    this.updateLocalSessionCache(newSession);

    // 2. Simpan ke Firestore
    const db = this.getDb();
    if (db) {
      try {
        await db
          .collection("sessions")
          .doc(cleanCode)
          .set(newSession, { merge: true });
      } catch (err) {
        console.error("Gagal menyimpan sesi ke Firestore:", err);
      }
    }

    return newSession;
  }

  // SISI KLIEN: Update pilihan foto pelanggan (Hanya ubah selectedFiles & status)
  async updateClientSelection(code, selectedPhotos) {
    const cleanCode = code.toString().trim();
    const nowFormatted = new Date().toLocaleString("id-ID");
    const status = selectedPhotos.length > 0 ? "Pilihan Disimpan" : "Sedang Memilih";

    const updatePayload = {
      selectedFiles: selectedPhotos,
      selectedPhotos: selectedPhotos,
      status: status,
      lastUpdated: nowFormatted
    };

    // 1. Update ke local cache
    const sessions = this.getAllSessions();
    const target = sessions.find(s => (s.accessCode || s.code || "").toString() === cleanCode);
    if (target) {
      Object.assign(target, updatePayload);
      this.saveLocalCache(sessions);
    }

    // 2. Update ke Firestore (Hanya mengubah field pilihan tanpa menyentuh adminId)
    const db = this.getDb();
    if (db) {
      try {
        let docId = cleanCode;
        const snapshot = await db.collection("sessions").where("accessCode", "==", cleanCode).limit(1).get();
        if (!snapshot.empty) {
          docId = snapshot.docs[0].id;
        }
        await db.collection("sessions").doc(docId).set(updatePayload, { merge: true });
      } catch (err) {
        console.error("Gagal update pilihan foto ke Firestore:", err);
      }
    }

    return target || { code: cleanCode, ...updatePayload };
  }

  // Hapus Sesi oleh Admin Pemilik (Isolasi Keamanan)
  async deleteSession(code, adminId) {
    const cleanCode = code.toString().trim();

    // 1. Hapus dari local cache
    let sessions = this.getAllSessions();
    sessions = sessions.filter(s => (s.accessCode || s.code || "").toString() !== cleanCode);
    this.saveLocalCache(sessions);

    // 2. Hapus dari Firestore dengan verifikasi adminId
    const db = this.getDb();
    if (db) {
      try {
        const docRef = db.collection("sessions").doc(cleanCode);
        const doc = await docRef.get();
        if (doc.exists) {
          const data = doc.data();
          if (!adminId || data.adminId === adminId) {
            await docRef.delete();
          } else {
            console.warn("Penolakan akses: Bukan pemilik sesi ini.");
            return false;
          }
        }
      } catch (err) {
        console.error("Gagal menghapus sesi dari Firestore:", err);
      }
    }

    return true;
  }

  // Generator Kode Unik 4 Digit (Tanpa reservasi bypass backdoor 9999)
  generateUniqueCode() {
    const sessions = this.getAllSessions();
    const existingCodes = new Set(sessions.map(s => (s.accessCode || s.code || "").toString()));

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
      const maxPages = 50;

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

// 7. TOAST NOTIFIKASI
function showToast(message, type = "info") {
  const existingContainer = document.getElementById("pickpict-toast-container");
  if (existingContainer) {
    existingContainer.remove();
  }
}

// 8. SISTEM MULTI-ADMIN RESMI BERBASIS FIREBASE AUTHENTICATION
const AuthManager = {
  getAuth() {
    if (!firebaseAuth && typeof firebase !== "undefined" && typeof firebase.auth === "function") {
      try {
        firebaseAuth = firebase.auth();
      } catch (e) {}
    }
    return firebaseAuth;
  },

  getCurrentUser() {
    const auth = this.getAuth();
    return auth ? auth.currentUser : null;
  },

  async getCurrentAdminProfile() {
    const user = this.getCurrentUser();
    if (!user) return null;
    if (firestoreDb) {
      try {
        const doc = await firestoreDb.collection("admins").doc(user.uid).get();
        if (doc.exists) {
          return { uid: user.uid, email: user.email, ...doc.data() };
        }
      } catch (e) {
        console.warn("Gagal mengambil profil admin:", e);
      }
    }
    return {
      uid: user.uid,
      email: user.email,
      name: user.displayName || (user.email ? user.email.split("@")[0] : "Studio Admin")
    };
  },

  onAuthStateChanged(callback) {
    const auth = this.getAuth();
    if (auth) {
      return auth.onAuthStateChanged(callback);
    } else {
      if (typeof callback === "function") callback(null);
      return () => {};
    }
  },

  async login(email, password) {
    const auth = this.getAuth();
    if (!auth) {
      throw new Error("Layanan Firebase Authentication tidak terdeteksi.");
    }
    const cred = await auth.signInWithEmailAndPassword(email.trim(), password);
    sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, "true");
    return cred.user;
  },

  async register(name, email, password) {
    const auth = this.getAuth();
    if (!auth) {
      throw new Error("Layanan Firebase Authentication tidak terdeteksi.");
    }
    if (!name || name.trim().length === 0) {
      throw new Error("Nama Fotografer / Studio wajib diisi.");
    }
    if (!password || password.length < 6) {
      throw new Error("Password minimal harus 6 karakter.");
    }

    const cred = await auth.createUserWithEmailAndPassword(email.trim(), password);
    const user = cred.user;

    // Simpan display name di Firebase Auth profile
    try {
      await user.updateProfile({ displayName: name.trim() });
    } catch (e) {}

    // Simpan data profil ke Firestore pada koleksi admins/{uid}
    if (firestoreDb) {
      try {
        const createdAt = typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue
          ? firebase.firestore.FieldValue.serverTimestamp()
          : new Date().toISOString();

        await firestoreDb.collection("admins").doc(user.uid).set({
          uid: user.uid,
          name: name.trim(),
          email: user.email,
          createdAt: createdAt
        });
      } catch (e) {
        console.warn("Gagal menyimpan profil admin ke Firestore:", e);
      }
    }

    sessionStorage.setItem(STORAGE_KEYS.ADMIN_AUTH, "true");
    return user;
  },

  async logout() {
    const auth = this.getAuth();
    if (auth) {
      await auth.signOut();
    }
    sessionStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
    localStorage.removeItem(STORAGE_KEYS.ADMIN_AUTH);
  }
};

// Inisialisasi instance database & auth global
const db = new PickPictDatabase();
window.PickPictDB = db;
window.PickPictAuth = AuthManager;
window.PickPictToast = showToast;
