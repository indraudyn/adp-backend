const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

async function main() {
    const versions = [
        { id: 1, name: "Kisari Mohan Ganguli" },
        { id: 2, name: "Budi's" },
        { id: 3, name: "Gaga's" }
    ];

    for (const v of versions) {
        await prisma.version.upsert({
            where: { id: v.id },
            update: { name: v.name },
            create: v
        });
    }
    console.log("✅ Versions successfully seeded.");
}

main()
  .then(() => prisma.$disconnect())
  .catch(async (e) => {
    console.error(e);
    await prisma.$disconnect();
    process.exit(1);
  });
