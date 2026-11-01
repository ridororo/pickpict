// api/drive-files.js - Vercel Serverless Function
// Mengambil daftar file foto dari Google Drive Folder ID menggunakan Google Drive API v3
// Dilengkapi pagination loop (nextPageToken) dan pageSize=1000 agar semua foto terambil tuntas

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { folderId } = req.query;
  const apiKey = process.env.GDRIVE_API_KEY;

  if (!apiKey) {
    return res.status(500).json({
      success: false,
      folderId,
      message: "GDRIVE_API_KEY belum dikonfigurasi di Environment Variables server.",
      total: 0,
      files: []
    });
  }

  if (!folderId) {
    return res.status(400).json({
      success: false,
      message: "Folder ID Google Drive tidak ditemukan dalam parameter request."
    });
  }

  try {
    const query = encodeURIComponent(`'${folderId}' in parents and trashed = false and mimeType contains 'image/'`);
    const fields = encodeURIComponent('nextPageToken,files(id, name, mimeType, thumbnailLink, webContentLink, size, imageMediaMetadata)');

    let allRawFiles = [];
    let pageToken = null;
    let pageCount = 0;
    const maxPages = 50; // Pengaman maksimal hingga 50.000 file foto

    do {
      let url = `https://www.googleapis.com/drive/v3/files?q=${query}&fields=${fields}&orderBy=name&pageSize=1000&key=${apiKey}`;
      if (pageToken) {
        url += `&pageToken=${encodeURIComponent(pageToken)}`;
      }

      const response = await fetch(url);
      if (!response.ok) {
        const errText = await response.text();
        console.warn("Google Drive API response error:", errText);
        if (allRawFiles.length === 0) {
          return res.status(200).json({
            success: false,
            folderId,
            message: "Google Drive API mengembalikan respon error atau folder tidak dapat diakses publik.",
            total: 0,
            files: []
          });
        }
        break;
      }

      const data = await response.json();
      if (data.files && Array.isArray(data.files)) {
        allRawFiles.push(...data.files);
      }

      pageToken = data.nextPageToken || null;
      pageCount++;
    } while (pageToken && pageCount < maxPages);

    // Natural sort agar urutan foto rapi dan berurutan
    allRawFiles.sort((a, b) =>
      (a.name || "").localeCompare(b.name || "", undefined, { numeric: true, sensitivity: "base" })
    );

    const driveFiles = allRawFiles.map((file, index) => {
      // 1. Tampilan Grid Galeri: Thumbnail w1600 (tajam di layar Retina/HP)
      const gridUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w1600`;

      // 2. Tampilan Zoom / Lightbox Fullscreen: Resolusi ekstra tinggi w4000
      const zoomUrl = `https://drive.google.com/thumbnail?id=${file.id}&sz=w4000`;

      // 3. Fitur Download (Satuan & ZIP): Endpoint Google Drive API Original Full Resolution 100%
      const originalDownloadUrl = `https://www.googleapis.com/drive/v3/files/${file.id}?alt=media&key=${apiKey}`;

      const sizeFormatted = file.size
        ? `${(parseInt(file.size, 10) / (1024 * 1024)).toFixed(1)} MB`
        : "Foto Asli";

      return {
        id: file.id,
        name: file.name || `FOTO_${index + 1}.JPG`,
        gridUrl: gridUrl,
        zoomUrl: zoomUrl,
        url: gridUrl, // Default URL untuk kompatibilitas tampilan
        thumbnailUrl: gridUrl,
        downloadUrl: `/api/download-proxy?fileId=${file.id}&name=${encodeURIComponent(file.name || `FOTO_${index + 1}.JPG`)}`,
        originalDownloadUrl: originalDownloadUrl,
        size: sizeFormatted
      };
    });

    return res.status(200).json({
      success: true,
      source: "google_drive",
      folderId,
      total: driveFiles.length,
      files: driveFiles
    });
  } catch (error) {
    console.error("Error fetching from Google Drive API:", error);
    return res.status(200).json({
      success: false,
      folderId,
      message: "Terjadi gangguan koneksi ke Google Drive API.",
      total: 0,
      files: []
    });
  }
}
