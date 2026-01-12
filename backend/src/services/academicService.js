// Academic Service - Connected to Real Database via Prisma
const prisma = require('../../config/prisma');
const openaiService = require('./openaiService');

class AcademicService {
  constructor() {
    // No mock data needed anymore
  }

  // ✅ Validate student data (DB Check)
  async validateStudent(nim, fullName, birthDate) {
    console.log('🔍 [ACADEMIC SERVICE] Validating student:', { nim, fullName, birthDate });

    try {
      const student = await prisma.user.findUnique({
        where: { nim },
        include: { programStudi: true }
      });

      // Simple validation (Adjust strictness as needed)
      // Note: birthDate is not currently in seed/schema, so we skip it for now or assume valid if NIM matches.
      if (student && this.normalizeName(student.fullName) === this.normalizeName(fullName)) {
        console.log('✅ [ACADEMIC SERVICE] Student validation SUCCESS');
        return {
          success: true,
          valid: true,
          data: {
            userId: student.id,
            nim: student.nim,
            fullName: student.fullName,
            programStudi: student.programStudi?.name || '-',
            faculty: student.programStudi?.faculty || '-',
            angkatan: student.angkatan,
            status: student.status,
            academicId: student.id
          },
          message: 'Verifikasi berhasil! Data akademik Anda telah terkonfirmasi.'
        };
      } else {
        console.log('❌ [ACADEMIC SERVICE] Student validation FAILED');
        return {
          success: false,
          valid: false,
          message: 'Data tidak valid. Pastikan NIM dan Nama Lengkap sesuai.'
        };
      }
    } catch (e) {
      console.error("Validation Error:", e);
      return { success: false, valid: false, message: "Error validasi data." };
    }
  }

  // ✅ Get Academic Summary (DB Query)
  async getAcademicSummary(userId) {
    console.log('🔍 [ACADEMIC SERVICE] Getting academic summary for:', userId);

    try {
      // Fetch User + AcademicSummary + Prodi
      const student = await prisma.user.findUnique({
        where: { id: userId },
        include: {
          programStudi: true,
          academicSummary: true
        }
      });

      if (!student || !student.academicSummary) {
        return { success: false, message: 'Data akademik tidak ditemukan' };
      }

      return {
        success: true,
        data: {
          nim: student.nim,
          fullName: student.fullName,
          programStudi: student.programStudi?.name,
          angkatan: student.angkatan,
          totalSks: student.academicSummary.totalSks,
          ipk: student.academicSummary.ipk,
          ipsLastSemester: student.academicSummary.ipsLastSemester,
          semesterActive: student.academicSummary.semesterActive,
          totalSemestersCompleted: student.academicSummary.totalSemestersCompleted,
          status: student.status
        }
      };

    } catch (e) {
      console.error("Get Summary Error:", e);
      return { success: false, message: "Gagal mengambil data akademik." };
    }
  }

  // ✅ Get Grades by Semester (DB Query)
  async getGradesBySemester(userId, semester = null) {
    console.log('🔍 [ACADEMIC SERVICE] Getting grades for:', userId, 'Semester:', semester);

    try {
      const whereClause = { userId };
      if (semester) {
        whereClause.semester = String(semester); // Ensure string/int match schema. Seed uses string?
        // Wait, seed.js uses `semester: String(course.semester)`. So it is String in DB.
        // Let's verify via seed.js check earlier. Yes, line 134: `const semesterString = String(course.semester);`
        // But schema might be Int? Prisma schema usually defines types. 
        // If query fails, I will assume String based on seed.js.
      }

      // Fetch grades with Course info
      const grades = await prisma.academicGrade.findMany({
        where: whereClause,
        include: { course: true },
        orderBy: { semester: 'asc' }
      });

      if (grades.length === 0) {
        return { success: false, message: 'Data nilai tidak ditemukan' };
      }

      // Group by semester
      const groupedGrades = {};
      grades.forEach(g => {
        // Handle semester type (might be string or int from DB)
        const sem = g.semester;
        if (!groupedGrades[sem]) groupedGrades[sem] = [];

        groupedGrades[sem].push({
          courseCode: g.course?.code || 'UNKNOWN',
          courseName: g.course?.name || 'Mata Kuliah Tidak Diketahui',
          sks: g.course?.sks || 0,
          grade: g.grade,
          gradePoint: parseFloat(g.gradePoint)
        });
      });

      return { success: true, data: groupedGrades };

    } catch (e) {
      console.error("Get Grades Error:", e);
      return { success: false, message: "Gagal mengambil data nilai." };
    }
  }

  // ✅ Get Full Transcript (Combine DB Queries)
  async getTranscript(userId) {
    console.log('🔍 [ACADEMIC SERVICE] Getting transcript for:', userId);

    try {
      const summary = await this.getAcademicSummary(userId);
      const grades = await this.getGradesBySemester(userId);

      if (!summary.success) return summary; // Propagate error

      // If grades empty, just return empty list but still success? 
      // Existing logic returned error if grades not success. 
      // But maybe new student has no grades? 
      // I'll keep existing behavior for consistency.
      if (!grades.success) return { success: false, message: 'Data nilai belum tersedia' };

      return {
        success: true,
        data: {
          summary: summary.data,
          grades: grades.data
        }
      };
    } catch (e) {
      return { success: false, message: "Gagal menyusun transkrip." };
    }
  }

  // ✅ Analyze Performance (AI)
  async analyzeAcademicPerformance(userId) {
    console.log('🧠 [ACADEMIC SERVICE] Analyzing academic performance for:', userId);
    try {
      const transcript = await this.getTranscript(userId);
      if (!transcript.success) {
        return { success: false, message: 'Tidak dapat menganalisis performa: data tidak lengkap' };
      }

      const academicData = {
        studentName: transcript.data.summary.fullName,
        nim: transcript.data.summary.nim,
        programStudi: transcript.data.summary.programStudi,
        ipk: transcript.data.summary.ipk,
        totalSks: transcript.data.summary.totalSks,
        gradesBySemester: transcript.data.grades
      };

      const analysisPrompt = `
        ANALISIS PERFORMA AKADEMIK MAHASISWA
        Data Mahasiswa:
        - Nama: ${academicData.studentName}
        - NIM: ${academicData.nim}
        - Program Studi: ${academicData.programStudi}
        - IPK: ${academicData.ipk}
        - Total SKS: ${academicData.totalSks}

        Data Nilai per Semester:
        ${JSON.stringify(academicData.gradesBySemester, null, 2)}

        Tolong berikan analisis singkat (maks 3 paragraf) tentang performa akademik, tren nilai, dan prediksi kelulusan.
        Gunakan gaya bahasa seorang konselor akademik yang suportif.
      `;

      const analysisResult = await openaiService.generateAIResponse(analysisPrompt);

      return {
        success: true,
        data: {
          studentInfo: {
            name: academicData.studentName,
            nim: academicData.nim,
            programStudi: academicData.programStudi,
            ipk: academicData.ipk
          },
          analysis: analysisResult,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      console.error('Analysis Error:', error);
      return { success: false, message: 'Gagal menganalisis: ' + error.message };
    }
  }

  // ✅ Study Recommendations (AI)
  async getStudyRecommendations(userId) {
    try {
      const transcript = await this.getTranscript(userId);
      if (!transcript.success) return { success: false, message: 'Data tidak tersedia untuk rekomendasi.' };

      const academicData = {
        studentName: transcript.data.summary.fullName,
        ipk: transcript.data.summary.ipk,
        ipsLastSemester: transcript.data.summary.ipsLastSemester,
        grades: transcript.data.grades
      };

      const recommendationPrompt = `
        REKOMENDASI BELAJAR (STUDY PLAN)
        Mahasiswa: ${academicData.studentName} | IPK: ${academicData.ipk} | IPS Terakhir: ${academicData.ipsLastSemester}
        
        Riwayat Nilai:
        ${JSON.stringify(academicData.grades, null, 2)}

        Berikan 4-5 poin rekomendasi strategi belajar, manajemen waktu, dan target realistis semester depan.
        Format bullet points.
      `;

      const recommendations = await openaiService.generateAIResponse(recommendationPrompt);

      return {
        success: true,
        data: {
          studentName: academicData.studentName,
          currentIPK: academicData.ipk,
          recommendations: recommendations,
          generatedAt: new Date().toISOString()
        }
      };

    } catch (error) {
      return { success: false, message: 'Gagal membuat rekomendasi: ' + error.message };
    }
  }

  normalizeName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }
}

const academicService = new AcademicService();
module.exports = academicService;