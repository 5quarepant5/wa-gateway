const express = require("express");
const {
  default: makeWASocket,
  useMultiFileAuthState,
  fetchLatestBaileysVersion
} = require("@whiskeysockets/baileys");
const qrcode = require("qrcode-terminal");
const cors = require("cors");
const path = require("path");

const app = express();
const PORT = 3000;

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

let sock; // Socket WhatsApp (global)

// Fungsi untuk memulai koneksi Baileys
async function startBaileys() {
  const { state, saveCreds } = await useMultiFileAuthState("auth_info_baileys");
  const { version } = await fetchLatestBaileysVersion();

  sock = makeWASocket({
    version,
    auth: state,
  });

  sock.ev.on("creds.update", saveCreds);

  sock.ev.on("connection.update", ({ connection, lastDisconnect, qr }) => {
    if (qr) {
      console.log("🔑 Scan QR ini untuk login:");
      qrcode.generate(qr, { small: true });
    }

    if (connection === "close") {
      console.log("❌ Koneksi ditutup. Mencoba ulang...");
      startBaileys();
    } else if (connection === "open") {
      console.log("✅ Terhubung ke WhatsApp.");
    }
  });
}

startBaileys();

// Endpoint test preflight CORS
app.options("/api/kirim", (req, res) => {
  res.sendStatus(200);
});

// Endpoint utama kirim pesan WA
app.post("/api/kirim", async (req, res) => {
  const { nomor, pesan } = req.body;

  if (!nomor || !pesan) {
    return res.status(400).json({ success: false, error: "Nomor dan pesan wajib diisi." });
  }

  const jid = nomor + "@s.whatsapp.net";

  try {
    // Validasi nomor WhatsApp
    const isOnWA = await sock.onWhatsApp(nomor);
    if (!isOnWA || !isOnWA[0]?.exists) {
      return res.status(400).json({ success: false, error: "Nomor tidak terdaftar di WhatsApp." });
    }

    console.log(`⏳ Menunggu 3 detik sebelum kirim ke ${nomor}...`);
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Kirim pesan teks
    await sock.sendMessage(jid, { text: pesan });
    console.log(`✅ Pesan berhasil dikirim ke ${nomor}`);

    res.json({ success: true, message: "Pesan berhasil dikirim!" });
  } catch (err) {
    console.error("❌ Gagal kirim pesan:", err);
    res.status(500).json({ success: false, error: "Terjadi kesalahan saat mengirim pesan." });
  }
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 Server aktif di http://localhost:${PORT}`);
});
