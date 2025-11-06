// M:/Sapa-Tazkia/backend/prisma/seed.js
// Ini adalah kode LENGKAP yang sudah diperbaiki.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  // Hash password
  const hashedPassword = await bcrypt.hash('tazkia123', 10);

  // 1. Create Program Studi
  console.log('📚 Creating Program Studi...');
  const si = await prisma.programStudi.upsert({
    where: { code: 'SI' },
    update: {},
    create: {
      name: 'Sistem Informasi',
      code: 'SI',
      faculty: 'Fakultas Teknologi Informasi'
    }
  });

  const ti = await prisma.programStudi.upsert({
    where: { code: 'TI' },
    update: {},
    create: {
      name: 'Teknik Informatika',
      code: 'TI',
      faculty: 'Fakultas Teknologi Informasi'
    }
  });

  console.log('✅ Program Studi created\n');

  // 2. Create Users (Mahasiswa)
  console.log('👤 Creating Users...');
  
  const user1 = await prisma.user.upsert({
    where: { nim: '20210120069' },
    update: {},
    create: {
      nim: '20210120069',
      fullName: 'Muhammad Ikhsan',
      email: 'ikhsan@student.tazkia.ac.id',
      passwordHash: hashedPassword,
      phone: '081234567890',
      programStudiId: si.id,
      angkatan: 2021,
      status: 'active'
    }
  });

  const user2 = await prisma.user.upsert({
    where: { nim: '20210120070' },
    update: {},
    create: {
      nim: '20210120070',
      fullName: 'Siti Aisyah',
      email: 'aisyah@student.tazkia.ac.id',
      passwordHash: hashedPassword,
      phone: '081234567891',
      programStudiId: ti.id,
      angkatan: 2021,
      status: 'active'
    }
  });

  console.log('✅ Users created\n');

  // 3. Create Courses
  console.log('📖 Creating Courses...');
  
  const courses = [
    // Semester 1
    { code: 'SI101', name: 'Pengantar Sistem Informasi', sks: 3, programStudiId: si.id, semester: 1 },
    { code: 'SI102', name: 'Algoritma dan Pemrograman', sks: 4, programStudiId: si.id, semester: 1 },
    { code: 'SI103', name: 'Matematika Diskrit', sks: 3, programStudiId: si.id, semester: 1 },
    { code: 'SI104', name: 'Bahasa Inggris', sks: 2, programStudiId: si.id, semester: 1 },
    { code: 'SI105', name: 'Pendidikan Agama', sks: 2, programStudiId: si.id, semester: 1 },
    
    // Semester 2
    { code: 'SI201', name: 'Struktur Data', sks: 4, programStudiId: si.id, semester: 2 },
    { code: 'SI202', name: 'Basis Data', sks: 3, programStudiId: si.id, semester: 2 },
    { code: 'SI203', name: 'Pemrograman Web', sks: 3, programStudiId: si.id, semester: 2 },
    { code: 'SI204', name: 'Sistem Operasi', sks: 3, programStudiId: si.id, semester: 2 },
    { code: 'SI205', name: 'Statistika', sks: 3, programStudiId: si.id, semester: 2 },
  ];

  for (const course of courses) {
    await prisma.course.upsert({
      where: { code: course.code },
      update: {},
      create: course
    });
  }

  console.log('✅ Courses created\n');

  // 4. Create Grades for user1
  console.log('📊 Creating Grades...');
  
  const gradesData = [
    // Semester 1
    { userId: user1.id, courseCode: 'SI101', semester: '1', grade: 'A', gradePoint: 4.00 },
    { userId: user1.id, courseCode: 'SI102', semester: '1', grade: 'A-', gradePoint: 3.70 },
    { userId: user1.id, courseCode: 'SI103', semester: '1', grade: 'B+', gradePoint: 3.30 },
    { userId: user1.id, courseCode: 'SI104', semester: '1', grade: 'A', gradePoint: 4.00 },
    { userId: user1.id, courseCode: 'SI105', semester: '1', grade: 'A', gradePoint: 4.00 },
    
    // Semester 2
    { userId: user1.id, courseCode: 'SI201', semester: '2', grade: 'A', gradePoint: 4.00 },
    { userId: user1.id, courseCode: 'SI202', semester: '2', grade: 'A-', gradePoint: 3.70 },
    { userId: user1.id, courseCode: 'SI203', semester: '2', grade: 'B+', gradePoint: 3.30 },
    { userId: user1.id, courseCode: 'SI204', semester: '2', grade: 'A-', gradePoint: 3.70 },
    { userId: user1.id, courseCode: 'SI205', semester: '2', grade: 'A', gradePoint: 4.00 },
  ];

  for (const gradeData of gradesData) {
    const course = await prisma.course.findUnique({
      where: { code: gradeData.courseCode }
    });

    // Pastikan course ditemukan sebelum melanjutkan
    if (course) {
      await prisma.academicGrade.upsert({
        where: {
          userId_courseId_semester: {
            userId: gradeData.userId,
            courseId: course.id,
            semester: gradeData.semester
          }
        },
        update: {},
        create: {
          userId: gradeData.userId,
          courseId: course.id,
          semester: gradeData.semester,
          grade: gradeData.grade,
          gradePoint: gradeData.gradePoint
        } // <- Kesalahan ketik 't' sudah dihapus dari sini.
      });
    } else {
      console.warn(`⚠️ Course dengan kode ${gradeData.courseCode} tidak ditemukan, seeding grade dilewati.`);
    }
  }

  console.log('✅ Grades created\n');

  // 5. Create Academic Summary
  console.log('📈 Creating Academic Summary...');
  
  await prisma.academicSummary.upsert({
    where: { userId: user1.id },
    update: {},
    create: {
      userId: user1.id,
      totalSks: 30,
      ipk: 3.72,
      ipsLastSemester: 3.74,
      semesterActive: 3,
      totalSemestersCompleted: 2
    }
  });

  console.log('✅ Academic Summary created\n');

  console.log('🎉 Seed completed!\n');
  console.log('📝 Test Login Credentials:');
  console.log('   NIM: 20210120069');
  console.log('   Password: tazkia123\n');
}

main()
  .catch((e) => {
    console.error('❌ Error:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });