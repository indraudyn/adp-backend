const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const OLD_API_URL = "https://astadasaparwa-backend-production.up.railway.app/api";

async function main() {
  console.log("Memulai migrasi data dari API lama...");

  // 1. Ambil dan migrasikan Versi
  console.log("Mengambil data Versi...");
  const versionsResp = await fetch(`${OLD_API_URL}/parwa/versions`);
  if (!versionsResp.ok) throw new Error("Gagal mengambil versi");
  const { data: versions } = await versionsResp.json();
  
  console.log(`Menemukan ${versions.length} versi. Menyimpan ke database baru...`);
  for (const verName of versions) {
    await prisma.version.upsert({
      where: { name: verName },
      update: {},
      create: { name: verName }
    });
  }

  // 2. Ambil semua Parwa (looping halaman)
  let page = 1;
  let hasMore = true;
  let migratedCount = 0;

  // Siapkan map versi untuk pencarian cepat
  const versionMap = {};
  const dbVersions = await prisma.version.findMany();
  for (const v of dbVersions) {
    versionMap[v.name] = v.id;
  }

  const defaultVersion = dbVersions[0] ? dbVersions[0].id : 1;

  while (hasMore) {
    console.log(`Mengambil daftar cerita Halaman ${page}...`);
    const resp = await fetch(`${OLD_API_URL}/parwa?page=${page}&limit=50`);
    if (!resp.ok) {
      console.error(`Gagal mengambil halaman ${page}`);
      break;
    }
    const result = await resp.json();
    const items = result.items || [];
    
    if (items.length === 0) {
      hasMore = false;
      break;
    }

    console.log(`Memproses ${items.length} cerita pada Halaman ${page}...`);
    for (const item of items) {
      const id = item.id;
      
      // Ambil detail lengkap untuk mendapatkan isi_id (naskah Indonesia)
      const detailResp = await fetch(`${OLD_API_URL}/parwa/${id}`);
      if (!detailResp.ok) {
        console.warn(`Gagal mengambil detail cerita ID ${id}, melewatinya.`);
        continue;
      }
      const detail = await detailResp.json();

      // Cari atau tentukan Version ID dari judul cerita
      let versionId = defaultVersion;
      let verName = "";
      if (detail.judul && detail.judul.includes(", tr.")) {
        const parts = detail.judul.split(" - ");
        if (parts.length >= 2) {
          verName = parts[1].split(", tr.")[0].trim();
        }
      } else if (detail.judul) {
        const parts = detail.judul.split(" - ");
        if (parts.length >= 2) {
          verName = parts[parts.length - 1].trim();
        }
      }

      if (verName && versionMap[verName]) {
        versionId = versionMap[verName];
      }

      // Simpan/Upsert ke database baru
      await prisma.parwa.upsert({
        where: { id: detail.id },
        update: {
          book: detail.book || "",
          sub_parva: detail.sub_parva || null,
          section: detail.section || null,
          judul: detail.judul || null,
          url: detail.url || null,
          isi: detail.isi || "-",
          isi_id: detail.isi_id || "-",
          versionId: versionId
        },
        create: {
          id: detail.id,
          book: detail.book || "",
          sub_parva: detail.sub_parva || null,
          section: detail.section || null,
          judul: detail.judul || null,
          url: detail.url || null,
          isi: detail.isi || "-",
          isi_id: detail.isi_id || "-",
          versionId: versionId
        }
      });
      migratedCount++;
    }

    console.log(`Selesai Halaman ${page}. Total cerita termigrasi: ${migratedCount}`);
    page++;
  }

  console.log(`\nMIGRASI SELESAI! Berhasil memindahkan ${migratedCount} cerita.`);
}

main()
  .catch((e) => {
    console.error("Error saat migrasi:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
