/**
 * PickPict - Logika Dashboard Admin (Admin Logic)
 * Mengatur autentikasi admin, pembuatan sesi baru, ekstraksi Folder ID GDrive,
 * generator kode 4 digit otomatis, dan pemantauan foto pilihan pelanggan.
 */

// State Global Dashboard Admin
let activeModalSession = null;
let currentViewingSelectionSession = null;
let adminSessionsUnsubscribe = null;

document.addEventListener("DOMContentLoaded", () => {
  checkAdminAuth();
});

// ==========================================
// 1. CEK AUTENTIKASI ADMIN & TRANSISI VIEW
// ==========================================
function checkAdminAuth() {
  const loginScreen = document.getElementById("adminLoginScreen");
  const dashboardScreen = document.getElementById("adminDashboardScreen");

  if (window.PickPictAuth.isLoggedIn()) {
    loginScreen.classList.add("hidden");
    dashboardScreen.classList.remove("hidden");
    loadDashboardData();
    setupRealtimeSessionsListener();
  } else {
    loginScreen.classList.remove("hidden");
    dashboardScreen.classList.add("hidden");
    if (adminSessionsUnsubscribe) {
      adminSessionsUnsubscribe();
      adminSessionsUnsubscribe = null;
    }
  }
}

function handleAdminLogin() {
  const u = document.getElementById("loginUsername").value;
  const p = document.getElementById("loginPassword").value;

  if (window.PickPictAuth.login(u, p)) {
    showToast("Selamat datang di Dashboard Admin Studio!", "success");
    checkAdminAuth();

    if (typeof confetti === "function") {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.7 },
        colors: ['#EC4899', '#F43F5E', '#FED2E2']
      });
    }
  } else {
    showToast("Username atau Password admin salah. Silakan coba lagi.", "error");
  }
}

function handleAdminLogout() {
  if (adminSessionsUnsubscribe) {
    adminSessionsUnsubscribe();
    adminSessionsUnsubscribe = null;
  }
  window.PickPictAuth.logout();
  showToast("Anda telah keluar dari Dashboard Admin.", "info");
  checkAdminAuth();
}

// Listener real-time Firestore agar perubahan foto klien muncul otomatis
function setupRealtimeSessionsListener() {
  if (adminSessionsUnsubscribe) return;
  if (window.PickPictDB && typeof window.PickPictDB.subscribeSessions === "function") {
    adminSessionsUnsubscribe = window.PickPictDB.subscribeSessions((sessions) => {
      renderDashboardStats(sessions);
      const searchInput = document.getElementById("searchSessionsInput");
      if (!searchInput || !searchInput.value.trim()) {
        renderSessionsList(sessions);
      }
    });
  }
}

// ==========================================
// 2. LOAD DATA DASHBOARD & STATISTIK
// ==========================================
async function loadDashboardData() {
  let sessions = window.PickPictDB.getAllSessions();
  renderDashboardStats(sessions);
  renderSessionsList(sessions);

  // Jika Firestore tersedia, muat data terbaru dari cloud
  if (window.PickPictDB && typeof window.PickPictDB.getAllSessionsAsync === "function") {
    try {
      const cloudSessions = await window.PickPictDB.getAllSessionsAsync();
      renderDashboardStats(cloudSessions);
      const searchInput = document.getElementById("searchSessionsInput");
      if (!searchInput || !searchInput.value.trim()) {
        renderSessionsList(cloudSessions);
      }
    } catch (e) {
      console.warn("Gagal memuat sessions cloud:", e);
    }
  }
}

function renderDashboardStats(sessions) {
  const totalSessions = sessions.length;
  let totalSelectedPhotos = 0;
  let readySessions = 0;

  sessions.forEach(s => {
    const selCount = (s.selectedPhotos || []).length;
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
// 3. TAMBAH SESI PELANGGAN BARU (BUAT KODE AKSES)
// ==========================================
async function handleCreateSession() {
  const nameInput = document.getElementById("clientNameInput");
  const urlInput = document.getElementById("gdriveUrlInput");
  const maxInput = document.getElementById("maxSelectInput");
  const notesInput = document.getElementById("notesInput");

  const clientName = nameInput.value.trim();
  const gdriveUrl = urlInput.value.trim();
  const maxSelect = parseInt(maxInput.value, 10) || 0;
  const notes = notesInput.value.trim();

  if (!clientName || !gdriveUrl) {
    showToast("Nama pelanggan dan link Google Drive wajib diisi.", "error");
    return;
  }

  // Ekstrak Folder ID
  const folderId = extractGdriveFolderId(gdriveUrl);
  
  // Buat kode unik 4 digit
  const uniqueCode = window.PickPictDB.generateUniqueCode();

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

  const newSession = {
    id: `session-${uniqueCode}`,
    code: uniqueCode,
    clientName: clientName,
    gdriveUrl: gdriveUrl,
    folderId: folderId,
    maxSelect: maxSelect,
    notes: notes || "Sesi Foto PickPict Studio",
    createdAt: dateFormatted,
    selectedPhotos: [],
    status: "Menunggu Pelanggan",
    files: photos
  };

  // Simpan ke database hybrid (Firestore Cloud + LocalStorage)
  await window.PickPictDB.saveSession(newSession);

  // Reset form input
  nameInput.value = "";
  urlInput.value = "";
  maxInput.value = "";
  notesInput.value = "";

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
  showCodeSuccessModal(newSession);
}

// ==========================================
// 4. MODAL POP-UP KODE AKSES BERHASIL
// ==========================================
function showCodeSuccessModal(session) {
  activeModalSession = session;

  const modal = document.getElementById("codeSuccessModal");
  const nameLabel = document.getElementById("modalSuccessClientName");
  const codeDisplay = document.getElementById("modalBigCodeDisplay");
  const folderBadge = document.getElementById("modalFolderIdBadge");
  const directTestBtn = document.getElementById("btnDirectTestGallery");

  nameLabel.textContent = `Untuk Sesi: ${session.clientName}`;
  codeDisplay.textContent = session.code;
  folderBadge.textContent = `Folder ID: ${session.folderId}`;
  directTestBtn.href = `index.html?code=${session.code}`;

  modal.classList.remove("hidden");
  showToast(`Kode ${session.code} berhasil dibuat.`, "success");
}

function closeCodeSuccessModal() {
  const modal = document.getElementById("codeSuccessModal");
  if (modal) modal.classList.add("hidden");
  activeModalSession = null;
}

function copyGeneratedCode() {
  if (!activeModalSession) return;
  copyToClipboard(activeModalSession.code, `Kode ${activeModalSession.code} berhasil disalin.`);
}

function copyWhatsappInviteMessage() {
  if (!activeModalSession) return;

  const baseUrl = window.location.origin + window.location.pathname.replace("admin.html", "index.html");
  const inviteUrl = `${baseUrl}?code=${activeModalSession.code}`;
  const quotaText = activeModalSession.maxSelect > 0
    ? `${activeModalSession.maxSelect} foto favoritmu`
    : "Bebas pilih semua foto";

  const message = `Halo Kak ${activeModalSession.clientName}!

Foto-foto dari sesi studio kamu sudah siap dilihat dan dipilih di galeri PickPict.

Silakan klik link berikut untuk membuka galeri:
${inviteUrl}

Atau buka ${baseUrl} dan masukkan Kode Akses:
*${activeModalSession.code}*

• Kuota Pilihan: ${quotaText}
• Kamu bisa langsung unduh file ZIP atau kirim pilihan foto langsung ke admin.

Jika ada pertanyaan, langsung hubungi kami. Terima kasih!`;

  copyToClipboard(message, "Pesan WhatsApp untuk pelanggan berhasil disalin.");
}

// ==========================================
// 5. RENDER DAFTAR SESI PELANGGAN AKTIF
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
    const selectedCount = (session.selectedPhotos || []).length;
    const maxText = session.maxSelect > 0 ? ` / ${session.maxSelect}` : "";
    const hasSelections = selectedCount > 0;

    const card = document.createElement("div");
    card.className = "glass-coquette border border-pink-200/90 rounded-2xl p-5 shadow-sm hover:shadow-md transition-all flex flex-col md:flex-row md:items-center justify-between gap-4";

    card.innerHTML = `
      <!-- Kiri: Info Sesi & Kode 4 Digit -->
      <div class="flex items-start sm:items-center gap-4">
        <!-- Badge 4 Digit Code Cantik -->
        <div class="w-16 h-16 rounded-2xl bg-gradient-to-tr from-pink-500 to-rose-400 text-white flex flex-col items-center justify-center shrink-0 shadow-md shadow-pink-300/50 cursor-pointer group" onclick="copySessionCode('${session.code}')" title="Klik untuk salin kode">
          <span class="text-[9px] font-bold uppercase tracking-wider opacity-90">KODE</span>
          <span class="font-mono text-xl font-black">${session.code}</span>
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
            <span>Dibuat: ${session.createdAt || "-"}</span>
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
          onclick="openSelectionDetailModal('${session.code}')"
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
          onclick="quickCopyWaForSession('${session.code}')"
          class="p-2 rounded-xl bg-white hover:bg-pink-50 text-mauve hover:text-pink-600 border border-pink-200 transition-colors"
          title="Salin Pesan WhatsApp untuk Klien Ini"
        >
          <i data-lucide="message-circle" class="w-4 h-4 text-emerald-600"></i>
        </button>

        <!-- Tombol Buka Galeri Pelanggan -->
        <a
          href="index.html?code=${session.code}"
          target="_blank"
          class="p-2 rounded-xl bg-white hover:bg-pink-50 text-mauve hover:text-pink-600 border border-pink-200 transition-colors"
          title="Buka Galeri Foto Pelanggan"
        >
          <i data-lucide="external-link" class="w-4 h-4"></i>
        </a>

        <!-- Tombol Hapus Sesi -->
        <button
          onclick="confirmDeleteSession('${session.code}')"
          class="p-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-600 border border-rose-200 transition-colors"
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
  const query = document.getElementById("searchSessionsInput").value.toLowerCase().trim();
  const allSessions = window.PickPictDB.getAllSessions();

  if (!query) {
    renderSessionsList(allSessions);
    return;
  }

  const filtered = allSessions.filter(s =>
    (s.clientName && s.clientName.toLowerCase().includes(query)) ||
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
  if (confirmed) {
    await window.PickPictDB.deleteSession(code);
    showToast(`Sesi "${clientName}" berhasil dihapus.`, "info");
    loadDashboardData();
  }
}

// ==========================================
// 6. MODAL DETAIL FOTO PILIHAN PELANGGAN
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

  codeBadge.textContent = `Kode: ${session.code}`;
  nameTitle.textContent = `Foto Pilihan: ${session.clientName}`;

  const selectedList = session.selectedPhotos || [];
  statsLabel.textContent = `Total: ${selectedList.length} foto terpilih dari kuota ${session.maxSelect || 'bebas'}`;

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
  const list = currentViewingSelectionSession.selectedPhotos || [];

  if (list.length === 0) {
    showToast("Belum ada foto yang dipilih pada sesi ini.", "error");
    return;
  }

  // Format bersih untuk filter pencarian Lightroom / Photoshop:
  // Contoh: IMG_8801, IMG_8803, IMG_8808 (atau tanpa ekstensi)
  const cleanedNames = list.map(f => f.replace(/\.[^/.]+$/, "")).join(", ");
  const fullNames = list.join(", ");

  const textToCopy = `${list.join(", ")}`;
  copyToClipboard(
    textToCopy,
    "Nama file berhasil disalin! Siap dipaste ke filter Lightroom / Photoshop."
  );
}

function downloadSelectionAsTxt() {
  if (!currentViewingSelectionSession) return;
  const list = currentViewingSelectionSession.selectedPhotos || [];

  if (list.length === 0) {
    showToast("Belum ada foto yang dipilih untuk diunduh sebagai teks.", "error");
    return;
  }

  const clientName = currentViewingSelectionSession.clientName;
  const content = `DAFTAR FOTO PILIHAN KLIEN - PICKPICT STUDIO
==============================================
Nama Klien    : ${clientName}
Kode Sesi     : ${currentViewingSelectionSession.code}
Tanggal       : ${currentViewingSelectionSession.createdAt}
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
// 7. HELPER COPY TO CLIPBOARD
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
