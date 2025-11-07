const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

/**
 * Get user academic summary
 */
async function getAcademicSummary(userId) {
  try {
    const summary = await prisma.academicSummary.findUnique({
      where: { userId: userId },
      include: {
        user: {
          include: {
            programStudi: true
          }
        }
      }
    });

    if (!summary) {
      return {
        success: false,
        message: 'Data akademik tidak ditemukan'
      };
    }

    return {
      success: true,
      data: {
        nim: summary.user.nim,
        fullName: summary.user.fullName,
        programStudi: summary.user.programStudi?.name || '-',
        angkatan: summary.user.angkatan,
        totalSks: summary.totalSks,
        ipk: parseFloat(summary.ipk),
        ipsLastSemester: parseFloat(summary.ipsLastSemester),
        semesterActive: summary.semesterActive,
        totalSemestersCompleted: summary.totalSemestersCompleted,
        status: summary.user.status
      }
    };

  } catch (error) {
    console.error('Get academic summary error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem'
    };
  }
}

/**
 * Get user grades by semester
 */
async function getGradesBySemester(userId, semester = null) {
  try {
    const where = { userId: userId };
    
    if (semester) {
      where.semester = semester;
    }

    const grades = await prisma.academicGrade.findMany({
      where: where,
      include: {
        course: true
      },
      orderBy: [
        { semester: 'asc' },
        { course: { code: 'asc' } }
      ]
    });

    if (grades.length === 0) {
      return {
        success: false,
        message: 'Data nilai tidak ditemukan'
      };
    }

    // Group by semester
    const groupedGrades = {};
    
    grades.forEach(grade => {
      if (!groupedGrades[grade.semester]) {
        groupedGrades[grade.semester] = [];
      }
      
      groupedGrades[grade.semester].push({
        courseCode: grade.course.code,
        courseName: grade.course.name,
        sks: grade.course.sks,
        grade: grade.grade,
        gradePoint: parseFloat(grade.gradePoint)
      });
    });

    return {
      success: true,
      data: groupedGrades
    };

  } catch (error) {
    console.error('Get grades error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem'
    };
  }
}

/**
 * Get full transcript data
 */
async function getTranscript(userId) {
  try {
    const summary = await getAcademicSummary(userId);
    
    if (!summary.success) {
      return summary;
    }

    const grades = await getGradesBySemester(userId);
    
    if (!grades.success) {
      return grades;
    }

    return {
      success: true,
      data: {
        summary: summary.data,
        grades: grades.data
      }
    };

  } catch (error) {
    console.error('Get transcript error:', error);
    return {
      success: false,
      message: 'Terjadi kesalahan sistem'
    };
  }
}

module.exports = {
  getAcademicSummary,
  getGradesBySemester,
  getTranscript
};