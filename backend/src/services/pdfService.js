const PDFDocument = require('pdfkit');
const { getTranscript } = require('./academicService');

/**
 * Generate PDF Transcript
 */
async function generateTranscriptPDF(userId) {
  try {
    // Get transcript data
    const transcriptData = await getTranscript(userId);
    
    if (!transcriptData.success) {
      throw new Error(transcriptData.message);
    }

    const { summary, grades } = transcriptData.data;

    // Create PDF document
    const doc = new PDFDocument({
      size: 'A4',
      margins: { top: 50, bottom: 50, left: 50, right: 50 }
    });

    // Header
    doc.fontSize(18).font('Helvetica-Bold').text('STMIK TAZKIA', { align: 'center' });
    doc.fontSize(12).font('Helvetica').text('Jl. Raya Ciawi-Sukabumi KM 4, Sentul, Bogor', { align: 'center' });
    doc.moveDown();
    doc.fontSize(16).font('Helvetica-Bold').text('TRANSKRIP NILAI', { align: 'center' });
    doc.moveDown(2);

    // Student Info
    doc.fontSize(11).font('Helvetica');
    doc.text(`NIM                    : ${summary.nim}`);
    doc.text(`Nama                   : ${summary.fullName}`);
    doc.text(`Program Studi          : ${summary.programStudi}`);
    doc.text(`Angkatan               : ${summary.angkatan}`);
    doc.moveDown();
    doc.text(`IPK                    : ${summary.ipk.toFixed(2)}`);
    doc.text(`Total SKS              : ${summary.totalSks}`);
    doc.text(`Semester Aktif         : ${summary.semesterActive}`);
    doc.moveDown(2);

    // Grades by semester
    Object.keys(grades).sort().forEach(semester => {
      doc.fontSize(12).font('Helvetica-Bold').text(`Semester ${semester}`, { underline: true });
      doc.moveDown(0.5);

      // Table header
      doc.fontSize(10).font('Helvetica-Bold');
      const startY = doc.y;
      doc.text('Kode', 50, startY, { width: 60 });
      doc.text('Mata Kuliah', 110, startY, { width: 200 });
      doc.text('SKS', 310, startY, { width: 40 });
      doc.text('Nilai', 350, startY, { width: 40 });
      doc.text('Grade', 390, startY, { width: 40 });
      
      doc.moveDown();
      doc.moveTo(50, doc.y).lineTo(550, doc.y).stroke();
      doc.moveDown(0.3);

      // Table content
      doc.font('Helvetica');
      let totalSks = 0;
      let totalGradePoints = 0;

      grades[semester].forEach(course => {
        const y = doc.y;
        doc.text(course.courseCode, 50, y, { width: 60 });
        doc.text(course.courseName, 110, y, { width: 200 });
        doc.text(course.sks.toString(), 310, y, { width: 40 });
        doc.text(course.grade, 350, y, { width: 40 });
        doc.text(course.gradePoint.toFixed(2), 390, y, { width: 40 });
        doc.moveDown();

        totalSks += course.sks;
        totalGradePoints += course.sks * course.gradePoint;
      });

      // Semester summary
      const ips = totalGradePoints / totalSks;
      doc.moveDown(0.5);
      doc.font('Helvetica-Bold');
      doc.text(`IPS Semester ${semester}: ${ips.toFixed(2)}     Total SKS: ${totalSks}`, { align: 'right' });
      doc.moveDown(2);
    });

    // Footer
    doc.moveDown(2);
    doc.fontSize(10).font('Helvetica');
    doc.text(`Dicetak pada: ${new Date().toLocaleDateString('id-ID', { 
      day: 'numeric', 
      month: 'long', 
      year: 'numeric' 
    })}`, { align: 'center' });

    return {
      success: true,
      doc: doc,
      filename: `Transkrip_${summary.nim}_${Date.now()}.pdf`
    };

  } catch (error) {
    console.error('Generate PDF error:', error);
    return {
      success: false,
      message: error.message || 'Gagal generate PDF'
    };
  }
}

module.exports = {
  generateTranscriptPDF
};