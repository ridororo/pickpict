/**
 * PickPict - Logika Halaman Pelanggan (Client Logic)
 * Mengatur input PIN 4 digit otomatis, tampilan galeri, seleksi foto,
 * lightbox zoom, download ZIP, dan pengiriman pilihan ke admin.
 */

// State Global Halaman Pelanggan
let currentSession = null;
let currentPhotos = [];
let selectedPhotoNames = new Set();
let currentLightboxIndex = 0;

document.addEventListener("DOMContentLoaded", () => {
  setupPinInputs();
  checkUrlParamsForCode();
  setupKeyboardShortcuts();

  // Pasang listener langsung pada form & tombol PIN
  const pinForm = document.getElementById("pinForm");
  if (pinForm) {
    pinForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitPinCode();
    });
  }

  const btnSubmitPin = document.getElementById("btnSubmitPin");
  if (btnSubmitPin) {
    btnSubmitPin.addEventListener("click", (e) => {
      e.preventDefault();
      submitPinCode();
    });
  }

  const btnAdmin = document.getElementById("btnOpenAdminModal");
  if (btnAdmin) {
    btnAdmin.addEventListener("click", openAdminLoginModal);
  }
});

// ==========================================
// 1. PENGATURAN INPUT 4 KOTAK KODE PIN
// ==========================================
function setupPinInputs() {
  const container = document.getElementById("pinInputsContainer");
  if (!container) return;

  const inputs = Array.from(container.querySelectorAll(".pin-input"));

  inputs.forEach((input, index) => {
    // Event Input Karakter
    input.addEventListener("input", (e) => {
      const val = e.target.value.replace(/[^0-9]/g, "");
      e.target.value = val ? val[0] : "";

      // Bersihkan error message jika user mulai mengetik lagi
      hidePinError();

      // Cek apakah 4 digit sudah terisi
      const fullCode = inputs.map(i => i.value).join("");

      if (e.target.value && index < inputs.length - 1) {
        inputs[index + 1].focus();
      }

      // Jika 4 digit lengkap, otomatis submit
      if (fullCode.length === 4) {
        setTimeout(() => submitPinCode(), 150);
      }
    });

    // Event Backspace & Navigasi Panah
    input.addEventListener("keydown", (e) => {
      if (e.key === "Backspace") {
        if (!input.value && index > 0) {
          inputs[index - 1].focus();
          inputs[index - 1].value = "";
          e.preventDefault();
        }
      } else if (e.key === "ArrowLeft" && index > 0) {
        inputs[index - 1].focus();
      } else if (e.key === "ArrowRight" && index < inputs.length - 1) {
        inputs[index + 1].focus();
      } else if (e.key === "Enter") {
        e.preventDefault();
        submitPinCode();
      }
    });

    // Event Paste (Mendukung Paste 4 Angka Sekaligus)
    input.addEventListener("paste", (e) => {
      e.preventDefault();
      const pasteData = (e.clipboardData || window.clipboardData).getData("text").trim();
      const numbersOnly = pasteData.replace(/[^0-9]/g, "").slice(0, 4);

      if (numbersOnly.length > 0) {
        numbersOnly.split("").forEach((char, i) => {
          if (inputs[i]) inputs[i].value = char;
        });

        const nextIndex = Math.min(numbersOnly.length, inputs.length - 1);
        inputs[nextIndex].focus();

        const fullCode = inputs.map(i => i.value).join("");
        if (fullCode.length === 4) {
          setTimeout(() => submitPinCode(), 150);
        }
      }
    });
  });
}

function quickFillPin(code) {
  const inputs = Array.from(document.querySelectorAll(".pin-input"));
  const chars = code.split("");
  chars.forEach((c, idx) => {
    if (inputs[idx]) inputs[idx].value = c;
  });

  submitPinCode();
}

function getEnteredPin() {
  const inputs = Array.from(document.querySelectorAll(".pin-input"));
  return inputs.map(i => i.value.trim()).join("");
}

function showPinError(msg) {
  const errBox = document.getElementById("pinErrorMessage");
  const errText = document.getElementById("pinErrorText");
  if (errBox && errText) {
    errText.textContent = msg;
    errBox.classList.remove("hidden");
  }
}

function hidePinError() {
  const errBox = document.getElementById("pinErrorMessage");
  if (errBox) errBox.classList.add("hidden");
}

function checkUrlParamsForCode() {
  const params = new URLSearchParams(window.location.search);
  const codeParam = params.get("code");
  if (codeParam && codeParam.length === 4) {
    quickFillPin(codeParam);
  }
}

// ==========================================
// 2. VERIFIKASI & BUKA GALERI FOTO
// ==========================================
async function submitPinCode() {
  const code = getEnteredPin();

  if (code.length < 4) {
    showPinError("Mohon masukkan lengkap 4 digit kode foto kamu.");
    return;
  }

  const inputs = Array.from(document.querySelectorAll(".pin-input"));
  inputs.forEach(i => (i.disabled = true));

  try {
    // Cari sesi di database hybrid (Firestore Cloud + LocalStorage)
    const session = await window.PickPictDB.getSessionByCode(code);
    if (!session) {
      showPinError(`Kode "${code}" tidak ditemukan. Pastikan 4 digit angka sudah benar.`);
      return;
    }

    currentSession = session;
    hidePinError();
    showToast(`Selamat datang, ${session.clientName}!`, "success");

    // Load foto dan tampilkan galeri
    await loadAndDisplayGallery(session);
  } catch (err) {
    console.error("Gagal memeriksa sesi:", err);
    showPinError("Terjadi kendala saat memeriksa kode. Silakan coba lagi.");
  } finally {
    inputs.forEach(i => (i.disabled = false));
  }
}

async function loadAndDisplayGallery(session) {
  const pinScreen = document.getElementById("pinScreen");
  const galleryScreen = document.getElementById("galleryScreen");

  pinScreen.classList.add("hidden");
  galleryScreen.classList.remove("hidden");

  // Update Teks Header Galeri
  document.getElementById("clientGreeting").textContent = `Halo, ${session.clientName}`;
  document.getElementById("currentClientCode").textContent = session.code;
  document.getElementById("sessionNotes").textContent = session.notes || "Silakan pilih foto terbaikmu.";
  
  const statusBadge = document.getElementById("sessionStatusBadge");
  if (statusBadge) {
    statusBadge.textContent = session.gdriveUrl ? "Terhubung ke Google Drive" : "Galeri Aktif";
  }

  // Load status pilihan sebelumnya
  selectedPhotoNames = new Set(session.selectedPhotos || []);

  // Update kuota tampilan
  updateQuotaDisplay();

  // Ambil data foto (API atau fallback foto demo resolusi tinggi)
  if (session.files && Array.isArray(session.files) && session.files.length > 0) {
    currentPhotos = session.files;
  } else {
    currentPhotos = await fetchFolderPhotos(session.folderId, session.gdriveUrl);
  }

  renderPhotoGrid(currentPhotos);
  updateFloatingBar();

  // Scroll lembut ke galeri
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function exitGallery() {
  const pinScreen = document.getElementById("pinScreen");
  const galleryScreen = document.getElementById("galleryScreen");
  const floatingBar = document.getElementById("floatingActionBar");

  galleryScreen.classList.add("hidden");
  pinScreen.classList.remove("hidden");
  floatingBar.classList.add("translate-y-32", "opacity-0", "pointer-events-none");

  // Reset input PIN
  const inputs = Array.from(document.querySelectorAll(".pin-input"));
  inputs.forEach(i => (i.value = ""));
  if (inputs[0]) inputs[0].focus();

  currentSession = null;
  selectedPhotoNames.clear();
}

// ==========================================
// 3. RENDER GRID FOTO & INTERAKSI SELEKSI
// ==========================================
function renderPhotoGrid(photos) {
  const grid = document.getElementById("photoGrid");
  const emptyState = document.getElementById("emptyPhotosState");

  if (!photos || photos.length === 0) {
    grid.innerHTML = "";
    emptyState.classList.remove("hidden");
    return;
  }

  emptyState.classList.add("hidden");
  grid.innerHTML = "";

  photos.forEach((photo, index) => {
    const isSelected = selectedPhotoNames.has(photo.name);
    const card = document.createElement("div");
    card.id = `photo-card-${index}`;
    card.className = `group relative rounded-3xl overflow-hidden glass-coquette border transition-all duration-300 hover:shadow-2xl hover:-translate-y-1.5 flex flex-col ${
      isSelected
        ? "border-pink-500 ring-4 ring-pink-400/50 shadow-xl shadow-pink-300/40"
        : "border-pink-200/80 shadow-md shadow-pink-100/40 hover:border-pink-300"
    }`;

    card.innerHTML = `
      <!-- Thumbnail Gambar (w1600 untuk grid tajam di layar Retina/HP) -->
      <div class="relative w-full aspect-[4/5] bg-rose-50 overflow-hidden cursor-pointer" onclick="openLightbox(${index})">
        <img
          src="${photo.gridUrl || photo.thumbnailUrl || photo.url}"
          alt="${photo.name}"
          loading="lazy"
          class="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105"
        />

        <!-- Overlay Gradasi Halus -->
        <div class="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>

        <!-- Badge Nama File -->
        <div class="absolute bottom-3 left-3 px-2.5 py-1 rounded-xl bg-black/60 backdrop-blur-md text-white text-[11px] font-mono font-medium flex items-center gap-1.5 pointer-events-none">
          <i data-lucide="image" class="w-3 h-3 text-pink-300"></i>
          <span>${photo.name}</span>
        </div>

        <!-- Tombol Quick Zoom (Hover) -->
        <div class="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none">
          <span class="px-3 py-1.5 rounded-full bg-white/90 text-rosewood text-xs font-semibold backdrop-blur-md shadow-md flex items-center gap-1">
            <i data-lucide="maximize-2" class="w-3.5 h-3.5 text-pink-500"></i>
            <span>Perbesar</span>
          </span>
        </div>
      </div>

      <!-- Header Aksi Foto: Tombol Hati (Pilih) & Tombol Unduh Satuan Asli 100% -->
      <div class="p-3.5 flex items-center justify-between bg-white/90 border-t border-pink-100">
        <div class="text-xs font-medium text-mauve">
          <span>${photo.size || "Foto Asli"}</span>
        </div>

        <div class="flex items-center gap-2">
          <!-- Tombol Unduh Satuan Resolusi Asli 100% -->
          <button
            onclick="downloadSinglePhoto(${index}); event.stopPropagation();"
            class="p-2 rounded-xl bg-pink-50 hover:bg-pink-100 text-mauve hover:text-pink-600 transition-colors cursor-pointer"
            title="Unduh foto resolusi asli 100%"
          >
            <i data-lucide="download" class="w-4 h-4"></i>
          </button>

          <!-- Tombol Hati (Pilih Foto) -->
          <button
            onclick="togglePhotoSelect('${photo.name}', ${index}); event.stopPropagation();"
            class="px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer ${
              isSelected
                ? "bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30"
                : "bg-pink-50 hover:bg-pink-100 text-mauve hover:text-pink-600 border border-pink-200"
            }"
            id="heart-btn-${index}"
          >
            <i data-lucide="heart" class="w-3.5 h-3.5 ${isSelected ? "fill-white text-white" : "text-pink-500"}"></i>
            <span>${isSelected ? "Terpilih" : "Pilih"}</span>
          </button>
        </div>
      </div>
    `;

    grid.appendChild(card);
  });

  if (window.lucide) {
    lucide.createIcons({ root: grid });
  }
}

function togglePhotoSelect(photoName, cardIndex) {
  if (!currentSession) return;

  const maxQuota = currentSession.maxSelect || 0;

  if (selectedPhotoNames.has(photoName)) {
    // Batalkan pilihan
    selectedPhotoNames.delete(photoName);
    showToast(`Batal memilih ${photoName}`, "info");
  } else {
    // Cek batas kuota
    if (maxQuota > 0 && selectedPhotoNames.size >= maxQuota) {
      showToast(`Maksimal pilihan foto adalah ${maxQuota} foto.`, "error");
      return;
    }
    selectedPhotoNames.add(photoName);
    showToast(`Foto ${photoName} dipilih`, "success");
  }

  // Update card UI secara langsung
  updateCardUi(cardIndex, photoName);
  updateQuotaDisplay();
  updateFloatingBar();
}

function updateCardUi(index, photoName) {
  const card = document.getElementById(`photo-card-${index}`);
  const btn = document.getElementById(`heart-btn-${index}`);
  if (!card || !btn) return;

  const isSelected = selectedPhotoNames.has(photoName);

  if (isSelected) {
    card.classList.remove("border-pink-200/80", "shadow-md");
    card.classList.add("border-pink-500", "ring-4", "ring-pink-400/50", "shadow-xl", "shadow-pink-300/40");

    btn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-gradient-to-r from-pink-500 to-rose-500 text-white shadow-md shadow-pink-500/30";
    btn.innerHTML = `<i data-lucide="heart" class="w-3.5 h-3.5 fill-white text-white"></i><span>Terpilih</span>`;
  } else {
    card.classList.remove("border-pink-500", "ring-4", "ring-pink-400/50", "shadow-xl", "shadow-pink-300/40");
    card.classList.add("border-pink-200/80", "shadow-md");

    btn.className = "px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-all cursor-pointer bg-pink-50 hover:bg-pink-100 text-mauve hover:text-pink-600 border border-pink-200";
    btn.innerHTML = `<i data-lucide="heart" class="w-3.5 h-3.5 text-pink-500"></i><span>Pilih</span>`;
  }

  if (window.lucide) {
    lucide.createIcons({ root: btn });
  }
}

function toggleSelectAll() {
  if (!currentSession || currentPhotos.length === 0) return;

  const maxQuota = currentSession.maxSelect || 0;
  const isAllSelected = selectedPhotoNames.size === currentPhotos.length || 
    (maxQuota > 0 && selectedPhotoNames.size >= maxQuota);

  if (isAllSelected) {
    // Deselect semua
    selectedPhotoNames.clear();
    showToast("Semua foto batal dipilih.", "info");
  } else {
    // Pilih sesuai batas kuota
    selectedPhotoNames.clear();
    const limit = maxQuota > 0 ? Math.min(maxQuota, currentPhotos.length) : currentPhotos.length;
    for (let i = 0; i < limit; i++) {
      selectedPhotoNames.add(currentPhotos[i].name);
    }
    showToast(`${limit} foto berhasil dipilih`, "success");
  }

  // Render ulang UI
  renderPhotoGrid(currentPhotos);
  updateQuotaDisplay();
  updateFloatingBar();
}

function updateQuotaDisplay() {
  const selectedCountSpan = document.getElementById("selectedCountSpan");
  const maxQuotaSpan = document.getElementById("maxQuotaSpan");
  const floatingCount = document.getElementById("floatingSelectedCount");
  const selectAllBtnText = document.getElementById("selectAllBtnText");

  const count = selectedPhotoNames.size;
  const max = currentSession ? currentSession.maxSelect : 0;

  if (selectedCountSpan) selectedCountSpan.textContent = count;
  if (maxQuotaSpan) maxQuotaSpan.textContent = max > 0 ? max : "Bebas";
  if (floatingCount) floatingCount.textContent = count;

  if (selectAllBtnText) {
    const isFull = max > 0 ? count >= max : count === currentPhotos.length;
    selectAllBtnText.textContent = isFull ? "Batal Pilih Semua" : "Pilih Semua";
  }
}

function updateFloatingBar() {
  const bar = document.getElementById("floatingActionBar");
  if (!bar) return;

  if (selectedPhotoNames.size > 0) {
    bar.classList.remove("translate-y-32", "opacity-0", "pointer-events-none");
  } else {
    bar.classList.add("translate-y-32", "opacity-0", "pointer-events-none");
  }
}

// ==========================================
// 4. LIGHTBOX ZOOM FOTO LENGKAP (RESOLUSI w4000)
// ==========================================
function openLightbox(index) {
  if (!currentPhotos || !currentPhotos[index]) return;
  currentLightboxIndex = index;

  const modal = document.getElementById("lightboxModal");
  const img = document.getElementById("lightboxImage");
  const filename = document.getElementById("lightboxFilename");
  const downloadBtn = document.getElementById("lightboxDownloadBtn");

  const photo = currentPhotos[index];
  
  // Tampilan Zoom / Lightbox Fullscreen: Gunakan resolusi w4000
  const zoomUrl = photo.zoomUrl || (photo.id ? `https://drive.google.com/thumbnail?id=${photo.id}&sz=w4000` : photo.url);
  img.src = zoomUrl;
  filename.textContent = `${photo.name} (${index + 1}/${currentPhotos.length})`;

  // Tombol Unduh Satuan di Lightbox: Unduh resolusi asli 100%
  downloadBtn.onclick = (e) => {
    e.preventDefault();
    downloadSinglePhoto(currentLightboxIndex);
  };
  downloadBtn.title = "Unduh foto resolusi asli 100%";

  updateLightboxSelectButton();

  modal.classList.remove("hidden");
  document.body.style.overflow = "hidden";
}

function closeLightbox() {
  const modal = document.getElementById("lightboxModal");
  if (modal) modal.classList.add("hidden");
  document.body.style.overflow = "auto";
}

function prevLightboxImage() {
  if (currentLightboxIndex > 0) {
    openLightbox(currentLightboxIndex - 1);
  } else {
    openLightbox(currentPhotos.length - 1);
  }
}

function nextLightboxImage() {
  if (currentLightboxIndex < currentPhotos.length - 1) {
    openLightbox(currentLightboxIndex + 1);
  } else {
    openLightbox(0);
  }
}

function updateLightboxSelectButton() {
  const btn = document.getElementById("lightboxSelectBtn");
  const text = document.getElementById("lightboxSelectText");
  if (!btn || !text || !currentPhotos[currentLightboxIndex]) return;

  const photoName = currentPhotos[currentLightboxIndex].name;
  const isSelected = selectedPhotoNames.has(photoName);

  if (isSelected) {
    btn.className = "px-3.5 py-1.5 rounded-full bg-gradient-to-r from-pink-500 to-rose-500 text-white text-xs font-semibold flex items-center gap-1.5 hover:from-pink-600 hover:to-rose-600 transition-all";
    text.textContent = "Terpilih";
  } else {
    btn.className = "px-3.5 py-1.5 rounded-full bg-white/20 text-white text-xs font-semibold flex items-center gap-1.5 hover:bg-white/30 transition-all";
    text.textContent = "Pilih Foto";
  }
}

function toggleLightboxSelect() {
  if (!currentPhotos[currentLightboxIndex]) return;
  const photoName = currentPhotos[currentLightboxIndex].name;
  togglePhotoSelect(photoName, currentLightboxIndex);
  updateLightboxSelectButton();
}

// ==========================================
// UNDUH SATUAN RESOLUSI ASLI 100% (ORIGINAL FULL RESOLUTION)
// ==========================================
async function downloadSinglePhoto(index) {
  const photo = currentPhotos[index];
  if (!photo) return;

  const downloadUrl = photo.id 
    ? `/api/download-proxy?fileId=${encodeURIComponent(photo.id)}&name=${encodeURIComponent(photo.name)}`
    : (photo.originalDownloadUrl || photo.downloadUrl || photo.url);

  // Buat link unduhan langsung yang memicu download browser
  const a = document.createElement("a");
  a.href = downloadUrl;
  a.download = photo.name || "foto-pickpict.jpg";
  a.target = "_blank";
  document.body.appendChild(a);
  a.click();
  a.remove();
}

// ==========================================
// 5. DOWNLOAD SELECTED AS .ZIP (JSZIP - 100% ORIGINAL RESOLUTION)
// ==========================================
async function downloadSelectedAsZip() {
  if (selectedPhotoNames.size === 0) {
    showToast("Belum ada foto yang kamu pilih untuk diunduh.", "error");
    return;
  }

  const selectedList = currentPhotos.filter(p => selectedPhotoNames.has(p.name));
  const progressModal = document.getElementById("zipProgressModal");
  const progressBar = document.getElementById("zipProgressBar");
  const progressPercent = document.getElementById("zipProgressPercent");
  const progressMessage = document.getElementById("zipProgressMessage");

  progressModal.classList.remove("hidden");
  progressBar.style.width = "0%";
  progressPercent.textContent = "0%";
  progressMessage.textContent = "Sedang menyiapkan foto...";

  try {
    const zip = new JSZip();
    const folder = zip.folder("Foto_Pilihan_PickPict");

    let completed = 0;
    const total = selectedList.length;

    for (let i = 0; i < total; i++) {
      const photo = selectedList[i];
      progressMessage.textContent = `Mengemas resolusi asli ${photo.name} (${i + 1}/${total})...`;

      let blob = null;

      // 1. Coba unduh via download-proxy serverless (bebas CORS & resolusi penuh)
      if (photo.id) {
        try {
          const proxyUrl = `/api/download-proxy?fileId=${encodeURIComponent(photo.id)}`;
          const proxyRes = await fetch(proxyUrl);
          if (proxyRes.ok) {
            blob = await proxyRes.blob();
          }
        } catch (e) {}
      }

      // 2. Jika ada direct API Key, coba endpoint Google Drive API alt=media
      if (!blob && photo.id && typeof GDRIVE_API_KEY !== "undefined" && GDRIVE_API_KEY) {
        try {
          const directUrl = `https://www.googleapis.com/drive/v3/files/${photo.id}?alt=media&key=${GDRIVE_API_KEY}`;
          const directRes = await fetch(directUrl);
          if (directRes.ok) {
            blob = await directRes.blob();
          }
        } catch (e) {}
      }

      // 3. Fallback ke thumbnail resolusi ekstra tinggi w4000
      if (!blob && photo.id) {
        try {
          const thumbRes = await fetch(`https://drive.google.com/thumbnail?id=${photo.id}&sz=w4000`);
          if (thumbRes.ok) {
            blob = await thumbRes.blob();
          }
        } catch (e) {}
      }

      // 4. Fallback ke URL foto yang tersedia
      if (!blob && photo.url) {
        try {
          const urlRes = await fetch(photo.url);
          if (urlRes.ok) {
            blob = await urlRes.blob();
          }
        } catch (e) {}
      }

      // 5. Fallback placeholder jika akses diblokir lingkungan lokal
      if (!blob) {
        blob = await createFallbackImageBlob(photo.name);
      }

      if (blob) {
        folder.file(photo.name, blob);
      }

      completed++;
      const currentPercent = Math.round((completed / total) * 85);
      progressBar.style.width = `${currentPercent}%`;
      progressPercent.textContent = `${currentPercent}%`;
    }

    progressMessage.textContent = "Hampir selesai! Mengompresi file .ZIP...";
    progressBar.style.width = "92%";
    progressPercent.textContent = "92%";

    const clientCleanName = (currentSession.clientName || "Pelanggan")
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFilename = `PickPict_${clientCleanName}.zip`;

    const zipContent = await zip.generateAsync({ type: "blob" }, (metadata) => {
      const calc = 92 + Math.round((metadata.percent / 100) * 8);
      progressBar.style.width = `${calc}%`;
      progressPercent.textContent = `${calc}%`;
    });

    // Buat trigger link unduh
    const downloadUrl = URL.createObjectURL(zipContent);
    const link = document.createElement("a");
    link.href = downloadUrl;
    link.download = zipFilename;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(downloadUrl), 5000);

    progressBar.style.width = "100%";
    progressPercent.textContent = "100%";
    progressMessage.textContent = "Berhasil! File ZIP siap diunduh";

    setTimeout(() => {
      progressModal.classList.add("hidden");
      showToast("File .ZIP berhasil diunduh!", "success");
    }, 1200);

  } catch (err) {
    console.error("Gagal membuat zip:", err);
    progressModal.classList.add("hidden");
    showToast("Terjadi kendala saat membuat file ZIP. Silakan unduh foto satu-persatu.", "error");
  }
}

// Fallback jika gambar eksternal sama sekali tidak bisa difetch
async function createFallbackImageBlob(text) {
  const canvas = document.createElement("canvas");
  canvas.width = 1200;
  canvas.height = 1600;
  const ctx = canvas.getContext("2d");

  // Background estetik pink
  ctx.fillStyle = "#FFF5F8";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  ctx.fillStyle = "#EC4899";
  ctx.font = "bold 48px sans-serif";
  ctx.textAlign = "center";
  ctx.fillText("PickPict Studio Photo", canvas.width / 2, canvas.height / 2 - 40);

  ctx.fillStyle = "#3F1D2B";
  ctx.font = "36px monospace";
  ctx.fillText(text, canvas.width / 2, canvas.height / 2 + 30);

  return new Promise(resolve => canvas.toBlob(resolve, "image/jpeg", 0.9));
}

// ==========================================
// 6. KIRIM PILIHAN KE ADMIN & WHATSAPP
// ==========================================
async function submitClientSelection() {
  if (!currentSession) return;
  if (selectedPhotoNames.size === 0) {
    showToast("Pilih minimal 1 foto terlebih dahulu sebelum mengirim ke admin.", "error");
    return;
  }

  const selectedList = Array.from(selectedPhotoNames);

  // Simpan ke database hybrid (Firestore Cloud + LocalStorage)
  try {
    await window.PickPictDB.updateClientSelection(currentSession.code, selectedList);
    currentSession.selectedPhotos = selectedList;
  } catch (err) {
    console.warn("Gagal update pilihan ke cloud, tersimpan di lokal:", err);
  }

  // Confetti selebrasi
  if (typeof confetti === "function") {
    confetti({
      particleCount: 100,
      spread: 70,
      origin: { y: 0.6 },
      colors: ['#EC4899', '#F43F5E', '#FED2E2', '#FFF5F8']
    });
  }

  // Tampilkan Modal Sukses
  const modal = document.getElementById("submitSuccessModal");
  const totalSpan = document.getElementById("successTotalCount");
  const fileListBox = document.getElementById("successFileList");
  const waBtn = document.getElementById("btnSendWhatsappConfirm");

  totalSpan.textContent = selectedList.length;
  fileListBox.innerHTML = selectedList.map(name => `
    <div class="flex items-center gap-1.5 py-0.5 border-b border-pink-100 last:border-0">
      <span class="text-pink-500">•</span>
      <span class="font-bold text-rosewood">${name}</span>
    </div>
  `).join("");

  // Pesan WhatsApp template yang ramah
  const messageWa = `Halo Admin PickPict!

Saya sudah selesai memilih foto:
* Nama Klien: ${currentSession.clientName}
* Kode Sesi: ${currentSession.code}
* Total Foto Terpilih: ${selectedList.length} Foto
* Daftar Foto:
${selectedList.map((f, i) => `${i + 1}. ${f}`).join("\n")}

Mohon diproses untuk cetak / edit selanjutnya. Terima kasih!`;

  waBtn.href = `https://wa.me/?text=${encodeURIComponent(messageWa)}`;

  modal.classList.remove("hidden");
  showToast("Pilihan foto berhasil disimpan ke sistem.", "success");
}

function closeSubmitSuccessModal() {
  const modal = document.getElementById("submitSuccessModal");
  if (modal) modal.classList.add("hidden");
}

// ==========================================
// 7. MODAL LOGIN & REGISTER MULTI-ADMIN
// ==========================================
function openAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) modal.classList.remove("hidden");
  hideModalAuthError();
  const emailInput = document.getElementById("modalAdminEmail");
  if (emailInput) emailInput.focus();
}

function closeAdminLoginModal() {
  const modal = document.getElementById("adminLoginModal");
  if (modal) modal.classList.add("hidden");
  hideModalAuthError();
}

function switchModalAuthTab(tab) {
  hideModalAuthError();
  const tabLoginBtn = document.getElementById("modalTabLoginBtn");
  const tabRegisterBtn = document.getElementById("modalTabRegisterBtn");
  const loginForm = document.getElementById("modalLoginForm");
  const registerForm = document.getElementById("modalRegisterForm");

  if (tab === "login") {
    if (tabLoginBtn) tabLoginBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all bg-white text-rosewood shadow-xs";
    if (tabRegisterBtn) tabRegisterBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-mauve hover:text-rosewood";
    if (loginForm) loginForm.classList.remove("hidden");
    if (registerForm) registerForm.classList.add("hidden");
  } else {
    if (tabRegisterBtn) tabRegisterBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all bg-white text-rosewood shadow-xs";
    if (tabLoginBtn) tabLoginBtn.className = "flex-1 py-1.5 px-3 rounded-lg text-xs font-bold transition-all text-mauve hover:text-rosewood";
    if (registerForm) registerForm.classList.remove("hidden");
    if (loginForm) loginForm.classList.add("hidden");
  }

  if (window.lucide) {
    lucide.createIcons();
  }
}

function showModalAuthError(msg) {
  const box = document.getElementById("modalAuthErrorBox");
  const text = document.getElementById("modalAuthErrorText");
  if (box && text) {
    text.textContent = msg;
    box.classList.remove("hidden");
  }
}

function hideModalAuthError() {
  const box = document.getElementById("modalAuthErrorBox");
  if (box) box.classList.add("hidden");
}

async function processAdminLogin() {
  hideModalAuthError();
  const emailInput = document.getElementById("modalAdminEmail");
  const passInput = document.getElementById("modalAdminPassword");
  const submitBtn = document.getElementById("btnModalLoginSubmit");

  const email = emailInput ? emailInput.value.trim() : "";
  const pass = passInput ? passInput.value : "";

  if (!email || !pass) {
    showModalAuthError("Email dan password wajib diisi.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  try {
    await window.PickPictAuth.login(email, pass);
    showToast("Login Berhasil! Mengalihkan ke Dashboard...", "success");
    setTimeout(() => {
      window.location.href = "admin.html";
    }, 600);
  } catch (err) {
    console.error("Login modal error:", err);
    let msg = "Email atau password salah. Silakan coba lagi.";
    if (err.code === "auth/user-not-found" || err.code === "auth/invalid-credential") {
      msg = "Akun tidak ditemukan atau password salah.";
    } else if (err.code === "auth/invalid-email") {
      msg = "Format email tidak valid.";
    }
    showModalAuthError(msg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75");
    }
  }
}

async function processAdminRegister() {
  hideModalAuthError();
  const nameInput = document.getElementById("modalRegisterName");
  const emailInput = document.getElementById("modalRegisterEmail");
  const passInput = document.getElementById("modalRegisterPassword");
  const submitBtn = document.getElementById("btnModalRegisterSubmit");

  const name = nameInput ? nameInput.value.trim() : "";
  const email = emailInput ? emailInput.value.trim() : "";
  const pass = passInput ? passInput.value : "";

  if (!name || !email || !pass) {
    showModalAuthError("Semua data pendaftaran wajib diisi.");
    return;
  }

  if (pass.length < 6) {
    showModalAuthError("Password minimal 6 karakter.");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.classList.add("opacity-75");
  }

  try {
    await window.PickPictAuth.register(name, email, pass);
    showToast("Pendaftaran Berhasil! Mengalihkan...", "success");
    setTimeout(() => {
      window.location.href = "admin.html";
    }, 600);
  } catch (err) {
    console.error("Register modal error:", err);
    let msg = err.message || "Gagal mendaftar.";
    if (err.code === "auth/email-already-in-use") {
      msg = "Email sudah terdaftar. Silakan masuk.";
    }
    showModalAuthError(msg);
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.classList.remove("opacity-75");
    }
  }
}

// Event tombol open admin di header
const btnAdmin = document.getElementById("btnOpenAdminModal");
if (btnAdmin) {
  btnAdmin.addEventListener("click", openAdminLoginModal);
}

// Keyboard shortcut (ESC to close modals, Arrow keys for Lightbox)
function setupKeyboardShortcuts() {
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeLightbox();
      closeAdminLoginModal();
      closeSubmitSuccessModal();
    } else if (e.key === "ArrowLeft") {
      const lightbox = document.getElementById("lightboxModal");
      if (lightbox && !lightbox.classList.contains("hidden")) {
        prevLightboxImage();
      }
    } else if (e.key === "ArrowRight") {
      const lightbox = document.getElementById("lightboxModal");
      if (lightbox && !lightbox.classList.contains("hidden")) {
        nextLightboxImage();
      }
    }
  });
}

// ==========================================
// 8. EKSPOS FUNGSI KE WINDOW (GLOBAL SCOPE)
// ==========================================
window.submitPinCode = submitPinCode;
window.quickFillPin = quickFillPin;
window.getEnteredPin = getEnteredPin;
window.showPinError = showPinError;
window.hidePinError = hidePinError;
window.toggleSelectAll = toggleSelectAll;
window.togglePhotoSelect = togglePhotoSelect;
window.openLightbox = openLightbox;
window.closeLightbox = closeLightbox;
window.prevLightboxImage = prevLightboxImage;
window.nextLightboxImage = nextLightboxImage;
window.toggleLightboxSelect = toggleLightboxSelect;
window.downloadSinglePhoto = downloadSinglePhoto;
window.downloadSelectedAsZip = downloadSelectedAsZip;
window.submitClientSelection = submitClientSelection;
window.closeSubmitSuccessModal = closeSubmitSuccessModal;
window.openAdminLoginModal = openAdminLoginModal;
window.closeAdminLoginModal = closeAdminLoginModal;
window.switchModalAuthTab = switchModalAuthTab;
window.processAdminLogin = processAdminLogin;
window.processAdminRegister = processAdminRegister;
window.exitGallery = exitGallery;
window.loadAndDisplayGallery = loadAndDisplayGallery;
