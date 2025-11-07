// M:/Sapa-Tazkia/backend/server.js
const express = require('express');
const cors = require('cors');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { PrismaClient } = require('@prisma/client');
const PDFDocument = require('pdfkit');
require('dotenv').config(); // Pastikan variabel .env dimuat

const prisma = new PrismaClient();
const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json()); // Ini penting untuk membaca body JSON dari request

// === 1. RUTE AUTENTIKASI (LOGIN) ===
app.post('/api/auth/login', async (req, res) => {
  console.log('Login attempt:', req.body);
  const { nim, password } = req.body;

  if (!nim || !password) {
    return res.status(400).json({ success: false, message: "NIM dan password tidak boleh kosong" });
  }

  try {
    // 1. Cari user berdasarkan NIM, sertakan Program Studi
    const user = await prisma.user.findUnique({
      where: { nim },
      include: {
        programStudi: true // Mengambil data relasi ProgramStudi
      }
    });

    if (!user) {
      return res.status(404).json({ success: false, message: "NIM tidak ditemukan" });
    }

    // 2. Bandingkan password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      return res.status(401).json({ success: false, message: "Password salah" });
    }

    // 3. Ambil data IPK dari AcademicSummary
    const summary = await prisma.academicSummary.findUnique({
      where: { userId: user.id }
    });

    // 4. Buat JSON Web Token (JWT)
    const token = jwt.sign(
      { userId: user.id, nim: user.nim },
      process.env.JWT_SECRET, // Pastikan Anda punya JWT_SECRET di .env
      { expiresIn: '1d' } // Token berlaku selama 1 hari
    );

    // 5. Susun respons user sesuai ekspektasi
    const userResponse = {
      id: user.id,
      nim: user.nim,
      fullName: user.fullName,
      email: user.email,
      programStudi: user.programStudi ? user.programStudi.name : null, // Ambil 'name' dari relasi
      angkatan: user.angkatan,
      ipk: summary ? summary.ipk.toString() : "0.00", // Ambil IPK dari summary
      status: user.status
    };

    // 6. Kirim respons sukses
    res.json({
      success: true,
      message: "Login berhasil",
      token: token,
      user: userResponse
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
  }
});

// === 2. MIDDLEWARE AUTENTIKASI ===
// Fungsi ini akan memproteksi rute di bawahnya
const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: "Akses ditolak. Token tidak disediakan." });
  }

  const token = authHeader.split(' ')[1]; // Ambil token dari 'Bearer <token>'

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded; // Simpan data user ( { userId, nim } ) ke request
    next(); // Lanjutkan ke rute berikutnya
  } catch (error) {
    res.status(401).json({ success: false, message: "Token tidak valid." });
  }
};

// === 3. RUTE AKADEMIK (TERPROTEKSI) ===

// Rute ini menerapkan authMiddleware. Hanya bisa diakses DENGAN token.
app.use('/api/academic', authMiddleware);

// GET /api/academic/summary
app.get('/api/academic/summary', async (req, res) => {
  try {
    const summary = await prisma.academicSummary.findUnique({
      where: { userId: req.user.userId } // req.user.userId didapat dari middleware
    });

    if (!summary) {
      return res.status(404).json({ success: false, message: "Data summary akademik tidak ditemukan." });
    }
    res.json({ success: true, summary });
  } catch (error) {
    console.error("Get summary error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
  }
});

// GET /api/academic/grades
app.get('/api/academic/grades', async (req, res) => {
  try {
    const grades = await prisma.academicGrade.findMany({
      where: { userId: req.user.userId },
      include: {
        course: true // Sertakan detail mata kuliah
      },
    });

    res.json({ success: true, grades });
  } catch (error) {
    console.error("Get grades error:", error);
    res.status(500).json({ success: false, message: "Terjadi kesalahan pada server" });
  }
});

// GET /api/academic/transcript/pdf
app.get('/api/academic/transcript/pdf', async (req, res) => {
  try {
    // 1. Ambil data user dan nilai
    const userId = req.user.userId;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { programStudi: true }
    });
    
    const grades = await prisma.academicGrade.findMany({
      where: { userId: userId },
      include: { course: true },
    });
    
    const summary = await prisma.academicSummary.findUnique({
      where: { userId: userId }
    });

    // 2. Buat PDF
    const doc = new PDFDocument({ margin: 50 });

    // Set header respons untuk download PDF
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transkrip_${user.nim}.pdf"`);

    // Salurkan output PDF ke respons HTTP
    doc.pipe(res);

    // 3. Isi konten PDF
    doc.fontSize(18).text('Transkrip Nilai Akademik', { align: 'center' });
    doc.moveDown();
    
    doc.fontSize(12).text(`Nama: ${user.fullName}`);
    doc.text(`NIM: ${user.nim}`);
    doc.text(`Program Studi: ${user.programStudi.name}`);
    doc.moveDown();

    doc.text(`IPK: ${summary ? summary.ipk : 'N/A'}`);
    doc.text(`Total SKS: ${summary ? summary.totalSks : 'N/A'}`);
    doc.moveDown();

    doc.fontSize(14).text('Daftar Nilai', { underline: true });
    doc.moveDown();

    // Header Tabel
    let y = doc.y;
    doc.fontSize(10).text('Kode', 50, y);
    doc.text('Mata Kuliah', 150, y);
    doc.text('SKS', 350, y);
    doc.text('Nilai', 400, y);
    doc.text('Poin', 450, y);
    doc.moveDown();

    // Isi Tabel
    for (const grade of grades) {
      y = doc.y;
      doc.text(grade.course.code, 50, y);
      doc.text(grade.course.name, 150, y);
      doc.text(grade.course.sks, 350, y);
      doc.text(grade.grade, 400, y);
      doc.text(grade.gradePoint.toFixed(2), 450, y);
      doc.moveDown(0.5);
    }

    // 4. Selesaikan PDF
    doc.end();

  } catch (error) {
    console.error("Get PDF error:", error);
    res.status(500).json({ success: false, message: "Gagal membuat PDF" });
  }
});


// Menjalankan Server
app.listen(PORT, () => {
  console.log(`🚀 Server listening on http://localhost:${PORT}`);
});