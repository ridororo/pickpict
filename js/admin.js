/**
 * PickPict - Logika Dashboard Admin (Multi-Admin Firebase Auth & Firestore)
 * Mengatur autentikasi multi-admin, pembuatan sesi berbasis adminId,
 * query real-time terisolasi (onSnapshot where adminId), dan manajemen sesi klien.
 */

// State Global Dashboard Admin
let activeModalSession = null;
let currentViewingSelectionSession = null;
let adminSessionsUnsubscribe = null;
let currentAdminUser = null;
let currentAdminProfile = null;

document.addEventListener("DOMContentLoaded", () => {
  setupAuthListener();
});

// ==========================================
// 1. SETUP FIREBASE AUTH LISTENER
// ==========================================
function setupAuthListener() {
  window.PickPictAuth.onAuthStateChanged(async (user) => {
    currentAdminUser = user;
    const loginScreen = document.getElementById("adminLoginScreen");
    const dashboardScreen = document.getElementById("adminDashboardScreen");

    if (user) {
      // Ambil profil admin dari Firestore
      currentAdminProfile = await window.PickPictAuth.getCurrentAdminProfile();
      updateAdminHeader(currentAdminProfile);

      loginScreen.classList.add("hidden");
      dashboardScreen.classList.remove("hidden");

      // Mulai sinkronisasi realtime terisolasi per-admin
      setupRealtimeAdminSessions(user.uid);
      loadDashboardData();
    } else {
      currentAdminProfile = null;
      if (adminSessionsUnsubscribe) {
        adminSessionsUnsubscribe();
        adminSessionsUnsubscribe = null;
      }
      loginScreen.classList.remove("hidden");
      dashboardScreen.classList.add("hidden");
    }
  });
}

function updateAdminHeader(profile) {
  const nameEl = document.getElementById("adminStudioNameDisplay");
  const emailEl = document.getElementById("adminEmailDisplay");

  if (profile) {
    if (nameEl) nameEl.textContent = profile.name || "Studio Admin";
    if (emailEl) emailEl.textContent = profile.email || "";
  }
}

// ==========================================
// 2. TOGGLE TAB AUTH & HANDLER LOGIN / REGISTER
// ==========================================
function switchAuthTab(tab) {
  hideAuthError();
  const tabLoginBtn = document.getElementById("tabLoginBtn");
  const tabRegisterBtn = document.getElementById("tabRegisterBtn");
  const loginForm = document.getElementById("authLoginForm");
  const registerForm = document.getElementById("authRegisterForm");

  if (tab === "login") {
    tabLoginBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white text-rosewood shadow-xs";
    tabRegisterBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-mauve hover:text-rosewood";
    loginForm.classList.remove("hidden");
    registerForm.classList.add("hidden");
  } else {
    tabRegisterBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all bg-white text-rosewood shadow-xs";
    tabLoginBtn.className = "flex-1 py-2 px-3 rounded-xl text-xs sm:text-sm font-bold transition-all text-mauve hover:text-rosewood";
    registerForm.classList.remove("hidden");
    loginForm.classList.add("hidden");
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function showAuthError(msg) {
  const box = document.getElementById("authErrorMessageBox");
  const text = document.getElementById("authErrorText");
  if (box && text) {
    text.textContent = msg;
    box.classList.remove("hidden");
  }
}

function hideAuthError() {
  const box = document.getElementById("authErrorMessageBox");
  if (box) box.classList.add("hidden");
}

async function handleAdminLogin() {
  hideAuthError();
  const emailInput = document.getElementById("loginEmail");
  const passInput = document.getElementById("loginPassword");
  const submitBtn = document.getElementById("btnLoginSubmit");

  const email = emailInput.value.trim();
  const pass = passInput.value;

  if (!email || !pass) {
    showAuthError("Email dan password wajib diisi.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  try {
    await window.PickPictAuth.login(email, pass);
    showToast("Login berhasil! Membuka Dashboard Studio...", "success");

    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#EC4899', '#F43F5E', '#FED2E2']
      });
    }
  } catch (err) {
    console.error("Login error:", err);
    let msg = "Email atau password salah. Silakan coba lagi.";
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      msg = "Akun tidak ditemukan atau password salah.";
    } else if (err.code === "auth/invalid-email") {
      msg = "Format alamat email tidak valid.";
    } else if (err.code === "auth/too-many-requests") {
      msg = "Terlalu banyak percobaan gagal. Silakan tunggu beberapa saat.";
    }
    showAuthError(msg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75");
    }
  }
}

async function handleAdminRegister() {
  hideAuthError();
  const nameInput = document.getElementById("registerName");
  const emailInput = document.getElementById("registerEmail");
  const passInput = document.getElementById("registerPassword");
  const submitBtn = document.getElementById("btnRegisterSubmit");

  const name = nameInput.value.trim();
  const email = emailInput.value.trim();
  const pass = passInput.value;

  if (!name || !email || !pass) {
    showAuthError("Semua field pendaftaran wajib diisi.");
    return;
  }

  if (pass.length < 6) {
    showAuthError("Password minimal harus 6 karakter.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  try {
    await window.PickPictAuth.register(name, email, pass);
    showToast("Pendaftaran berhasil! Selamat datang di PickPict.", "success");

    if (typeof confetti === "function") {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#EC4899', '#F43F5E', '#FED2E2', '#FFF5F8']
      });
    }
  } catch (err) {
    console.error("Register error:", err);
    let msg = err.message || "Gagal mendaftarkan akun.";
    if (err.code === "auth/email-already-in-use") {
      msg = "Email ini sudah terdaftar. Silakan gunakan email lain atau masuk.";
    } else if (err.code === "auth/invalid-email") {
      msg = "Format alamat email tidak valid.";
    } else if (err.code === "auth/weak-password") {
      msg = "Password terlalu lemah. Gunakan minimal 6 karakter kombinasi.";
    }
    showAuthError(msg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75");
    }
  }
}

async function handleAdminLogout() {
  if (adminSessionsUnsubscribe) {
    adminSessionsUnsubscribe();
    adminSessionsUnsubscribe = null;
  }
  await window.PickPictAuth.logout();
  showToast("Anda telah keluar dari Dashboard Admin.", "info");
}

// ==========================================
// 3. REALTIME SNAPSHOT TERISOLASI PER-ADMIN
// ==========================================
function setupRealtimeAdminSessions(adminId) {
  if (adminSessionsUnsubscribe) {
    adminSessionsUnsubscribe();
    adminSessionsUnsubscribe = null;
  }

  if (window.PickPictDB && typeof window.PickPictDB.subscribeAdminSessions === "function") {
    adminSessionsUnsubscribe = window.PickPictDB.subscribeAdminSessions(adminId, (sessions) => {
      renderDashboardStats(sessions);
      const searchInput = document.getElementById("searchSessionsInput");
      if (!searchInput || !searchInput.value.trim()) {
        renderSessionsList(sessions);
      }
    });
  }
}

// ==========================================
// 4. LOAD DATA DASHBOARD & STATISTIK
// ==========================================
async function loadDashboardData() {
  if (!currentAdminUser) return;
  const adminId = currentAdminUser.uid;

  let sessions = window.PickPictDB.getLocalAdminSessions(adminId);
  renderDashboardStats(sessions);
  renderSessionsList(sessions);

  // Refresh dari Firestore
  if (window.PickPictDB && typeof window.PickPictDB.getAdminSessionsAsync === "function") {
    try {
      const cloudSessions = await window.PickPictDB.getAdminSessionsAsync(adminId);
      renderDashboardStats(cloudSessions);
      const searchInput = document.getElementById("searchSessionsInput");
      if (!searchInput || !searchInput.value.trim()) {
        renderSessionsList(cloudSessions);
      }
    } catch (e) {
      console.warn("Gagal memuat sessions admin:", e);
    }
  }
}

function renderDashboardStats(sessions) {
  const totalSessions = sessions.length;
  let totalSelectedPhotos = 0;
  let readySessions = 0;

  sessions.forEach(s => {
    const list = s.selectedFiles || s.selectedPhotos || [];
    const selCount = list.length;
    totalSelectedPhotos += selCount;
    if (selCount > 0) {
      readySessions++;
    }
  });

  const statTotal = document.getElementById("statTotalSessions");
  const statPhotos = document.getElementById("statTotalSelectedPhotos");
  const statReady = document.getElementById("statReadySessions");

  if (statTotal) statTotal.textContent = totalSessions;
  if (statPhotos) statPhotos.textContent = totalSelectedPhotos;
  if (statReady) statReady.textContent = readySessions;
}

// ==========================================
// 5. TAMBAH SESI PELANGGAN BARU (BERBASIS ADMIN ID)
// ==========================================
async function handleCreateSession() {
  if (!currentAdminUser) {
    showToast("Anda harus masuk akun terlebih dahulu.", "error");
    return;
  }

  const nameInput = document.getElementById("clientNameInput");
  const urlInput = document.getElementById("gdriveUrlInput");
  const maxInput = document.getElementById("maxSelectInput");
  const notesInput = document.getElementById("notesInput");
  const submitBtn = document.querySelector("#createSessionForm button[type='submit']") || document.querySelector("button[onclick='handleCreateSession()']");

  const clientName = nameInput.value.trim();
  const gdriveUrl = urlInput.value.trim();
  const maxSelect = parseInt(maxInput.value, 10) || 0;
  const notes = notesInput.value.trim();

  if (!clientName || !gdriveUrl) {
    showToast("Nama pelanggan dan link Google Drive wajib diisi.", "error");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  // Ekstrak Folder ID
  const folderId = extractGdriveFolderId(gdriveUrl);
  
  // Buat kode unik 4 digit
  const generatedCode = window.PickPictDB.generateUniqueCode();

  // Waktu pembuatan
  const now = new Date();
  const dateFormatted = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

  // Ambil daftar foto dari Google Drive
  let photos = [];
  try {
    photos = await fetchFolderPhotos(folderId, gdriveUrl);
  } catch (e) {
    photos = [];
  }

  // Schema multi-tenancy resmi sesuai instruksi
  const sessionData = {
    adminId: currentAdminUser.uid,
    adminEmail: currentAdminUser.email,
    accessCode: generatedCode, // 4 digit kode unik
    code: generatedCode, // kompatibilitas
    clientName: clientName,
    gdriveUrl: gdriveUrl,
    folderId: folderId,
    maxSelection: maxSelect,
    maxSelect: maxSelect,
    notes: notes || "Sesi Foto PickPict Studio",
    selectedFiles: [],
    selectedPhotos: [],
    files: photos,
    createdAt: typeof firebase !== "undefined" && firebase.firestore && firebase.firestore.FieldValue
      ? firebase.firestore.FieldValue.serverTimestamp()
      : now.toISOString(),
    createdAtFormatted: dateFormatted,
    status: "active"
  };

  // Simpan ke Firestore & Local Cache
  await window.PickPictDB.saveSession(sessionData);

  // Reset form input
  nameInput.value = "";
  urlInput.value = "";
  maxInput.value = "";
  notesInput.value = "";

  if (submitBtn) {
    submitBtn.disabled = false;
    submitBtn.classList.remove("opacity-75");
  }

  // Refresh tampilan dashboard
  loadDashboardData();

  // Confetti selebrasi
  if (typeof confetti === "function") {
    confetti({
      particleCount: 120,
      spread: 80,
      origin: { y: 0.6 },
      colors: ['#EC4899', '#F43F5E', '#FED2E2', '#FFF5F8']
    });
  }

  // Tampilkan Pop-up Sukses dengan kode besar
  showCodeSuccessModal(sessionData);
}

// ==========================================
// 6. MODAL POP-UP KODE AKSES BERHASIL
// ==========================================
function showCodeSuccessModal(session) {
  activeModalSession = session;

  const modal = document.getElementById("codeSuccessModal");
  const nameLabel = document.getElementById("modalSuccessClientName");
  const codeDisplay = document.getElementById("modalBigCodeDisplay");
  const folderBadge = document.getElementById("modalFolderIdBadge");
  const directTestBtn = document.getElementById("btnDirectTestGallery");

  const code = session.accessCode || session.code;
  nameLabel.textContent = `Untuk Sesi: ${session.clientName}`;
  codeDisplay.textContent = code;
  folderBadge.textContent = `Folder ID: ${session.folderId}`;
  directTestBtn.href = `index.html?code=${code}`;

  modal.classList.remove("hidden");
  showToast(`Kode ${code} berhasil dibuat.`, "success");
}

function closeCodeSuccessModal() {
  const modal = document.getElementById("codeSuccessModal");
  if (modal) modal.classList.add("hidden");
  activeModalSession = null;
}

function copyGeneratedCode() {
  if (!activeModalSession) return;
  const code = activeModalSession.accessCode || activeModalSession.code;
  copyToClipboard(code, `Kode ${code} berhasil disalin.`);
}

function copyWhatsappInviteMessage() {
  if (!activeModalSession) return;

  const code = activeModalSession.accessCode || activeModalSession.code;
  const baseUrl = window.location.origin + window.location.pathname.replace("admin.html", "index.html");
  const inviteUrl = `${baseUrl}?code=${code}`;
  const quota = activeModalSession.maxSelection ?? activeModalSession.maxSelect ?? 0;
  const quotaText = quota > 0 ? `${quota} foto favoritmu` : "Bebas pilih semua foto";

  const message = `Halo Kak ${activeModalSession.clientName}!

Foto-foto dari sesi studio kamu sudah siap dilihat dan dipilih di galeri PickPict.

Silakan klik link berikut untuk membuka galeri:
${inviteUrl}

Atau buka ${baseUrl} dan masukkan Kode Akses:
*${code}*

• Kuota Pilihan: ${quotaText}
• Kamu bisa langsung unduh file ZIP atau kirim pilihan foto langsung ke admin.

Jika ada pertanyaan, langsung hubungi kami. Terima kasih!`;

  copyToClipboard(message, "Pesan WhatsApp untuk pelanggan berhasil disalin.");
}

// ==========================================
// 7. RENDER DAFTAR SESI PELANGGAN AKTIF
// ==========================================
function renderSessionsList(sessions) {
  const container = document.getElementById("sessionsListContainer");
  const emptyState = document.getElementById("emptySessionsState");

  if (!sessions || sessions.length === 0) {
    container.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  container.innerHTML = "";

  sessions.forEach(session => {
    const code = session.accessCode || session.code;
    const selectedList = session.selectedFiles || session.selectedPhotos || [];
    const selectedCount = selectedList.length;
    const quota = session.maxSelection ?? session.maxSelect ?? 0;
    const maxText = quota > 0 ? ` / ${quota}` : "";
    const hasSelections = selectedCount > 0;

    const card = document.createElement("div");
    card.className = "glass-coquette border border-pink-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4";

    card.innerHTML = `
      <!-- Kiri: Info Sesi & Kode 4 Digit -->
      <div class="flex items-start sm:items-center gap-4">
        <!-- Badge 4 Digit Code Cantik -->
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex flex-col items-center justify-center shrink-0 shadow-md shadow-pink-300/50 cursor-pointer group" onclick="copySessionCode('${code}')" title="Klik untuk salin kode">
          <span class="text-[9px] font-bold uppercase tracking-wider opacity-90">KODE</span>
          <span class="font-mono text-xl font-black">${code}</span>
        </div>

        <div>
          <div class="flex flex-wrap items-center gap-2 mb-1">
            <h4 class="font-serif text-lg font-bold text-rosewood">${session.clientName}</h4>
            
            <!-- Status Badge Pilihan Pelanggan -->
            <span class="px-2.5 py-0.5 rounded-full text-xs font-semibold ${
              hasSelections
                ? "bg-emerald-100 text-emerald-800 border border-emerald-200"
                : "bg-pink-100/70 text-pink-700 border border-pink-200"
            }">
              ${hasSelections ? `${selectedCount}${maxText} Foto Dipilih` : "Menunggu Pilihan"}
            </span>
          </div>

          <p class="text-xs text-mauve mb-1.5">${session.notes || "Sesi Foto PickPict Studio"}</p>

          <div class="flex flex-wrap items-center gap-3 text-[11px] text-mauve">
            <span>Dibuat: ${session.createdAtFormatted || "-"}</span>
            <span>•</span>
            <a href="${session.gdriveUrl}" target="_blank" class="text-pink-600 hover:underline flex items-center gap-1 font-medium">
              <i data-lucide="folder" class="w-3.5 h-3.5"></i>
              <span>Buka Google Drive</span>
            </a>
          </div>
        </div>
      </div>

      <!-- Kanan: Tombol-Tombol Aksi Sesi -->
      <div class="flex flex-wrap items-center gap-2 pt-2 md:pt-0 border-t md:border-t-0 border-pink-100">
        <!-- Tombol Lihat Foto Pilihan -->
        <button
          onclick="openSelectionDetailModal('${code}')"
          class="px-3.5 py-2 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
            hasSelections
              ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-sm shadow-pink-500/30 hover:scale-[1.02]"
              : "bg-white hover:bg-pink-50 text-rosewood border border-pink-200"
          }"
        >
          <i data-lucide="eye" class="w-4 h-4"></i>
          <span>Lihat Pilihan (${selectedCount})</span>
        </button>

        <!-- Tombol Salin Pesan WA -->
        <button
          onclick="quickCopyWaForSession('${code}')"
          class="p-2 rounded-xl bg-white hover:bg-pink-50 text-mauve hover:text-pink-600 border border-pink-200 transition-colors"
          title="Salin Pesan WhatsApp untuk Klien Ini"
        >
          <i data-lucide="message-circle" class="w-4 h-4 text-emerald-600"></i>
        </button>

        <!-- Tombol Buka Galeri Pelanggan -->
        <a
          href="index.html?code=${code}"
          target="_blank"
          class="p-2 rounded-xl bg-white hover:bg-pink-50 text-mauve hover:text-pink-600 border border-pink-200 transition-colors"
          title="Buka Galeri Foto Pelanggan"
        >
          <i data-lucide="external-link" class="w-4 h-4"></i>
        </a>

        <!-- Tombol Hapus Sesi -->
        <button
          onclick="confirmDeleteSession('${code}')"
          class="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors cursor-pointer"
          title="Hapus Sesi Ini"
        >
          <i data-lucide="trash-2" class="w-4 h-4"></i>
        </button>
      </div>
    `;

    container.appendChild(card);
  });

  if (window.lucide) {
    lucide.createIcons({ root: container });
  }
}

function filterSessionsList() {
  if (!currentAdminUser) return;
  const query = document.getElementById("searchSessionsInput").value.toLowerCase().trim();
  const allSessions = window.PickPictDB.getLocalAdminSessions(currentAdminUser.uid);

  if (!query) {
    renderSessionsList(allSessions);
    return;
  }

  const filtered = allSessions.filter(s =>
    (s.clientName && s.clientName.toLowerCase().includes(query)) ||
    (s.accessCode && s.accessCode.toString().includes(query)) ||
    (s.code && s.code.toString().includes(query)) ||
    (s.notes && s.notes.toLowerCase().includes(query))
  );

  renderSessionsList(filtered);
}

function copySessionCode(code) {
  copyToClipboard(code, `Kode ${code} berhasil disalin.`);
}

function quickCopyWaForSession(code) {
  const session = window.PickPictDB.getSessionByCodeSync(code);
  if (!session) return;
  activeModalSession = session;
  copyWhatsappInviteMessage();
}

async function confirmDeleteSession(code) {
  const session = window.PickPictDB.getSessionByCodeSync(code);
  const clientName = session ? session.clientName : code;

  const confirmed = confirm(`Yakin ingin menghapus sesi "${clientName}" (Kode: ${code})?`);
  if (confirmed && currentAdminUser) {
    await window.PickPictDB.deleteSession(code, currentAdminUser.uid);
    showToast(`Sesi "${clientName}" berhasil dihapus.`, "info");
    loadDashboardData();
  }
}

// ==========================================
// 8. MODAL DETAIL FOTO PILIHAN PELANGGAN
// ==========================================
async function openSelectionDetailModal(code) {
  let session = window.PickPictDB.getSessionByCodeSync(code);
  if (!session) {
    session = await window.PickPictDB.getSessionByCode(code);
  }
  if (!session) return;

  currentViewingSelectionSession = session;

  const modal = document.getElementById("selectionDetailModal");
  const codeBadge = document.getElementById("detailSelectionClientCode");
  const nameTitle = document.getElementById("detailSelectionClientName");
  const statsLabel = document.getElementById("detailSelectionStats");
  const listContainer = document.getElementById("detailFileListContainer");

  const displayCode = session.accessCode || session.code;
  codeBadge.textContent = `Kode: ${displayCode}`;
  nameTitle.textContent = `Foto Pilihan: ${session.clientName}`;

  const selectedList = session.selectedFiles || session.selectedPhotos || [];
  const quota = session.maxSelection ?? session.maxSelect ?? "bebas";
  statsLabel.textContent = `Total: ${selectedList.length} foto terpilih dari kuota ${quota}`;

  if (selectedList.length === 0) {
    listContainer.innerHTML = `
      <div class="p-6 rounded-2xl bg-rose-50/70 border border-pink-200 text-center">
        <i data-lucide="clock" class="w-8 h-8 text-pink-400 mx-auto mb-2"></i>
        <p class="text-xs font-semibold text-rosewood">Pelanggan Belum Memilih Foto</p>
        <p class="text-[11px] text-mauve mt-1">Klien belum menyimpan pilihan foto dari halaman galeri.</p>
      </div>
    `;
  } else {
    listContainer.innerHTML = selectedList.map((filename, idx) => `
      <div class="flex items-center justify-between p-3 rounded-xl bg-white border border-pink-100 hover:border-pink-300 transition-colors">
        <div class="flex items-center gap-2.5">
          <span class="w-6 h-6 rounded-lg bg-pink-100 text-pink-600 text-xs font-bold flex items-center justify-center shrink-0">
            ${idx + 1}
          </span>
          <span class="font-mono text-xs sm:text-sm font-bold text-rosewood">${filename}</span>
        </div>
        <button
          onclick="copyToClipboard('${filename}', 'Nama file ${filename} disalin!')"
          class="text-mauve hover:text-pink-600 p-1 transition-colors"
          title="Salin nama file"
        >
          <i data-lucide="copy" class="w-3.5 h-3.5"></i>
        </button>
      </div>
    `).join("");
  }

  modal.classList.remove("hidden");
  if (window.lucide) {
    lucide.createIcons({ root: modal });
  }
}

function closeSelectionDetailModal() {
  const modal = document.getElementById("selectionDetailModal");
  if (modal) modal.classList.add("hidden");
  currentViewingSelectionSession = null;
}

function copyFilenamesForLightroom() {
  if (!currentViewingSelectionSession) return;
  const list = currentViewingSelectionSession.selectedFiles || currentViewingSelectionSession.selectedPhotos || [];

  if (list.length === 0) {
    showToast("Belum ada foto yang dipilih pada sesi ini.", "error");
    return;
  }

  const textToCopy = `${list.join(", ")}`;
  copyToClipboard(
    textToCopy,
    "Nama file berhasil disalin! Siap dipaste ke filter Lightroom / Photoshop."
  );
}

function downloadSelectionAsTxt() {
  if (!currentViewingSelectionSession) return;
  const list = currentViewingSelectionSession.selectedFiles || currentViewingSelectionSession.selectedPhotos || [];

  if (list.length === 0) {
    showToast("Belum ada foto yang dipilih untuk diunduh sebagai teks.", "error");
    return;
  }

  const clientName = currentViewingSelectionSession.clientName;
  const code = currentViewingSelectionSession.accessCode || currentViewingSelectionSession.code;
  const content = `DAFTAR FOTO PILIHAN KLIEN - PICKPICT STUDIO
==============================================
Nama Klien    : ${clientName}
Kode Sesi     : ${code}
Tanggal       : ${currentViewingSelectionSession.createdAtFormatted || "-"}
Total Pilihan : ${list.length} Foto
==============================================

DAFTAR NAMA FILE:
${list.map((f, i) => `${i + 1}. ${f}`).join("\n")}

FORMAT SATU BARIS (LIGHTROOM / BRIDGE FILTER):
${list.join(", ")}
`;

  const blob = new Blob([content], { type: "text/plain;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Foto_Pilihan_${clientName.replace(/[^a-zA-Z0-9_-]/g, "_")}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  showToast("File daftar pilihan (.txt) berhasil diunduh!", "success");
}

// ==========================================
// 9. HELPER COPY TO CLIPBOARD
// ==========================================
function copyToClipboard(text, successMessage = "Teks berhasil disalin!") {
  if (navigator.clipboard && window.isSecureContext) {
    navigator.clipboard.writeText(text).then(() => {
      showToast(successMessage, "success");
    }).catch(() => {
      fallbackCopyText(text, successMessage);
    });
  } else {
    fallbackCopyText(text, successMessage);
  }
}

function fallbackCopyText(text, successMessage) {
  const textArea = document.createElement("textarea");
  textArea.value = text;
  textArea.style.position = "fixed";
  textArea.style.left = "-999999px";
  textArea.style.top = "-999999px";
  document.body.appendChild(textArea);
  textArea.focus();
  textArea.select();
  try {
    document.execCommand("copy");
    showToast(successMessage, "success");
  } catch (err) {
    showToast("Gagal menyalin teks. Silakan salin secara manual.", "error");
  }
  textArea.remove();
}

// ==========================================
// 10. EKSPOS FUNGSI ADMIN KE WINDOW (GLOBAL SCOPE)
// ==========================================
window.switchAuthTab = switchAuthTab;
window.handleAdminLogin = handleAdminLogin;
window.handleAdminRegister = handleAdminRegister;
window.handleAdminLogout = handleAdminLogout;
window.handleCreateSession = handleCreateSession;
window.showCodeSuccessModal = showCodeSuccessModal;
window.closeCodeSuccessModal = closeCodeSuccessModal;
window.copyGeneratedCode = copyGeneratedCode;
window.copyWhatsappInviteMessage = copyWhatsappInviteMessage;
window.closeSelectionDetailModal = closeSelectionDetailModal;
window.copyFilenamesForLightroom = copyFilenamesForLightroom;
window.downloadSelectionAsTxt = downloadSelectionAsTxt;
window.openSelectionDetailModal = openSelectionDetailModal;
window.quickCopyWaForSession = quickCopyWaForSession;
window.confirmDeleteSession = confirmDeleteSession;
window.copySessionCode = copySessionCode;
window.filterSessionsList = filterSessionsList;
