const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

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

// ✅ CREATE Parwa (Admin only)
exports.createParwa = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak: hanya admin" });
    }

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

    const newParwa = await prisma.parwa.create({
      data: { 
        book, 
        sub_parva, 
        section, 
        judul, 
        url, 
        isi, 
        isi_id,
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

// ✅ UPDATE Parwa (Admin only)
exports.updateParwa = async (req, res) => {
  try {
    if (req.user.role !== "admin") {
      return res.status(403).json({ message: "Akses ditolak: hanya admin" });
    }

    const id = parseInt(req.params.id);
    const { book, sub_parva, section, judul, url, isi, isi_id, versionId, versionName } = req.body;

    const parwa = await prisma.parwa.findUnique({ where: { id } });
    if (!parwa)
      return res.status(404).json({ message: "Parwa tidak ditemukan" });

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

    const updated = await prisma.parwa.update({
      where: { id },
      data: { 
        book, 
        sub_parva, 
        section, 
        judul, 
        url, 
        isi, 
        isi_id,
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

// ✅ DELETE Parwa (Admin and Authenticated Users)
exports.deleteParwa = async (req, res) => {
  try {
    const id = parseInt(req.params.id);
    const parwa = await prisma.parwa.findUnique({ where: { id } });
    if (!parwa)
      return res.status(404).json({ message: "Parwa tidak ditemukan" });

    await prisma.parwa.delete({ where: { id } });

    res.json({ message: "Parwa berhasil dihapus" });
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