const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting seed...\n');

  const hashedPassword = await bcrypt.hash('tazkia123', 10);

  // ==========================================
  // 1. Program Studi
  // ==========================================
  console.log('📚 Creating Program Studi...');
  const si = await prisma.programStudi.upsert({
    where: { code: 'SI' },
    update: {},
    create: { name: 'Sistem Informasi', code: 'SI', faculty: 'Fakultas Teknologi Informasi' }
  });

  await prisma.programStudi.upsert({
    where: { code: 'TI' },
    update: {},
    create: { name: 'Teknik Informatika', code: 'TI', faculty: 'Fakultas Teknologi Informasi' }
  });
  console.log('✅ Program Studi created\n');

  // ==========================================
  // 2. Users
  // ==========================================
  console.log('👤 Creating Users...');

  const user1 = await prisma.user.upsert({
    where: { email: '241572010024.ichsan@student.stmik.tazkia.ac.id' },
    update: { isEmailVerified: true, status: 'active' },
    create: {
      nim: '241572010024',
      fullName: 'Muhammad Ichsan',
      email: '241572010024.ichsan@student.stmik.tazkia.ac.id',
      passwordHash: hashedPassword,
      phone: '081234567890',
      programStudiId: si.id,
      angkatan: 2024,
      status: 'active',
      isProfileComplete: true,
      isEmailVerified: true,
      authMethod: 'nim',
      userType: 'student'
    }
  });

  await prisma.user.upsert({
    where: { nim: '20210120070' },
    update: { isEmailVerified: true },
    create: {
      nim: '20210120070',
      fullName: 'Siti Aisyah',
      email: 'aisyah@student.tazkia.ac.id',
      passwordHash: hashedPassword,
      phone: '081234567891',
      programStudiId: si.id,
      angkatan: 2021,
      status: 'active',
      isProfileComplete: true,
      isEmailVerified: true,
      authMethod: 'nim',
      userType: 'student'
    }
  });
  console.log('✅ Users created\n');

  // ==========================================
  // 3. Courses (Semester 1-6)
  // ==========================================
  console.log('📖 Creating Courses (Semester 1-6)...');

  const coursesData = [
    // Semester 1
    { code: 'SI101', name: 'Pengantar Sistem Informasi', sks: 3, semester: 1 },
    { code: 'SI102', name: 'Algoritma dan Pemrograman', sks: 4, semester: 1 },
    { code: 'SI103', name: 'Matematika Diskrit', sks: 3, semester: 1 },
    { code: 'SI104', name: 'Bahasa Inggris', sks: 2, semester: 1 },
    { code: 'SI105', name: 'Pendidikan Agama Islam', sks: 2, semester: 1 },

    // Semester 2
    { code: 'SI201', name: 'Struktur Data', sks: 4, semester: 2 },
    { code: 'SI202', name: 'Basis Data', sks: 3, semester: 2 },
    { code: 'SI203', name: 'Pemrograman Web', sks: 3, semester: 2 },
    { code: 'SI204', name: 'Sistem Operasi', sks: 3, semester: 2 },
    { code: 'SI205', name: 'Statistika', sks: 3, semester: 2 },

    // Semester 3
    { code: 'SI301', name: 'Analisis dan Perancangan Sistem', sks: 3, semester: 3 },
    { code: 'SI302', name: 'Pemrograman Berorientasi Objek', sks: 3, semester: 3 },
    { code: 'SI303', name: 'Jaringan Komputer', sks: 3, semester: 3 },
    { code: 'SI304', name: 'Manajemen Basis Data Terintegrasi', sks: 3, semester: 3 },
    { code: 'SI305', name: 'Kecerdasan Buatan', sks: 3, semester: 3 },

    // Semester 4
    { code: 'SI401', name: 'Rekayasa Perangkat Lunak', sks: 3, semester: 4 },
    { code: 'SI402', name: 'Sistem Informasi Manajemen', sks: 3, semester: 4 },
    { code: 'SI403', name: 'E-Commerce', sks: 3, semester: 4 },
    { code: 'SI404', name: 'Pemrograman Mobile', sks: 3, semester: 4 },
    { code: 'SI405', name: 'Keamanan Sistem Informasi', sks: 3, semester: 4 },

    // Semester 5
    { code: 'SI501', name: 'Manajemen Proyek TI', sks: 3, semester: 5 },
    { code: 'SI502', name: 'Data Mining', sks: 3, semester: 5 },
    { code: 'SI503', name: 'Cloud Computing', sks: 3, semester: 5 },
    { code: 'SI504', name: 'Audit Sistem Informasi', sks: 3, semester: 5 },
    { code: 'SI505', name: 'Technopreneurship', sks: 2, semester: 5 },

    // Semester 6
    { code: 'SI601', name: 'Big Data Analytics', sks: 3, semester: 6 },
    { code: 'SI602', name: 'Machine Learning', sks: 3, semester: 6 },
    { code: 'SI603', name: 'Kerja Praktik', sks: 3, semester: 6 },
    { code: 'SI604', name: 'Etika Profesi', sks: 2, semester: 6 },
    { code: 'SI605', name: 'Sistem Pendukung Keputusan', sks: 3, semester: 6 },
  ];

  const createdCourses = [];
  for (const c of coursesData) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: { ...c, programStudiId: si.id }
    });
    createdCourses.push(course);
  }
  console.log(`✅ ${createdCourses.length} Courses created\n`);

  // ==========================================
  // 4. Academic Grades
  // ==========================================
  console.log('📊 Creating Academic Grades...');

  // Deterministic grades for reproducible demos
  const gradeOptions = [
    { grade: 'A', point: 4.0 },
    { grade: 'A', point: 4.0 },
    { grade: 'A-', point: 3.7 },
    { grade: 'B+', point: 3.3 },
    { grade: 'A', point: 4.0 },
    { grade: 'A-', point: 3.7 },
  ];

  let totalSks = 0;
  let totalPoints = 0;

  for (let i = 0; i < createdCourses.length; i++) {
    const course = createdCourses[i];
    const pick = gradeOptions[i % gradeOptions.length];
    // Short format: '2024-1', '2024-2', '2025-1' etc — fits VARCHAR(10)
    const baseYear = 2024 + Math.floor((course.semester - 1) / 2);
    const semNum = course.semester % 2 === 1 ? 1 : 2;
    const semesterLabel = `${baseYear}-${semNum}`; // e.g. '2024-1'

    totalSks += course.sks;
    totalPoints += course.sks * pick.point;

    await prisma.academicGrade.upsert({
      where: {
        userId_courseId_semester: {
          userId: user1.id,
          courseId: course.id,
          semester: semesterLabel
        }
      },
      update: { grade: pick.grade, gradePoint: pick.point },
      create: {
        userId: user1.id,
        courseId: course.id,
        semester: semesterLabel,
        grade: pick.grade,
        gradePoint: pick.point
      }
    });
  }

  console.log('✅ Grades created\n');

  // ==========================================
  // 5. Academic Summary
  // ==========================================
  console.log('📈 Creating Academic Summary...');
  const ipk = parseFloat((totalPoints / totalSks).toFixed(2));

  await prisma.academicSummary.upsert({
    where: { userId: user1.id },
    update: {
      totalSks,
      ipk,
      ipsLastSemester: 3.85,
      semesterActive: 6,
      totalSemestersCompleted: 5
    },
    create: {
      userId: user1.id,
      totalSks,
      ipk,
      ipsLastSemester: 3.85,
      semesterActive: 6,
      totalSemestersCompleted: 5
    }
  });

  console.log(`✅ Academic Summary: ${totalSks} SKS, IPK ${ipk}\n`);
  console.log('🎉 Seed completed!');
  console.log('📝 Test Login Credentials:');
  console.log(`   NIM  : ${user1.nim}`);
  console.log(`   Email: ${user1.email}`);
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