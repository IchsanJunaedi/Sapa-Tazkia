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
  
  // USER UTAMA: ICHSAN
  const user1 = await prisma.user.upsert({
    where: { email: '241572010024.ichsan@student.stmik.tazkia.ac.id' },
    update: {},
    create: {
      nim: '241572010024', 
      fullName: 'Muhammad Ichsan',
      email: '241572010024.ichsan@student.stmik.tazkia.ac.id',
      passwordHash: hashedPassword,
      phone: '081234567890',
      programStudiId: si.id,
      angkatan: 2024,
      status: 'active',
      isProfileComplete: true 
    }
  });

  // USER DUMMY LAIN
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

  // 3. Create Courses (Mata Kuliah)
  console.log('📖 Creating Courses...');
  
  const coursesData = [
    // Semester 1
    { code: 'SI101', name: 'Pengantar Sistem Informasi', sks: 3, semester: 1 },
    { code: 'SI102', name: 'Algoritma dan Pemrograman', sks: 4, semester: 1 },
    { code: 'SI103', name: 'Matematika Diskrit', sks: 3, semester: 1 },
    { code: 'SI104', name: 'Bahasa Inggris', sks: 2, semester: 1 },
    { code: 'SI105', name: 'Pendidikan Agama', sks: 2, semester: 1 },
    
    // Semester 2
    { code: 'SI201', name: 'Struktur Data', sks: 4, semester: 2 },
    { code: 'SI202', name: 'Basis Data', sks: 3, semester: 2 },
    { code: 'SI203', name: 'Pemrograman Web', sks: 3, semester: 2 },
    { code: 'SI204', name: 'Sistem Operasi', sks: 3, semester: 2 },
    { code: 'SI205', name: 'Statistika', sks: 3, semester: 2 },
  ];

  // Simpan course yang dibuat ke array biar mudah diambil id-nya nanti
  const createdCourses = [];

  for (const c of coursesData) {
    const course = await prisma.course.upsert({
      where: { code: c.code },
      update: {},
      create: {
        ...c,
        programStudiId: si.id
      }
    });
    createdCourses.push(course);
  }

  console.log('✅ Courses created\n');

  // 4. Create RANDOM Grades for user1
  console.log('📊 Creating Random Grades...');
  
  // Pilihan Nilai yang mungkin muncul
  const possibleGrades = [
    { grade: 'A', point: 4.0 },
    { grade: 'A-', point: 3.7 },
    { grade: 'B+', point: 3.3 },
    { grade: 'B', point: 3.0 },
    { grade: 'A', point: 4.0 }, // Perbanyak A biar IPK bagus :)
  ];

  let totalSksAccumulated = 0;
  let totalPointsAccumulated = 0;

  for (const course of createdCourses) {
    // PILIH NILAI ACAK
    const randomPick = possibleGrades[Math.floor(Math.random() * possibleGrades.length)];
    
    // Hitung akumulasi untuk IPK
    totalSksAccumulated += course.sks;
    totalPointsAccumulated += (course.sks * randomPick.point);

    // Convert semester int to string if schema requires string
    const semesterString = String(course.semester);

    await prisma.academicGrade.upsert({
      where: {
        userId_courseId_semester: {
          userId: user1.id,
          courseId: course.id,
          semester: semesterString
        }
      },
      update: {
        grade: randomPick.grade,
        gradePoint: randomPick.point
      },
      create: {
        userId: user1.id,
        courseId: course.id,
        semester: semesterString,
        grade: randomPick.grade,
        gradePoint: randomPick.point
      }
    });
  }

  console.log('✅ Grades created randomly\n');

  // 5. Create Academic Summary (Hitung IPK Otomatis)
  console.log('📈 Creating Academic Summary...');
  
  // Hitung IPK Real berdasarkan nilai random tadi
  const calculatedIPK = (totalPointsAccumulated / totalSksAccumulated).toFixed(2);

  await prisma.academicSummary.upsert({
    where: { userId: user1.id },
    update: {
        totalSks: totalSksAccumulated,
        ipk: parseFloat(calculatedIPK),
        ipsLastSemester: parseFloat(calculatedIPK), // Anggap sama dulu
    },
    create: {
      userId: user1.id,
      totalSks: totalSksAccumulated,
      ipk: parseFloat(calculatedIPK),
      ipsLastSemester: parseFloat(calculatedIPK),
      semesterActive: 3,
      totalSemestersCompleted: 2
    }
  });

  console.log(`✅ Academic Summary created. Total SKS: ${totalSksAccumulated}, Calculated IPK: ${calculatedIPK}\n`);

  console.log('🎉 Seed completed!\n');
  console.log('📝 Test Login Credentials:');
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