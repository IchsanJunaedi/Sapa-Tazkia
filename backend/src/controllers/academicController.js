const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
// Pastikan path services ini benar relative terhadap controller
const openaiService = require('../services/openaiService'); 

// ==========================================
// 🎓 ACADEMIC CONTROLLER (FIXED FOR PDF)
// ==========================================

const getAcademicSummary = async (req, res) => {
  try {
    const userId = req.user.id; 

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        programStudi: true,
        academicSummary: true
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: 'User tidak ditemukan' });
    }

    const summaryData = {
      nim: user.nim,
      fullName: user.fullName,
      programStudi: user.programStudi ? user.programStudi.name : '-',
      faculty: user.programStudi ? user.programStudi.faculty : '-',
      totalSks: user.academicSummary?.totalSks || 0,
      ipk: user.academicSummary?.ipk ? parseFloat(user.academicSummary.ipk) : 0.00,
      semesterActive: user.academicSummary?.semesterActive || 1
    };

    return res.status(200).json({
      success: true,
      data: summaryData
    });

  } catch (error) {
    console.error('❌ [ACADEMIC CTRL] Error getSummary:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const getGrades = async (req, res) => {
  try {
    const userId = req.user.id;
    const { semester } = req.query;

    const whereClause = { userId: userId };
    if (semester) {
      whereClause.semester = String(semester);
    }

    const gradesRaw = await prisma.academicGrade.findMany({
      where: whereClause,
      include: { course: true },
      orderBy: { semester: 'asc' }
    });

    // Format agar frontend mudah membacanya
    const formattedGrades = gradesRaw.map(item => ({
        id: item.id,
        semester: item.semester,
        courseCode: item.course.code,
        courseName: item.course.name,
        sks: item.course.sks,
        grade: item.grade,
        gradePoint: parseFloat(item.gradePoint)
    }));

    return res.status(200).json({
      success: true,
      data: formattedGrades
    });

  } catch (error) {
    console.error('❌ [ACADEMIC CTRL] Error getGrades:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

// ⚠️ BAGIAN INI YANG DIPERBAIKI (CRITICAL FIX)
const getTranscript = async (req, res) => {
  try {
    const userId = req.user.id;

    const [user, gradesRaw] = await Promise.all([
      prisma.user.findUnique({
        where: { id: userId },
        include: { programStudi: true, academicSummary: true }
      }),
      prisma.academicGrade.findMany({
        where: { userId: userId },
        include: { course: true },
        orderBy: { semester: 'asc' } // Urutkan dari semester 1, 2, dst
      })
    ]);

    if (!user) return res.status(404).json({ success: false, message: 'User not found' });

    // 1. Data Summary
    const summaryData = {
      nim: user.nim,
      fullName: user.fullName,
      programStudi: user.programStudi ? user.programStudi.name : '-',
      totalSks: user.academicSummary?.totalSks || 0,
      ipk: user.academicSummary?.ipk ? parseFloat(user.academicSummary.ipk) : 0.00,
      status: user.status
    };

    // 2. Data Grades (ARRAY DATAR - JANGAN DIGROUP)
    // Frontend butuh Array untuk PDF Generator
    const formattedGrades = gradesRaw.map(item => ({
        semester: item.semester,
        courseCode: item.course.code,
        courseName: item.course.name,
        sks: item.course.sks,
        grade: item.grade,
        gradePoint: parseFloat(item.gradePoint)
    }));

    return res.status(200).json({
      success: true,
      data: {
        summary: summaryData,
        grades: formattedGrades // ✅ Pastikan ini ARRAY, bukan Object
      }
    });

  } catch (error) {
    console.error('❌ [ACADEMIC CTRL] Error getTranscript:', error);
    return res.status(500).json({ success: false, message: 'Server Error' });
  }
};

const analyzePerformance = async (req, res) => {
  try {
    const userId = req.user.id;

    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { programStudi: true, academicSummary: true }
    });
    
    const gradesRaw = await prisma.academicGrade.findMany({
      where: { userId: userId },
      include: { course: true }
    });

    if (!user || gradesRaw.length === 0) {
      return res.status(400).json({ success: false, message: 'Data akademik belum cukup.' });
    }

    const academicData = {
      studentName: user.fullName,
      prodi: user.programStudi?.name,
      ipk: user.academicSummary?.ipk,
      grades: gradesRaw.map(g => `${g.course.name}: ${g.grade}`)
    };

    const prompt = `
      Analisis singkat performa akademik:
      Nama: ${academicData.studentName}
      Prodi: ${academicData.prodi}
      IPK: ${academicData.ipk}
      Nilai: ${academicData.grades.join(', ')}

      Berikan:
      1. Evaluasi singkat.
      2. Saran belajar.
      Gunakan bahasa Indonesia yang memotivasi.
    `;

    const aiResponse = await openaiService.generateAIResponse(prompt);

    return res.status(200).json({
      success: true,
      data: {
        analysis: aiResponse,
        generatedAt: new Date()
      }
    });

  } catch (error) {
    console.error('❌ [ACADEMIC CTRL] Error analyzePerformance:', error);
    return res.status(500).json({ success: false, message: 'Gagal menganalisis data.' });
  }
};

module.exports = {
  getAcademicSummary,
  getGrades,
  getTranscript,
  analyzePerformance
};