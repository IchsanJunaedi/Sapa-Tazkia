const prisma = require('../config/prismaClient');

const createBugReport = async (req, res) => {
  try {
    const { title } = req.body;

    if (!title || title.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Judul minimal 10 karakter.' });
    }
    if (title.trim().length > 200) {
      return res.status(400).json({ success: false, message: 'Judul maksimal 200 karakter.' });
    }

    const report = await prisma.bugReport.create({
      data: { title: title.trim(), userId: req.user.id },
    });

    return res.status(201).json({ success: true, id: report.id });
  } catch (error) {
    console.error('❌ [BUG REPORT] createBugReport Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal menyimpan laporan.' });
  }
};

module.exports = { createBugReport };
