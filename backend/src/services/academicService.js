// Mock Academic Service untuk development - Compatible dengan Prisma schema
// Phase 1: Mock data - Phase 2: Switch ke real API

class AcademicService {
  constructor() {
    this.mockStudents = this.generateMockStudents();
    this.mockCourses = this.generateMockCourses();
    this.mockGrades = this.generateMockGrades();
  }

  // Generate mock student data berdasarkan pola NIM Tazkia
  generateMockStudents() {
    return [
      {
        id: 'user_001',
        nim: '241572010024',
        fullName: 'Ichsan Pratama',
        birthDate: '1999-05-15',
        email: '241572010024.ichsan@student.tazkia.ac.id',
        programStudi: {
          id: 'prodi_001',
          name: 'S1 Teknik Informatika',
          faculty: 'Fakultas Teknologi Informasi'
        },
        angkatan: 2024,
        status: 'ACTIVE',
        academicSummary: {
          id: 'summary_001',
          userId: 'user_001',
          totalSks: 108,
          ipk: 3.75,
          ipsLastSemester: 3.80,
          semesterActive: 3,
          totalSemestersCompleted: 2
        }
      },
      {
        id: 'user_002',
        nim: '241572010025',
        fullName: 'Siti Rahayu',
        birthDate: '2000-08-22',
        email: '241572010025.siti@student.tazkia.ac.id',
        programStudi: {
          id: 'prodi_002',
          name: 'S1 Sistem Informasi',
          faculty: 'Fakultas Teknologi Informasi'
        },
        angkatan: 2024,
        status: 'ACTIVE',
        academicSummary: {
          id: 'summary_002',
          userId: 'user_002',
          totalSks: 102,
          ipk: 3.60,
          ipsLastSemester: 3.65,
          semesterActive: 3,
          totalSemestersCompleted: 2
        }
      },
      {
        id: 'user_003',
        nim: '241572010026',
        fullName: 'Ahmad Fauzi',
        birthDate: '1999-12-10',
        email: '241572010026.ahmad@student.tazkia.ac.id',
        programStudi: {
          id: 'prodi_003',
          name: 'S1 Teknik Komputer',
          faculty: 'Fakultas Teknologi Informasi'
        },
        angkatan: 2024,
        status: 'ACTIVE',
        academicSummary: {
          id: 'summary_003',
          userId: 'user_003',
          totalSks: 96,
          ipk: 3.45,
          ipsLastSemester: 3.50,
          semesterActive: 3,
          totalSemestersCompleted: 2
        }
      }
    ];
  }

  // Generate mock courses data
  generateMockCourses() {
    return [
      { id: 'course_001', code: 'TI101', name: 'Pemrograman Dasar', sks: 3 },
      { id: 'course_002', code: 'TI102', name: 'Algoritma & Struktur Data', sks: 4 },
      { id: 'course_003', code: 'TI201', name: 'Basis Data', sks: 3 },
      { id: 'course_004', code: 'TI202', name: 'Pemrograman Web', sks: 3 },
      { id: 'course_005', code: 'TI301', name: 'Jaringan Komputer', sks: 3 },
      { id: 'course_006', code: 'TI302', name: 'Machine Learning', sks: 4 },
      { id: 'course_007', code: 'UM101', name: 'Pendidikan Agama', sks: 2 },
      { id: 'course_008', code: 'UM102', name: 'Pendidikan Pancasila', sks: 2 }
    ];
  }

  // Generate mock grades data sesuai dengan Prisma schema
  generateMockGrades() {
    return [
      // Semester 1 - Ichsan Pratama
      { id: 'grade_001', userId: 'user_001', courseId: 'course_001', semester: 1, grade: 'A', gradePoint: 4.0 },
      { id: 'grade_002', userId: 'user_001', courseId: 'course_002', semester: 1, grade: 'A-', gradePoint: 3.7 },
      { id: 'grade_003', userId: 'user_001', courseId: 'course_007', semester: 1, grade: 'A', gradePoint: 4.0 },
      
      // Semester 2 - Ichsan Pratama
      { id: 'grade_004', userId: 'user_001', courseId: 'course_003', semester: 2, grade: 'B+', gradePoint: 3.3 },
      { id: 'grade_005', userId: 'user_001', courseId: 'course_004', semester: 2, grade: 'A', gradePoint: 4.0 },
      { id: 'grade_006', userId: 'user_001', courseId: 'course_008', semester: 2, grade: 'A-', gradePoint: 3.7 },
      
      // Semester 1 - Siti Rahayu
      { id: 'grade_007', userId: 'user_002', courseId: 'course_001', semester: 1, grade: 'B+', gradePoint: 3.3 },
      { id: 'grade_008', userId: 'user_002', courseId: 'course_002', semester: 1, grade: 'A-', gradePoint: 3.7 },
      
      // Semester 2 - Siti Rahayu
      { id: 'grade_009', userId: 'user_002', courseId: 'course_003', semester: 2, grade: 'A', gradePoint: 4.0 },
      { id: 'grade_010', userId: 'user_002', courseId: 'course_004', semester: 2, grade: 'B+', gradePoint: 3.3 }
    ];
  }

  // ✅ MOCK API: Validate student data (nama & tanggal lahir) - Compatible dengan backend
  async validateStudent(nim, fullName, birthDate) {
    console.log('🔍 [MOCK ACADEMIC SERVICE] Validating student:', { nim, fullName, birthDate });
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const student = this.mockStudents.find(s => 
      s.nim === nim && 
      this.normalizeName(s.fullName) === this.normalizeName(fullName) &&
      s.birthDate === birthDate
    );

    if (student) {
      console.log('✅ [MOCK ACADEMIC SERVICE] Student validation SUCCESS');
      return {
        success: true,
        valid: true,
        data: {
          userId: student.id,
          nim: student.nim,
          fullName: student.fullName,
          programStudi: student.programStudi.name,
          faculty: student.programStudi.faculty,
          angkatan: student.angkatan,
          status: student.status,
          academicId: student.id // Untuk compatibility dengan flow sebelumnya
        },
        message: 'Verifikasi berhasil! Data akademik Anda telah terkonfirmasi.'
      };
    } else {
      console.log('❌ [MOCK ACADEMIC SERVICE] Student validation FAILED');
      return {
        success: false,
        valid: false,
        message: 'Data tidak valid. Pastikan Nama Lengkap dan Tanggal Lahir sesuai dengan data akademik.'
      };
    }
  }

  // ✅ MOCK API: Get academic summary - Compatible dengan Prisma function
  async getAcademicSummary(userId) {
    console.log('🔍 [MOCK ACADEMIC SERVICE] Getting academic summary for:', userId);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    const student = this.mockStudents.find(s => s.id === userId);
    
    if (!student || !student.academicSummary) {
      return {
        success: false,
        message: 'Data akademik tidak ditemukan'
      };
    }

    return {
      success: true,
      data: {
        nim: student.nim,
        fullName: student.fullName,
        programStudi: student.programStudi.name,
        angkatan: student.angkatan,
        totalSks: student.academicSummary.totalSks,
        ipk: student.academicSummary.ipk,
        ipsLastSemester: student.academicSummary.ipsLastSemester,
        semesterActive: student.academicSummary.semesterActive,
        totalSemestersCompleted: student.academicSummary.totalSemestersCompleted,
        status: student.status
      }
    };
  }

  // ✅ MOCK API: Get grades by semester - Compatible dengan Prisma function
  async getGradesBySemester(userId, semester = null) {
    console.log('🔍 [MOCK ACADEMIC SERVICE] Getting grades for:', userId, 'Semester:', semester);
    
    await new Promise(resolve => setTimeout(resolve, 800));
    
    let userGrades = this.mockGrades.filter(grade => grade.userId === userId);
    
    if (semester) {
      userGrades = userGrades.filter(grade => grade.semester === parseInt(semester));
    }

    if (userGrades.length === 0) {
      return {
        success: false,
        message: 'Data nilai tidak ditemukan'
      };
    }

    // Group by semester dan include course data
    const groupedGrades = {};
    
    userGrades.forEach(grade => {
      const course = this.mockCourses.find(c => c.id === grade.courseId);
      
      if (!groupedGrades[grade.semester]) {
        groupedGrades[grade.semester] = [];
      }
      
      groupedGrades[grade.semester].push({
        courseCode: course?.code || 'UNKNOWN',
        courseName: course?.name || 'Mata Kuliah Tidak Diketahui',
        sks: course?.sks || 0,
        grade: grade.grade,
        gradePoint: grade.gradePoint
      });
    });

    return {
      success: true,
      data: groupedGrades
    };
  }

  // ✅ MOCK API: Get full transcript - Compatible dengan Prisma function
  async getTranscript(userId) {
    console.log('🔍 [MOCK ACADEMIC SERVICE] Getting transcript for:', userId);
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const summary = await this.getAcademicSummary(userId);
    const grades = await this.getGradesBySemester(userId);
    
    if (!summary.success || !grades.success) {
      return {
        success: false,
        message: 'Data transkrip tidak lengkap'
      };
    }

    return {
      success: true,
      data: {
        summary: summary.data,
        grades: grades.data
      }
    };
  }

  // ✅ MOCK API: Get student by NIM (untuk keperluan chat handler)
  async getStudentByNIM(nim) {
    console.log('🔍 [MOCK ACADEMIC SERVICE] Getting student by NIM:', nim);
    
    await new Promise(resolve => setTimeout(resolve, 500));
    
    const student = this.mockStudents.find(s => s.nim === nim);
    
    if (!student) {
      return {
        success: false,
        message: 'Mahasiswa tidak ditemukan'
      };
    }

    return {
      success: true,
      data: {
        userId: student.id,
        nim: student.nim,
        fullName: student.fullName,
        programStudi: student.programStudi.name,
        faculty: student.programStudi.faculty,
        angkatan: student.angkatan,
        status: student.status
      }
    };
  }

  // Helper: Normalize name for comparison (case insensitive, remove extra spaces)
  normalizeName(name) {
    return name.toLowerCase().trim().replace(/\s+/g, ' ');
  }

  // Method untuk nanti switch ke real API
  setRealAPI(baseURL, apiKey) {
    console.log('🔄 [ACADEMIC SERVICE] Switching to real API:', baseURL);
    // TODO: Implement real API integration di Phase 2
    this.isMock = false;
    this.baseURL = baseURL;
    this.apiKey = apiKey;
  }

  // Check if service is using mock data
  isMockMode() {
    return true; // Selama Phase 1
  }
}

// Export singleton instance
const academicService = new AcademicService();
export default academicService;