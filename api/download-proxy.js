// api/download-proxy.js - Vercel Serverless Function
// Proxy unduhan file resolusi asli 100% untuk menghindari pemblokiran CORS saat membuat file ZIP di browser

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader("Access-Control-Allow-Origin", "*");
  res.setHeader("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.setHeader("Access-Control-Allow-Headers", "Content-Type");

  if (req.method === "OPTIONS") {
    return res.status(200).end();
  }

  const { fileId, url, name } = req.query;
  const apiKey = process.env.GDRIVE_API_KEY || "";

  let targetUrl = "";
  if (fileId) {
    if (apiKey) {
      // Ambil file ukuran asli 100% (Original Full Resolution) dari Google Drive API
      targetUrl = `https://www.googleapis.com/drive/v3/files/${encodeURIComponent(fileId)}?alt=media&key=${apiKey}`;
    } else {
      // Fallback resolusi ekstra tinggi w4000 jika key belum disetel
      targetUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w4000`;
    }
  } else if (url && typeof url === "string") {
    targetUrl = url;
  } else {
    return res.status(400).json({ error: "Parameter fileId atau url wajib diisi." });
  }

  try {
    const parsedUrl = new URL(targetUrl);
    if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
      return res.status(400).json({ error: "Protokol URL tidak valid." });
    }

    const response = await fetch(targetUrl, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      }
    });

    let fetchRes = response;
    // Jika targetUrl alt=media gagal dan ada fileId, fallback ke resolusi ekstra tinggi w4000
    if (!fetchRes.ok && fileId) {
      try {
        const fallbackUrl = `https://drive.google.com/thumbnail?id=${encodeURIComponent(fileId)}&sz=w4000`;
        const fbRes = await fetch(fallbackUrl, {
          headers: {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
          }
        });
        if (fbRes.ok) {
          fetchRes = fbRes;
        }
      } catch (fbErr) {
        console.warn("Fallback download proxy failed:", fbErr);
      }
    }

    if (!fetchRes.ok) {
      return res.status(fetchRes.status).json({
        error: `Gagal mengunduh file asli dari Google Drive (Status: ${fetchRes.status}).`
      });
    }

    const contentType = fetchRes.headers.get("content-type") || "image/jpeg";
    res.setHeader("Content-Type", contentType);
    res.setHeader("Cache-Control", "public, max-age=86400, s-maxage=86400");

    if (name) {
      res.setHeader("Content-Disposition", `attachment; filename="${encodeURIComponent(name)}"`);
    }

    const arrayBuffer = await fetchRes.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return res.status(200).send(buffer);
  } catch (error) {
    console.error("Download proxy error:", error);
    return res.status(500).json({
      error: "Terjadi kesalahan server saat mengambil file asli.",
      details: error.message
    });
  }
}
