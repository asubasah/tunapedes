require("dotenv").config();
const express = require("express");
const cors = require("cors");
const axios = require("axios");
const mysql = require("mysql2/promise");

const fs = require("fs");
const path = require("path");

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3002;
const GOWA_URL = process.env.GOWA_URL || "http://localhost:3000";

// MySQL Connection Pool
const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
});

// ==========================================
// 1. GOWA ENDPOINTS (MENGAMBIL QR & STATUS)
// ==========================================

// Meminta Barcode Login WA per cabang
app.post("/api/gowa/start/:cabang", async (req, res) => {
  const { cabang } = req.params;
  const deviceId = `fitmotor_${cabang}`;
  try {
    // 1. Tambahkan device jika belum ada
    try {
      await axios.post(`${GOWA_URL}/devices`, { device_id: deviceId });
    } catch (e) {
      // Abaikan jika device sudah ada
    }

    // 2. Dapatkan QR Code URL
    const response = await axios.get(`${GOWA_URL}/app/login`, {
      headers: { "X-Device-Id": deviceId }
    });
    
    // Kembalikan objek yang sama sesuai format frontend lama: { data: { qr: "url_link" } }
    res.json({ data: { qr: response.data.results.qr_link } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Cek status session (Apakah sudah login atau masih QR)
app.get("/api/gowa/status/:cabang", async (req, res) => {
  const { cabang } = req.params;
  const deviceId = `fitmotor_${cabang}`;
  try {
    const response = await axios.get(`${GOWA_URL}/app/status`, {
      headers: { "X-Device-Id": deviceId }
    });
    
    // { results: { is_connected: true, is_logged_in: true } }
    const st = response.data.results.is_logged_in ? "CONNECTED" : "DISCONNECTED";
    res.json({ data: { status: st } });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Logout Cabang
app.delete("/api/gowa/logout/:cabang", async (req, res) => {
  const { cabang } = req.params;
  const deviceId = `fitmotor_${cabang}`;
  try {
    const response = await axios.get(`${GOWA_URL}/app/logout`, {
      headers: { "X-Device-Id": deviceId }
    });
    res.json(response.data);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// ==========================================
// 1.2 WEBHOOK PROXY (TRANSLATE JID TO DEVICE_ID)
// ==========================================
app.post("/webhook/gowa", async (req, res) => {
  try {
    const payload = req.body;
    const incomingJid = payload.device_id;
    
    const devicesRes = await axios.get(`${GOWA_URL}/devices`);
    const devices = devicesRes.data.results || [];
    const matchedDevice = devices.find(d => d.jid === incomingJid || d.id === incomingJid);
    
    if (matchedDevice) {
      payload.device_id = matchedDevice.id;
    }

    // Forward to n8n main router
    await axios.post("http://localhost:5678/webhook/gowa", payload);
    
    res.status(200).send("OK");
  } catch (error) {
    console.error("Webhook proxy error:", error.message);
    res.status(500).send("Error");
  }
});

// ==========================================
// 1.5 AUTHENTICATION & CREDENTIALS
// ==========================================

const USERS_FILE = path.join(__dirname, "users.json");

function getUsers() {
  return JSON.parse(fs.readFileSync(USERS_FILE, "utf8"));
}

function saveUsers(users) {
  fs.writeFileSync(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

app.post("/api/auth/login", (req, res) => {
  const { username, password } = req.body;
  const users = getUsers();
  const user = users.find(u => u.username === username && u.password === password);
  
  if (user) {
    res.json({ success: true, user: { username: user.username, role: user.role, cabang: user.cabang } });
  } else {
    res.status(401).json({ success: false, error: "Username atau Password Salah!" });
  }
});

app.get("/api/auth/users", (req, res) => {
  // Hanya dipanggil master
  const users = getUsers().filter(u => u.role !== "master");
  // Jangan kirim plaintext password ke UI public, tapi karena ini Master Control Panel lokal, tidak apa-apa
  res.json(users);
});

app.post("/api/auth/update", (req, res) => {
  const { username, newPassword } = req.body;
  const users = getUsers();
  const index = users.findIndex(u => u.username === username);
  
  if (index !== -1) {
    users[index].password = newPassword;
    saveUsers(users);
    res.json({ success: true, message: `Password ${username} berhasil diubah!` });
  } else {
    res.status(404).json({ success: false, error: "User tidak ditemukan" });
  }
});

// ==========================================
// 2. KANBAN BOOKING ENDPOINTS (MYSQL DATA)
// ==========================================

// Ambil semua booking hari ini / pending
app.get("/api/bookings", async (req, res) => {
  try {
    const [rows] = await pool.query(
      `SELECT b.*, p.nama, p.motor as pelanggan_motor 
       FROM booking b 
       LEFT JOIN pelanggan p ON b.nomor_wa = p.nomor_wa 
       ORDER BY b.created_at DESC LIMIT 100`
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update Status Booking (misal dari pending -> proses -> selesai)
app.put("/api/bookings/:id/status", async (req, res) => {
  const bookingId = req.params.id; // berupa string BKG-xxxx
  const { status } = req.body;
  
  if (!['pending', 'proses', 'selesai'].includes(status)) {
    return res.status(400).json({ error: "Invalid status parameter" });
  }

  try {
    const [result] = await pool.query(
      "UPDATE booking SET status = ? WHERE id = ?",
      [status, bookingId]
    );

    if (result.affectedRows === 0) {
      return res.status(404).json({ error: "Booking not found" });
    }
    
    // Notification Logic
    if (status === 'proses' || status === 'selesai') {
      try {
        const [rows] = await pool.query(
          `SELECT b.nomor_wa, b.nopol, b.layanan, b.cabang_id, c.nama as cabang_nama, c.device_id 
           FROM booking b JOIN cabang c ON b.cabang_id = c.id WHERE b.id = ?`,
          [bookingId]
        );
        
        if (rows.length > 0) {
          const data = rows[0];
          let msg = '';
          
          if (status === 'proses') {
            msg = `🔧 *UPDATE SERVIS*\n\nHalo kak, Kode Booking *${bookingId}* dengan nopol *${data.nopol}* saat ini sudah *dalam proses pengerjaan* oleh mekanik ahli kami di FitMotor cabang *${data.cabang_nama}*.\n\nLayanan: ${data.layanan}\n\nKami kerjakan dengan teliti ya kak. Tunggu info WA selanjutnya jika sudah selesai! 🛠️`;
          } else if (status === 'selesai') {
            msg = `✅ *SERVIS SELESAI*\n\nYey! Kode Booking *${bookingId}* untuk kendaraan *${data.nopol}* sudah selesai dikerjakan dengan mantap di FitMotor cabang *${data.cabang_nama}*.\n\nMotor sudah bisa diambil sekarang kak. Terima kasih sudah mempercayakan perawatan motornya kepada kami! Jika ada kendala, jangan ragu hubungi kembali.🙏`;
          }
          
          // Trigger GoWA
          await axios.post(`${GOWA_URL}/send/message`, {
            phone: data.nomor_wa,
            message: msg
          }, {
            headers: { 'X-Device-Id': data.device_id }
          }).catch(err => {
            console.error("Gagal kirim notif WA:", err.response ? err.response.data : err.message);
          });

          // =====================================================
          // AUTO-INSERT ke riwayat_servis saat servis SELESAI
          // (Trigger data source untuk fitur periodic follow-up H+1/30/90/180)
          // INSERT IGNORE agar idempoten — aman jika Kanban di-drag ulang
          // =====================================================
          if (status === 'selesai') {
            await pool.query(
              `INSERT IGNORE INTO riwayat_servis 
                 (nopol, nomor_wa, cabang_id, tanggal, jenis_servis, booking_id)
               VALUES (?, ?, ?, CURDATE(), ?, ?)`,
              [data.nopol, data.nomor_wa, data.cabang_id, data.layanan, bookingId]
            ).catch(err => {
              console.error("Gagal insert riwayat_servis:", err.message);
            });
            console.log(`[riwayat_servis] Record created for booking ${bookingId}`);
          }
        }
      } catch (err) {
        console.error("Error trigger WA notif:", err);
      }
    }
    
    res.json({ message: `Status updated to ${status}` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({ status: "API Bridge is Active!" });
});

app.listen(PORT, () => {
  console.log(`Backend API berjalan di http://localhost:${PORT}`);
});
