// backend/tests/helpers/dbHelper.js
// Utilities for integration test database management.
// Uses a fresh PrismaClient connected to the test database from .env.test.

const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

/**
 * Truncate all test-relevant tables in safe dependency order (children first).
 * Uses deleteMany instead of TRUNCATE to respect FK constraints.
 */
async function truncateAll() {
  await prisma.message.deleteMany({});
  await prisma.conversation.deleteMany({});
  await prisma.academicGrade.deleteMany({});
  await prisma.academicSummary.deleteMany({});
  await prisma.rateLimit.deleteMany({});
  await prisma.rateLimitLog.deleteMany({});
  await prisma.bugReport.deleteMany({});
  await prisma.notification.deleteMany({});
  await prisma.session.deleteMany({});
  await prisma.user.deleteMany({});
}

/**
 * Seed a verified, active student user for integration tests.
 * Returns the created user + plaintext password for login tests.
 */
async function seedTestUser(overrides = {}) {
  const plainPassword = overrides.password || 'TestPass123!';
  const passwordHash = await bcrypt.hash(plainPassword, 10);

  const user = await prisma.user.create({
    data: {
      fullName:          overrides.fullName  || 'Test Student',
      nim:               overrides.nim       || '2021001001',
      email:             overrides.email     || 'test@student.tazkia.ac.id',
      passwordHash,
      authMethod:        'nim',
      userType:          'student',
      status:            'active',
      isEmailVerified:   true,
      isProfileComplete: true,
    },
  });

  return { user, plainPassword };
}

/**
 * Seed academic summary for a given userId.
 */
async function seedAcademicSummary(userId) {
  return prisma.academicSummary.create({
    data: {
      userId,
      ipk:                     '3.75',
      totalSks:                80,
      semesterActive:          5,
      ipsLastSemester:         '0.00',
      totalSemestersCompleted: 4,
    },
  });
}

/**
 * Seed academic grade records for a given userId.
 */
async function seedAcademicGrades(userId) {
  let course = await prisma.course.findFirst({ where: { code: 'TI001' } });
  if (!course) {
    // Create a program studi first if needed
    let programStudi = await prisma.programStudi.findFirst({ where: { code: 'TI' } });
    if (!programStudi) {
      programStudi = await prisma.programStudi.create({
        data: {
          code: 'TI',
          name: 'Teknik Informatika',
          faculty: 'Engineering',
          status: 'active',
        },
      });
    }

    course = await prisma.course.create({
      data: {
        code: 'TI001',
        name: 'Algoritma & Pemrograman',
        sks: 3,
        semester: 1,
        programStudiId: programStudi.id,
      },
    });
  }

  return prisma.academicGrade.create({
    data: {
      userId,
      courseId:     course.id,
      semester:     '1',  // semester is String in schema
      grade:        'A',
      gradePoint:   '4.00',  // Decimal type
    },
  });
}

async function disconnect() {
  await prisma.$disconnect();
}

module.exports = { prisma, truncateAll, seedTestUser, seedAcademicSummary, seedAcademicGrades, disconnect };
