const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
const { translateText } = require("../utils/translator");

// ✅ GET all Parwa (dengan pagination)
exports.getAllParwa = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = Math.min(parseInt(req.query.limit) || 10, 100);
    const skip = (page - 1) * limit;

    const [total, items] = await Promise.all([
      prisma.parwa.count(),
      prisma.parwa.findMany({
        skip,
        take: limit,
        orderBy: { createdAt: "desc" },
        select: {
          id: true,
          book: true,
          sub_parva: true,
          section: true,
          judul: true,
          url: true,
          isi: true,
          createdAt: true,
        },
      }),
    ]);

    res.json({ total, page, limit, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ [FUNGSI BARU] Mengambil daftar nama Versi
exports.getVersions = async (req, res) => {
  try {
    const versions = await prisma.version.findMany({
      orderBy: { id: "asc" },
    });
    
    const data = versions.map(v => v.name);
    
    res.json({ data: data });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ [UPDATE] Tarik kategori Parwa berdasarkan Versi + Link Gambar
exports.getParwaCategories = async (req, res) => {
  try {
    const { version } = req.query; 

    let filter = {}; 

    if (version) {
      const versionData = await prisma.version.findUnique({
        where: { name: version }
      });
      
      if (versionData) {
        filter = { versionId: versionData.id };
      }
    }

    const categories = await prisma.parwa.findMany({
      where: filter,
      distinct: ["book"], 
      select: { book: true },
      orderBy: { id: "asc" }, 
    });

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";

    const dataWithImages = categories.map(item => {
      const formatFileName = item.book.toLowerCase().replace(/\s+/g, '-') + '.png';
      
      return {
        book: item.book,
        imageUrl: `${baseUrl}/${formatFileName}` 
      };
    });

    res.json({
      message: "Kategori Parwa berhasil diambil",
      data: dataWithImages,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET detail Parwa by ID
exports.getParwaById = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parwa = await prisma.parwa.findUnique({ where: { id } });

    if (!parwa) return res.status(404).json({ message: "Parwa not found" });
    res.json(parwa);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ SEARCH Parwa
exports.searchParwa = async (req, res) => {
  try {
    const q = req.query.q || "";
    if (!q)
      return res.status(400).json({ message: "Query parameter q is required" });

    const items = await prisma.parwa.findMany({
      where: {
        OR: [
          { judul: { contains: q, mode: "insensitive" } },
          { book: { contains: q, mode: "insensitive" } },
          { isi: { contains: q, mode: "insensitive" } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 50,
    });

    res.json({ total: items.length, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ CREATE Parwa (Admin and Authenticated Users)
exports.createParwa = async (req, res) => {
  try {
    const { book, sub_parva, section, judul, url, isi, isi_id, versionId, versionName } = req.body;

    let targetVersionId = versionId ? parseInt(versionId) : null;

    if (!targetVersionId) {
      let resolvedVerName = versionName;
      if (!resolvedVerName && judul) {
        // Try parsing from judul: "{Book} - {Version}, tr. - {Section}"
        if (judul.includes(", tr.")) {
          const parts = judul.split(" - ");
          if (parts.length >= 2) {
            const verPart = parts[1];
            const verSubParts = verPart.split(", tr.");
            resolvedVerName = verSubParts[0].trim();
          }
        } else {
          // Format 2 fallback: "{Book} Sec {Num} - {Version}"
          const parts = judul.split(" - ");
          if (parts.length >= 2) {
            resolvedVerName = parts[parts.length - 1].trim();
          }
        }
      }

      if (resolvedVerName) {
        let versionRecord = await prisma.version.findUnique({
          where: { name: resolvedVerName }
        });
        if (!versionRecord) {
          versionRecord = await prisma.version.create({
            data: { name: resolvedVerName }
          });
        }
        targetVersionId = versionRecord.id;
      }
    }

    // Default fallback if no versionId could be resolved
    if (!targetVersionId) {
      const firstVersion = await prisma.version.findFirst({ orderBy: { id: "asc" } });
      targetVersionId = firstVersion ? firstVersion.id : 1;
    }

    let finalIsi = isi || "-";
    let finalIsiId = isi_id || "-";

    // Auto-translation logic:
    if (finalIsiId && finalIsiId !== "-" && (!finalIsi || finalIsi === "-")) {
      console.log("Auto-translating ID to EN...");
      finalIsi = await translateText(finalIsiId, "id", "en");
    } else if (finalIsi && finalIsi !== "-" && (!finalIsiId || finalIsiId === "-")) {
      console.log("Auto-translating EN to ID...");
      finalIsiId = await translateText(finalIsi, "en", "id");
    }

    // Determine status
    let finalStatus = req.body.status || "pending";
    if (req.user.role === "user") {
      finalStatus = "pending";
    } else if (req.user.role === "admin" || req.user.role === "narasumber") {
      finalStatus = req.body.status || "approved";
    }

    const finalUserId = req.user ? req.user.id : null;

    const newParwa = await prisma.parwa.create({
      data: { 
        book, 
        sub_parva, 
        section, 
        judul, 
        url, 
        isi: finalIsi, 
        isi_id: finalIsiId,
        status: finalStatus,
        userId: finalUserId,
        versionId: targetVersionId
      },
    });

    res.status(201).json({
      message: "Parwa berhasil ditambahkan",
      data: newParwa,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ UPDATE Parwa (Admin and Owners)
exports.updateParwa = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const { book, sub_parva, section, judul, url, isi, isi_id, versionId, versionName } = req.body;

    const parwa = await prisma.parwa.findUnique({ where: { id } });
    if (!parwa)
      return res.status(404).json({ message: "Parwa tidak ditemukan" });

    // Validate ownership: only admin or owner can update
    if (req.user.role !== "admin" && parwa.userId !== req.user.id) {
      return res.status(403).json({ message: "Akses ditolak: Anda tidak memiliki hak untuk mengubah cerita ini" });
    }

    let targetVersionId = versionId ? parseInt(versionId) : parwa.versionId;

    if (!versionId) {
      let resolvedVerName = versionName;
      if (!resolvedVerName && judul && judul !== parwa.judul) {
        if (judul.includes(", tr.")) {
          const parts = judul.split(" - ");
          if (parts.length >= 2) {
            const verPart = parts[1];
            const verSubParts = verPart.split(", tr.");
            resolvedVerName = verSubParts[0].trim();
          }
        } else {
          const parts = judul.split(" - ");
          if (parts.length >= 2) {
            resolvedVerName = parts[parts.length - 1].trim();
          }
        }
      }

      if (resolvedVerName) {
        let versionRecord = await prisma.version.findUnique({
          where: { name: resolvedVerName }
        });
        if (!versionRecord) {
          versionRecord = await prisma.version.create({
            data: { name: resolvedVerName }
          });
        }
        targetVersionId = versionRecord.id;
      }
    }

    let finalIsi = isi !== undefined ? isi : parwa.isi;
    let finalIsiId = isi_id !== undefined ? isi_id : parwa.isi_id;

    // Auto-translation logic on update:
    if (isi_id !== undefined && isi_id !== "-" && (isi === undefined || isi === "-")) {
      console.log("Auto-translating ID to EN on update...");
      finalIsi = await translateText(isi_id, "id", "en");
    } else if (isi !== undefined && isi !== "-" && (isi_id === undefined || isi_id === "-")) {
      console.log("Auto-translating EN to ID on update...");
      finalIsiId = await translateText(isi, "en", "id");
    }

    // Determine status
    let finalStatus = req.body.status !== undefined ? req.body.status : parwa.status;
    if (req.user.role === "user") {
      finalStatus = "pending";
    }

    const updated = await prisma.parwa.update({
      where: { id },
      data: { 
        book, 
        sub_parva, 
        section, 
        judul, 
        url, 
        isi: finalIsi, 
        isi_id: finalIsiId,
        status: finalStatus,
        versionId: targetVersionId
      },
    });

    res.json({
      message: "Parwa berhasil diperbarui",
      data: updated,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ DELETE Parwa (Admin and Owners)
exports.deleteParwa = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parwa = await prisma.parwa.findUnique({ where: { id } });
    if (!parwa)
      return res.status(404).json({ message: "Parwa tidak ditemukan" });

    // Validate ownership: only admin or owner can delete
    if (req.user.role !== "admin" && parwa.userId !== req.user.id) {
      return res.status(403).json({ message: "Akses ditolak: Anda tidak memiliki hak untuk menghapus cerita ini" });
    }

    await prisma.parwa.delete({ where: { id } });

    res.json({ message: "Parwa berhasil dihapus" });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ GET User Uploads
exports.getUserUploads = async (req, res) => {
  try {
    const userId = req.user.id;
    const items = await prisma.parwa.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        book: true,
        sub_parva: true,
        section: true,
        judul: true,
        url: true,
        isi: true,
        isi_id: true,
        status: true,
        createdAt: true,
      },
    });

    res.json({ total: items.length, items });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ [UPDATE] GET Sections by Book & Version
exports.getSectionsByBook = async (req, res) => {
  try {
    const { bookName } = req.params;
    const { version } = req.query; // Tangkap param versi dari URL

    let versionFilter = {};

    if (version) {
      const v = await prisma.version.findUnique({ where: { name: version } });
      if (v) {
        versionFilter = { versionId: v.id };
      }
    }

    const sections = await prisma.parwa.findMany({
      where: {
        book: bookName,
        ...versionFilter // Filter berdasarkan buku DAN versi
      },
      distinct: ["section"], 
      select: {
        section: true,
        sub_parva: true, 
      },
      orderBy: {
        id: "asc", 
      },
    });

    res.json({
      message: `Daftar Section untuk ${bookName} berhasil diambil`,
      total: sections.length,
      data: sections,
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};

// ✅ [UPDATE] GET Content by Section & Version
exports.getContentBySection = async (req, res) => {
  try {
    const { bookName, sectionName } = req.params;
    const { version } = req.query; // Tangkap param versi dari URL

    let versionFilter = {};

    if (version) {
      const v = await prisma.version.findUnique({ where: { name: version } });
      if (v) {
        versionFilter = { versionId: v.id };
      }
    }

    const items = await prisma.parwa.findMany({
      where: {
        book: bookName,
        section: sectionName,
        ...versionFilter // Filter berdasarkan buku, section, DAN versi
      },
      select: {
        id: true,
        judul: true, 
        isi: true,   
        isi_id: true,
        url: true
      },
      orderBy: {
        id: 'asc' 
      }
    });

    if (items.length === 0) {
        return res.status(404).json({ message: "Data tidak ditemukan" });
    }

    res.json({
      message: "Isi berhasil diambil",
      data: items
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server error" });
  }
};