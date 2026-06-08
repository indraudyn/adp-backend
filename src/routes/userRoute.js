// routes/userRoute.js
const express = require("express");
const { PrismaClient } = require("@prisma/client");
const { verifyToken } = require("../middleware/verifyToken");
const { updateProfile } = require("../controllers/userController");

const router = express.Router();
const prisma = new PrismaClient();

// ✅ GET profile user (hanya untuk user login)
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: { id: true, name: true, email: true, role: true, createdAt: true },
    });

    if (!user) {
      return res.status(404).json({ message: "User tidak ditemukan" });
    }

    res.status(200).json({
      message: "Profil pengguna berhasil diambil",
      data: user,
    });
  } catch (error) {
    console.error("Error saat mengambil profil:", error);
    res
      .status(500)
      .json({ message: "Terjadi kesalahan server", error: error.message });
  }
});

router.put("/update", verifyToken, updateProfile);

module.exports = router;
