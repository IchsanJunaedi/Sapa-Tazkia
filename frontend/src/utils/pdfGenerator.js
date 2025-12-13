import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable'; // Import as default

export const generateTranscriptPDF = (data) => {
  // 1. VALIDASI DATA
  if (!data || !data.summary || !data.grades) {
    console.error('❌ [PDF GEN] Data tidak lengkap:', data);
    alert('Maaf, data transkrip tidak lengkap atau belum dimuat.');
    return false;
  }

  // 2. SETUP DOCUMENT
  const doc = new jsPDF();
  
  // 3. NORMALISASI DATA (Array vs Object Handler)
  let gradesArray = [];
  const { summary, grades } = data;

  if (Array.isArray(grades)) {
      gradesArray = grades;
  } else if (typeof grades === 'object' && grades !== null) {
      Object.keys(grades).forEach(sem => {
          const semesterGrades = grades[sem].map(g => ({ ...g, semester: sem }));
          gradesArray = [...gradesArray, ...semesterGrades];
      });
  }

  // Sort: Semester ASC -> Kode Matkul ASC
  gradesArray.sort((a, b) => {
      const semA = parseInt(a.semester) || 0;
      const semB = parseInt(b.semester) || 0;
      if (semA !== semB) return semA - semB;
      return (a.courseCode || '').localeCompare(b.courseCode || '');
  });

  // 4. HEADER
  doc.setFontSize(18);
  doc.setTextColor(41, 128, 185); // Biru Tazkia
  doc.setFont('helvetica', 'bold');
  doc.text('STMIK TAZKIA', 105, 20, { align: 'center' });
  
  doc.setFontSize(12);
  doc.setTextColor(0);
  doc.setFont('helvetica', 'normal');
  doc.text('TRANSKRIP NILAI', 105, 28, { align: 'center' });
  
  doc.setLineWidth(0.5);
  doc.setDrawColor(200, 200, 200);
  doc.line(14, 32, 196, 32);

  // 5. INFO MAHASISWA
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  doc.text(`Nama       : ${summary.fullName}`, 14, 42);
  doc.text(`NIM        : ${summary.nim}`, 14, 47);
  doc.text(`Prodi      : ${summary.programStudi || '-'}`, 14, 52);
  
  const totalSks = summary.totalSks || 0;
  const ipkVal = typeof summary.ipk === 'number' ? summary.ipk.toFixed(2) : summary.ipk;
  
  doc.text(`Total SKS : ${totalSks}`, 140, 42);
  doc.text(`IPK       : ${ipkVal}`, 140, 47);
  doc.text(`Status    : ${summary.status || 'Aktif'}`, 140, 52);

  // 6. TABEL NILAI (Gunakan autoTable yang diimport)
  const tableColumn = ["No", "Sem", "Kode", "Mata Kuliah", "SKS", "Nilai", "Bobot"];
  const tableRows = [];

  gradesArray.forEach((item, index) => {
    const rowData = [
      index + 1,
      item.semester,
      item.courseCode || item.code, 
      item.courseName,
      item.sks,
      item.grade,
      typeof item.gradePoint === 'number' ? item.gradePoint.toFixed(2) : item.gradePoint
    ];
    tableRows.push(rowData);
  });

  // ✅ CRITICAL FIX: Panggil autoTable sebagai fungsi global atau dari object
  autoTable(doc, {
    startY: 60,
    head: [tableColumn],
    body: tableRows,
    theme: 'grid',
    headStyles: { 
        fillColor: [255, 140, 0], // Orange
        textColor: 255,
        fontStyle: 'bold',
        halign: 'center'
    }, 
    styles: { 
        fontSize: 9,
        cellPadding: 3,
        valign: 'middle'
    },
    columnStyles: {
        0: { halign: 'center', cellWidth: 10 },
        1: { halign: 'center', cellWidth: 15 },
        2: { cellWidth: 25 },
        3: { cellWidth: 'auto' },
        4: { halign: 'center', cellWidth: 15 },
        5: { halign: 'center', cellWidth: 15 },
        6: { halign: 'center', cellWidth: 15 }
    },
    alternateRowStyles: { fillColor: [245, 245, 245] }
  });

  // 7. FOOTER
  const finalY = doc.lastAutoTable.finalY + 15;
  const today = new Date().toLocaleDateString('id-ID', {
    day: 'numeric', month: 'long', year: 'numeric'
  });

  if (finalY > 250) {
      doc.addPage();
      doc.text(`Bogor, ${today}`, 140, 30);
      doc.text('Bagian Akademik', 140, 35);
      doc.text('(Dokumen Digital)', 140, 55);
  } else {
      doc.text(`Bogor, ${today}`, 140, finalY);
      doc.text('Bagian Akademik', 140, finalY + 5);
      
      doc.setFontSize(8);
      doc.setFont('helvetica', 'italic');
      doc.setTextColor(150);
      doc.text('*Dokumen ini digenerate secara otomatis oleh Sapa Tazkia AI', 14, 285);
  }

  doc.save(`Transkrip_${summary.nim}.pdf`);
  return true;
};  