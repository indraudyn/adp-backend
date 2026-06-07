const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const nodemailer = require("nodemailer");
const axios = require("axios");

const prisma = new PrismaClient();


// REGISTER USER
exports.register = async (req, res) => {
  try {
    const { name, email, password } = req.body;

    if (!name || !email || !password)
      return res.status(400).json({ message: "Semua field wajib diisi" });

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser)
      return res.status(400).json({ message: "Email sudah terdaftar" });

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = await prisma.user.create({
      data: { name, email, password: hashedPassword },
      select: { id: true, name: true, email: true, createdAt: true },
    });

    res.status(201).json({ message: "Registrasi berhasil", user });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Terjadi kesalahan server" });
  }
};

// LOGIN USER
exports.login = async (req, res) => {
  console.log("➡️ [1] Masuk ke fungsi Login Controller");
  try {
    const { email, password } = req.body;
    console.log(`➡️ [2] Data diterima: ${email}`);

    // --- CHECKPOINT 1: DATABASE ---
    console.log("➡️ [3] Sedang mencari user di Database (Prisma)...");
    const user = await prisma.user.findUnique({ where: { email } });
    console.log(
      "✅ [4] Selesai cari user via Prisma. Hasil:",
      user ? "Ketemu" : "NULL"
    );

    if (!user) {
      console.log("❌ [User Tidak Ditemukan]");
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    // --- CHECKPOINT 2: PASSWORD ---
    console.log("➡️ [5] Sedang membandingkan password (Bcrypt)...");
    const isPasswordValid = await bcrypt.compare(password, user.password);
    console.log("✅ [6] Hasil cek password:", isPasswordValid);

    if (!isPasswordValid) {
      console.log("❌ [Password Salah]");
      return res.status(401).json({ message: "Password salah" });
    }

    // --- CHECKPOINT 3: TOKEN ---
    console.log("➡️ [7] Sedang membuat JWT Token...");
    const jwtSecret = process.env.JWT_SECRET || "dummy_secret_key_123";

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: "1d" }
    );
    console.log("✅ [8] Token berhasil dibuat");

    console.log("🚀 [9] Mengirim respon ke Client");
    res.json({
      message: "Login berhasil",
      token,
      user: { id: user.id, name: user.name, email: user.email },
    });
  } catch (error) {
    console.error("❌ [ERROR DI LOGIN]:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan server", error: error.message });
  }
};

// ==========================================
// 1. FORGOT PASSWORD (Generate & Kirim OTP)
// ==========================================
exports.forgotPassword = async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: "Email wajib diisi" });

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "Email tidak terdaftar" });

    // Generate 6 digit angka acak (100000 - 999999)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    
    // Set waktu kedaluwarsa (15 menit dari sekarang)
    const expiry = new Date(Date.now() + 15 * 60 * 1000);

    // Simpan OTP ke database user tersebut
    await prisma.user.update({
      where: { email },
      data: { resetOtp: otp, resetOtpExpiry: expiry }
    });

    // Desain Template Email (HTML & CSS)
    const mailOptions = {
      from: `"Asisten Asta Dasa Parwa" <${process.env.EMAIL_USER}>`,
      to: email,
      subject: "Kode Pemulihan Password - Asta Dasa Parwa",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 20px; border: 1px solid #ddd; border-radius: 10px;">
          <h2 style="color: #7B1FA2; text-align: center;">Asta Dasa Parwa</h2>
          <p>Halo <b>${user.name}</b>,</p>
          <p>Kami menerima permintaan untuk mengatur ulang sandi akun Anda. Berikut adalah kode OTP pemulihan Anda:</p>
          <div style="text-align: center; margin: 30px 0;">
            <span style="font-size: 32px; font-weight: bold; background-color: #f4f4f4; padding: 10px 20px; border-radius: 8px; letter-spacing: 5px;">${otp}</span>
          </div>
          <p style="color: red; font-size: 14px; text-align: center;"><i>Kode ini hanya berlaku selama 15 menit. Jangan berikan kode ini kepada siapa pun!</i></p>
          <hr style="border: none; border-top: 1px solid #eee; margin: 20px 0;">
          <p style="font-size: 12px; color: #888; text-align: center;">Jika Anda tidak merasa melakukan permintaan ini, abaikan pesan ini.</p>
        </div>
      `
    };

   const emailData = {
      sender: {
        name: "Asisten Asta Dasa Parwa",
        email: process.env.EMAIL_USER // Email yang terdaftar di Brevo
      },
      to: [
        { email: email, name: user.name }
      ],
      subject: "Kode Pemulihan Password - Asta Dasa Parwa",
      htmlContent: mailOptions.html // Mengambil template HTML buatanmu di atas
    };

    // [BARU] Eksekusi pengiriman email menggunakan jalur HTTP (API)
    await axios.post("https://api.brevo.com/v3/smtp/email", emailData, {
      headers: {
        "accept": "application/json",
        "api-key": process.env.BREVO_API_KEY, // Mengambil API Key dari Railway
        "content-type": "application/json"
      }
    });

    res.json({ message: "Kode OTP pemulihan telah dikirim ke email Anda via API" });

  } catch (error) {
    // Menangkap error spesifik dari axios jika ada
    console.error("Error di forgotPassword:", error.response?.data || error.message);
    res.status(500).json({ message: "Gagal mengirim email OTP" });
  }
};

// ==========================================
// 2. RESET PASSWORD (Validasi OTP & Ganti Password)
// ==========================================
exports.resetPassword = async (req, res) => {
  try {
    const { email, otp, newPassword } = req.body;

    if (!email || !otp || !newPassword) {
      return res.status(400).json({ message: "Data tidak lengkap" });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) return res.status(404).json({ message: "User tidak ditemukan" });

    // Cek apakah OTP cocok
    if (user.resetOtp !== otp) {
      return res.status(400).json({ message: "Kode OTP salah" });
    }

    // Cek apakah OTP sudah basi/kedaluwarsa
    if (new Date() > new Date(user.resetOtpExpiry)) {
      return res.status(400).json({ message: "Kode OTP sudah kedaluwarsa, silakan minta ulang" });
    }

    // Hash password baru
    const hashedPassword = await bcrypt.hash(newPassword, 10);

    // Update password di database & hapus OTP agar tidak bisa dipakai 2 kali
    await prisma.user.update({
      where: { email },
      data: {
        password: hashedPassword,
        resetOtp: null,
        resetOtpExpiry: null
      }
    });

    res.json({ message: "Password berhasil diubah, silakan login dengan password baru" });

  } catch (error) {
    console.error("Error di resetPassword:", error);
    res.status(500).json({ message: "Gagal mereset password" });
  }
};
