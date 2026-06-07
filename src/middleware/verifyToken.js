// middleware/verifyToken.js
const jwt = require("jsonwebtoken");

function verifyToken(req, res, next) {
  try {
    const authHeader = req.headers["authorization"];
    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      return res.status(401).json({
        message: "Akses ditolak: Token tidak ditemukan atau format salah",
      });
    }

    const token = authHeader.split(" ")[1];
    const jwtSecret = process.env.JWT_SECRET || "dummy_secret_key_123";
    const decoded = jwt.verify(token, jwtSecret);

    console.log("✅ Token decoded:", decoded); // ⬅️ tambahkan ini

    req.user = decoded;
    next();
  } catch (error) {
    console.error("JWT Verification Error:", error.message);
    return res.status(403).json({
      message: "Token tidak valid atau sudah kedaluwarsa",
    });
  }
}

function verifyAdmin(req, res, next) {
  console.log("🔎 Checking admin:", req.user); // ⬅️ tambahkan ini
  if (req.user && req.user.role === "admin") {
    return next();
  }
  return res
    .status(403)
    .json({ message: "Akses ditolak: hanya admin yang boleh melakukan ini" });
}

module.exports = { verifyToken, verifyAdmin };
