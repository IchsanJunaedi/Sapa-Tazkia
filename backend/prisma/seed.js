const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...');

  await prisma.user.upsert({
    where: { email: 'ikhsan@student.tazkia.ac.id' },
    update: {},
    create: {
      nim: '123456789',
      fullName: 'Muhammad Ikhsan',
      email: 'ikhsan@student.tazkia.ac.id',
      passwordHash: '$2b$10$abcdefghijklmnopqrstuvwxyz'
    }
  });

  console.log('✅ Seeding selesai!');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
