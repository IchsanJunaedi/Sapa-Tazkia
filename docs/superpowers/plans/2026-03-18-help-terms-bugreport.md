# Help Center, Terms & Policies, Report a Bug — Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add three pages (Help Center, Terms & Policies, Report a Bug), wire them into the ProfilePopover, and add a Bug Reports tab to AdminDashboard with full backend support.

**Architecture:** Backend-first (Prisma → controller → route → app.js), then frontend pages (static pages first, then the form page that calls the API), finally Admin Dashboard tab. ProfilePopover gets `useNavigate` so clicks route directly without prop drilling.

**Tech Stack:** React 19, React Router v6, Tailwind CSS, Node.js/Express, Prisma (MySQL), lucide-react, axios

---

## File Map

| Action | File |
|--------|------|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/src/controllers/bugReportController.js` |
| Create | `backend/src/routes/bugReportRoutes.js` |
| Modify | `backend/src/app.js` |
| Modify | `backend/src/controllers/adminController.js` |
| Modify | `backend/src/routes/adminRoutes.js` |
| Modify | `frontend/src/components/layout/ProfilePopover.jsx` |
| Modify | `frontend/src/App.js` |
| Create | `frontend/src/pages/HelpCenterPage.jsx` |
| Create | `frontend/src/pages/TermsPoliciesPage.jsx` |
| Create | `frontend/src/pages/ReportBugPage.jsx` |
| Modify | `frontend/src/pages/AdminDashboard.jsx` |

---

## Task 1: Prisma — Add BugReport Model

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Add BugReport model and back-relation to User**

In `backend/prisma/schema.prisma`, find the `User` model's relations block. After the last relation line (currently `sessions Session[]`), add:

```prisma
  bugReports    BugReport[]
```

Then at the very end of the file (after `AnalyticsSnapshot`), add:

```prisma
//
// ==================== BUG REPORTS ====================
//

model BugReport {
  id        Int      @id @default(autoincrement())
  title     String   @db.VarChar(200)
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())

  @@map("bug_reports")
}
```

- [ ] **Step 2: Apply schema to database**

```bash
cd E:/sapa-tazkia/backend && npm run db:push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Commit**

```bash
cd E:/sapa-tazkia
git add backend/prisma/schema.prisma
git commit -m "feat: add BugReport prisma model

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 2: Backend — Bug Report Controller + Route

**Files:**
- Create: `backend/src/controllers/bugReportController.js`
- Create: `backend/src/routes/bugReportRoutes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 4: Create bugReportController.js**

Create `backend/src/controllers/bugReportController.js`:

```js
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
```

- [ ] **Step 5: Create bugReportRoutes.js**

Create `backend/src/routes/bugReportRoutes.js`:

```js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { createBugReport } = require('../controllers/bugReportController');

router.post('/', requireAuth, createBugReport);

module.exports = router;
```

- [ ] **Step 6: Register route in app.js**

In `backend/src/app.js`, find this block:

```js
const adminRoutes = require('./routes/adminRoutes');         // ✅ NEW: Admin Routes
```

Add immediately after it:

```js
const bugReportRoutes = require('./routes/bugReportRoutes'); // ✅ NEW: Bug Report Routes
```

Then find:

```js
app.use('/api/admin', adminRoutes);
```

Add immediately after it:

```js
app.use('/api/bug-reports', bugReportRoutes);
```

- [ ] **Step 7: Verify backend starts without errors**

```bash
cd E:/sapa-tazkia/backend && npm run dev
```

Expected: Server starts, no crash. Check for `Listening on port ...` in output. Stop with Ctrl+C.

- [ ] **Step 8: Commit**

```bash
cd E:/sapa-tazkia
git add backend/src/controllers/bugReportController.js \
        backend/src/routes/bugReportRoutes.js \
        backend/src/app.js
git commit -m "feat: add POST /api/bug-reports endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 3: Backend — Admin Bug Reports Endpoint

**Files:**
- Modify: `backend/src/controllers/adminController.js`
- Modify: `backend/src/routes/adminRoutes.js`

- [ ] **Step 9: Add getBugReports to adminController.js**

In `backend/src/controllers/adminController.js`, find the last `module.exports` block:

```js
module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics,
    listKnowledgeBase,
    addKnowledgeDoc,
    deleteKnowledgeDoc
};
```

Replace with:

```js
const getBugReports = async (req, res) => {
  try {
    const reports = await prisma.bugReport.findMany({
      include: { user: { select: { fullName: true, email: true } } },
      orderBy: { createdAt: 'desc' },
    });
    return res.json({ success: true, reports });
  } catch (error) {
    console.error('❌ [ADMIN] getBugReports Error:', error);
    return res.status(500).json({ success: false, message: 'Gagal mengambil laporan bug.' });
  }
};

module.exports = {
    getChatLogs,
    getRealtimeAnalytics,
    getHistoryAnalytics,
    listKnowledgeBase,
    addKnowledgeDoc,
    deleteKnowledgeDoc,
    getBugReports
};
```

- [ ] **Step 10: Add route in adminRoutes.js**

In `backend/src/routes/adminRoutes.js`, find:

```js
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc } = require('../controllers/adminController');
```

Replace with:

```js
const { getChatLogs, getRealtimeAnalytics, getHistoryAnalytics, listKnowledgeBase, addKnowledgeDoc, deleteKnowledgeDoc, getBugReports } = require('../controllers/adminController');
```

Then find:

```js
router.delete('/knowledge-base/:id', deleteKnowledgeDoc);
```

Add immediately after it:

```js
// Bug Reports
router.get('/bug-reports', getBugReports);
```

- [ ] **Step 11: Commit**

```bash
cd E:/sapa-tazkia
git add backend/src/controllers/adminController.js \
        backend/src/routes/adminRoutes.js
git commit -m "feat: add GET /api/admin/bug-reports endpoint

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 4: Frontend — ProfilePopover Navigation

**Files:**
- Modify: `frontend/src/components/layout/ProfilePopover.jsx`

The Help sub-menu items need to navigate when clicked. We add `useNavigate` directly in the component (it's always rendered inside `<Router>`).

- [ ] **Step 12: Add useNavigate + route map to ProfilePopover**

In `frontend/src/components/layout/ProfilePopover.jsx`, find:

```js
import React, { useState, useRef } from 'react';
import { LogOut, HelpCircle, ChevronRight, ChevronDown, Settings } from 'lucide-react';
```

Replace with:

```js
import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut, HelpCircle, ChevronRight, ChevronDown, Settings } from 'lucide-react';
```

Then find:

```js
const HELP_ITEMS = [
  { label: 'Help center' },
  { label: 'Terms & policies' },
  { label: 'Team dev' },
  { label: 'Report a bug' },
];
```

Replace with:

```js
const HELP_ITEMS = [
  { label: 'Help center', path: '/help' },
  { label: 'Terms & policies', path: '/terms' },
  { label: 'Team dev', path: null },
  { label: 'Report a bug', path: '/report-bug' },
];
```

Then find the line:

```js
  const [helpOpen, setHelpOpen] = useState(false);
```

Add immediately after it:

```js
  const navigate = useNavigate();
```

- [ ] **Step 13: Wire onClick on help items (desktop flyout)**

Find the desktop flyout items (inside `{helpOpen && !isMobile && ...}`):

```jsx
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10"
                  >
                    {item.label}
                  </button>
                ))}
```

Replace with:

```jsx
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { if (item.path) { navigate(item.path); onClose(); } }}
                    disabled={!item.path}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors ${
                      item.path ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
```

- [ ] **Step 14: Wire onClick on help items (mobile accordion)**

Find the mobile accordion items (inside `{helpOpen && isMobile && ...}`):

```jsx
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    className="w-full text-left px-3 py-2 text-sm rounded-lg transition-colors hover:bg-white/10 text-gray-300"
                  >
                    {item.label}
                  </button>
                ))}
```

Replace with:

```jsx
                {HELP_ITEMS.map((item) => (
                  <button
                    key={item.label}
                    onClick={() => { if (item.path) { navigate(item.path); onClose(); } }}
                    disabled={!item.path}
                    className={`w-full text-left px-3 py-2 text-sm rounded-lg transition-colors text-gray-300 ${
                      item.path ? 'hover:bg-white/10' : 'opacity-40 cursor-not-allowed'
                    }`}
                  >
                    {item.label}
                  </button>
                ))}
```

- [ ] **Step 15: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/components/layout/ProfilePopover.jsx
git commit -m "feat: wire ProfilePopover help items to routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 5: Frontend — App.js Routes

**Files:**
- Modify: `frontend/src/App.js`

- [ ] **Step 16: Add imports and routes in App.js**

In `frontend/src/App.js`, find:

```js
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
```

Add immediately after it:

```js
import HelpCenterPage from './pages/HelpCenterPage';
import TermsPoliciesPage from './pages/TermsPoliciesPage';
import ReportBugPage from './pages/ReportBugPage';
```

Then find the public routes block:

```jsx
          <Route path="/verify-email" element={<VerifyEmailPage />} />
```

Add immediately after it:

```jsx
          {/* ✅ NEW: Static Info Pages (public) */}
          <Route path="/help" element={<HelpCenterPage />} />
          <Route path="/terms" element={<TermsPoliciesPage />} />
```

Then find:

```jsx
          {/* Route untuk ChatPage */}
```

Add immediately before it:

```jsx
          {/* ✅ NEW: Report a Bug (protected) */}
          <Route
            path="/report-bug"
            element={
              <ProtectedRoute>
                <ReportBugPage />
              </ProtectedRoute>
            }
          />
```

- [ ] **Step 17: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/App.js
git commit -m "feat: add /help, /terms, /report-bug routes

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 6: Frontend — HelpCenterPage

**Files:**
- Create: `frontend/src/pages/HelpCenterPage.jsx`

- [ ] **Step 18: Create HelpCenterPage.jsx**

Create `frontend/src/pages/HelpCenterPage.jsx`:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, ArrowLeft } from 'lucide-react';

const FAQ_DATA = [
  {
    category: 'Akun & Login',
    items: [
      {
        q: 'Bagaimana cara login ke SAPA?',
        a: 'Kamu bisa login menggunakan NIM dan password, atau akun Google. Klik tombol "Login" di halaman utama lalu pilih metode yang kamu inginkan.',
      },
      {
        q: 'Apakah saya bisa login dengan Google?',
        a: 'Ya! SAPA mendukung login dengan Google. Pastikan email Google kamu sudah terdaftar di sistem institusi.',
      },
      {
        q: 'Bagaimana jika lupa password?',
        a: 'Hubungi admin institusi untuk reset password. Fitur reset password mandiri sedang dalam pengembangan.',
      },
      {
        q: 'Bagaimana cara menghapus akun saya?',
        a: 'Untuk menghapus akun, silakan hubungi admin institusi. Data akan dihapus sesuai kebijakan privasi kami.',
      },
    ],
  },
  {
    category: 'Chat AI',
    items: [
      {
        q: 'Apa itu SAPA dan bagaimana cara kerjanya?',
        a: 'SAPA adalah asisten akademik berbasis AI yang menjawab pertanyaan mahasiswa menggunakan teknologi RAG. AI mencari informasi dari dokumen akademik yang relevan sebelum menjawab.',
      },
      {
        q: 'Apa itu RAG (Retrieval-Augmented Generation)?',
        a: 'RAG adalah teknologi yang memungkinkan AI mencari informasi dari dokumen yang tersimpan sebelum memberi jawaban. Hasilnya lebih akurat dan relevan dibanding AI generatif biasa.',
      },
      {
        q: 'Berapa batas pesan yang bisa saya kirim?',
        a: 'Setiap pengguna memiliki kuota pesan harian yang diisi ulang otomatis. Kamu bisa melihat sisa kuota di pojok kanan atas halaman chat.',
      },
      {
        q: 'Mengapa jawaban AI kadang berbeda untuk pertanyaan yang sama?',
        a: 'AI menghasilkan jawaban secara probabilistik sehingga variasi kecil adalah hal wajar. Jika jawaban kurang tepat, coba reformulasi pertanyaanmu dengan lebih spesifik.',
      },
    ],
  },
  {
    category: 'Nilai & Transkrip',
    items: [
      {
        q: 'Bagaimana cara melihat nilai saya?',
        a: 'Setelah login, buka menu "Akademik" di sidebar. Di sana kamu bisa melihat IPK, ringkasan nilai, dan detail mata kuliah.',
      },
      {
        q: 'Apakah data nilai saya aman?',
        a: 'Ya. Data nilai hanya bisa diakses oleh kamu setelah login. Kami menggunakan enkripsi dan JWT untuk melindungi data.',
      },
      {
        q: 'Bagaimana cara memperbarui data akademik?',
        a: 'Data akademik diperbarui oleh admin institusi. Jika ada data yang tidak sesuai, hubungi bagian akademik kampusmu.',
      },
    ],
  },
  {
    category: 'Privasi & Keamanan',
    items: [
      {
        q: 'Di mana data saya disimpan?',
        a: 'Data disimpan di server institusi yang aman. Kami tidak menjual atau membagikan data ke pihak ketiga tanpa izin.',
      },
      {
        q: 'Apakah percakapan saya dengan AI disimpan?',
        a: 'Ya, riwayat percakapan disimpan agar kamu bisa melanjutkan sesi sebelumnya. Kamu bisa menghapus percakapan kapan saja dari halaman chat.',
      },
      {
        q: 'Bagaimana SAPA melindungi data pengguna?',
        a: 'Kami menggunakan HTTPS, JWT, Redis session management, dan enkripsi password. Data sensitif tidak pernah disimpan dalam plaintext.',
      },
    ],
  },
];

const AccordionItem = ({ question, answer }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-b border-white/10 last:border-0">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between py-4 text-left gap-4 hover:text-white transition-colors"
      >
        <span className="text-sm font-medium text-white/90 leading-snug">{question}</span>
        <ChevronDown
          size={16}
          className={`text-white/40 shrink-0 transition-transform duration-200 ${open ? 'rotate-180' : ''}`}
        />
      </button>
      {open && (
        <p className="pb-4 text-sm text-white/70 leading-relaxed">{answer}</p>
      )}
    </div>
  );
};

export default function HelpCenterPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}
    >
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {/* Header */}
        <h1 className="text-2xl md:text-3xl font-bold mb-2">Help Center</h1>
        <p className="text-white/50 text-sm mb-10">Temukan jawaban atas pertanyaan kamu di sini.</p>

        {/* Categories */}
        <div className="space-y-8">
          {FAQ_DATA.map((cat) => (
            <div key={cat.category}>
              <h2 className="text-xs font-semibold uppercase tracking-widest text-white/40 mb-3">
                {cat.category}
              </h2>
              <div className="bg-white/5 border border-white/10 rounded-xl px-5">
                {cat.items.map((item) => (
                  <AccordionItem key={item.q} question={item.q} answer={item.a} />
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Footer CTA */}
        <div className="mt-12 text-center">
          <p className="text-white/40 text-sm mb-3">Tidak menemukan jawaban yang kamu cari?</p>
          <button
            onClick={() => navigate('/report-bug')}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
          >
            Laporkan masalah
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 19: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/pages/HelpCenterPage.jsx
git commit -m "feat: add HelpCenterPage with FAQ accordion

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 7: Frontend — TermsPoliciesPage

**Files:**
- Create: `frontend/src/pages/TermsPoliciesPage.jsx`

- [ ] **Step 20: Create TermsPoliciesPage.jsx**

Create `frontend/src/pages/TermsPoliciesPage.jsx`:

```jsx
import React from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft } from 'lucide-react';

const SECTIONS = [
  {
    title: 'Penerimaan Syarat',
    content:
      'Dengan mengakses atau menggunakan layanan SAPA ("Layanan"), kamu menyatakan telah membaca, memahami, dan menyetujui seluruh syarat dan ketentuan ini ("Syarat"). Jika kamu tidak menyetujui Syarat ini, harap hentikan penggunaan Layanan.',
  },
  {
    title: 'Penggunaan Layanan',
    content:
      'Layanan SAPA hanya boleh digunakan untuk keperluan akademik yang sah. Dengan menggunakan Layanan, kamu setuju untuk tidak: (a) menyalahgunakan Layanan untuk tujuan ilegal atau berbahaya; (b) mencoba meretas, mengubah, atau mengganggu sistem; (c) menggunakan bot atau alat otomatis tanpa izin tertulis; (d) menyamar sebagai orang lain atau institusi.',
  },
  {
    title: 'Akun Pengguna',
    content:
      'Kamu bertanggung jawab penuh atas keamanan akun dan semua aktivitas yang terjadi di bawah akunmu. Jangan bagikan kredensial login kepada siapa pun. Segera laporkan kepada kami jika kamu mencurigai adanya akses tidak sah ke akunmu. Kami berhak menangguhkan atau menghapus akun yang melanggar Syarat ini.',
  },
  {
    title: 'Konten & Kekayaan Intelektual',
    content:
      'Seluruh konten yang disediakan oleh Layanan — termasuk teks, desain, antarmuka, dan kode — adalah milik Tim SAPA dan dilindungi oleh hukum kekayaan intelektual yang berlaku. Jawaban yang dihasilkan AI bersifat informatif dan bukan merupakan nasihat akademik resmi. Pengguna tetap bertanggung jawab atas cara penggunaan konten tersebut.',
  },
  {
    title: 'Privasi & Data',
    content:
      'Pengumpulan dan penggunaan data pribadimu diatur dalam kebijakan privasi kami. Kami hanya mengumpulkan data yang diperlukan untuk menjalankan Layanan dan tidak akan menjualnya kepada pihak ketiga. Dengan menggunakan Layanan, kamu menyetujui pengumpulan dan pemrosesan data sebagaimana dimaksud.',
  },
  {
    title: 'Batasan Tanggung Jawab',
    content:
      'Layanan disediakan "sebagaimana adanya" tanpa jaminan apa pun, baik tersurat maupun tersirat. Tim SAPA tidak bertanggung jawab atas kerugian langsung maupun tidak langsung yang timbul dari penggunaan atau ketidakmampuan menggunakan Layanan. Informasi yang diberikan oleh AI bukan pengganti konsultasi dengan penasihat akademik resmi institusimu.',
  },
  {
    title: 'Perubahan Layanan',
    content:
      'Tim SAPA berhak mengubah, menangguhkan, atau menghentikan Layanan kapan saja. Kami akan berusaha memberikan pemberitahuan yang wajar jika terjadi perubahan signifikan yang memengaruhi penggunaan Layanan.',
  },
  {
    title: 'Kontak',
    content:
      'Jika kamu memiliki pertanyaan tentang Syarat ini atau menemukan masalah dalam penggunaan Layanan, silakan hubungi kami melalui halaman Report a Bug atau hubungi admin institusimu secara langsung.',
  },
];

export default function TermsPoliciesPage() {
  const navigate = useNavigate();

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}
    >
      <div className="max-w-3xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {/* Header */}
        <h1 className="text-2xl md:text-3xl font-bold mb-1">Terms & Policies</h1>
        <p className="text-white/30 text-xs mb-10">Terakhir diperbarui: 18 Maret 2026</p>

        {/* Sections */}
        <div className="space-y-8">
          {SECTIONS.map((sec, idx) => (
            <div key={sec.title}>
              <h2 className="text-base font-semibold mb-2 text-white">
                {idx + 1}. {sec.title}
              </h2>
              <p className="text-sm text-white/70 leading-relaxed">{sec.content}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 21: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/pages/TermsPoliciesPage.jsx
git commit -m "feat: add TermsPoliciesPage

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 8: Frontend — ReportBugPage

**Files:**
- Create: `frontend/src/pages/ReportBugPage.jsx`

- [ ] **Step 22: Create ReportBugPage.jsx**

Create `frontend/src/pages/ReportBugPage.jsx`:

```jsx
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Bug } from 'lucide-react';
import axios from 'axios';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ReportBugPage() {
  const navigate = useNavigate();
  const [title, setTitle] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (title.trim().length < 10) {
      setError('Judul minimal 10 karakter.');
      return;
    }
    if (title.trim().length > 200) {
      setError('Judul maksimal 200 karakter.');
      return;
    }

    try {
      setLoading(true);
      const token = localStorage.getItem('token');
      await axios.post(
        `${API}/bug-reports`,
        { title: title.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || 'Gagal mengirim laporan. Coba lagi.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      className="min-h-screen text-white"
      style={{ background: 'linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)' }}
    >
      <div className="max-w-xl mx-auto px-4 md:px-8 py-10 md:py-16">
        {/* Back */}
        <button
          onClick={() => navigate(-1)}
          className="flex items-center gap-2 text-white/50 hover:text-white text-sm mb-8 transition-colors"
        >
          <ArrowLeft size={16} /> Kembali
        </button>

        {!submitted ? (
          <>
            {/* Header */}
            <div className="flex items-center gap-3 mb-2">
              <Bug size={22} className="text-white/60" />
              <h1 className="text-2xl md:text-3xl font-bold">Report a Bug</h1>
            </div>
            <p className="text-white/50 text-sm mb-8">Temukan masalah? Beritahu kami.</p>

            {/* Form */}
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-white/80 mb-1.5">
                  Judul Bug <span className="text-red-400">*</span>
                </label>
                <input
                  type="text"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="Contoh: Tombol kirim pesan tidak merespons"
                  maxLength={200}
                  className="w-full px-4 py-3 rounded-xl bg-white/10 border border-white/20 text-white placeholder-white/30 text-sm focus:outline-none focus:border-white/50 transition-colors"
                />
                <div className="flex justify-between mt-1.5">
                  {error
                    ? <p className="text-red-400 text-xs">{error}</p>
                    : <span />
                  }
                  <span className="text-white/25 text-xs ml-auto">{title.length}/200</span>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full py-3 rounded-xl bg-indigo-500 hover:bg-indigo-400 disabled:opacity-50 disabled:cursor-not-allowed font-medium text-sm transition-colors"
              >
                {loading ? 'Mengirim...' : 'Kirim Laporan'}
              </button>
            </form>
          </>
        ) : (
          /* Success state */
          <div className="text-center py-12">
            <CheckCircle size={48} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-xl font-bold mb-2">Laporan Terkirim!</h2>
            <p className="text-white/50 text-sm mb-8">
              Terima kasih sudah melaporkan masalah ini. Tim kami akan segera menindaklanjutinya.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={() => { setTitle(''); setSubmitted(false); }}
                className="px-5 py-2.5 rounded-xl bg-white/10 hover:bg-white/15 border border-white/10 text-sm font-medium transition-colors"
              >
                Kirim laporan lain
              </button>
              <button
                onClick={() => navigate('/chat')}
                className="px-5 py-2.5 rounded-xl bg-indigo-500 hover:bg-indigo-400 text-sm font-medium transition-colors"
              >
                Kembali ke Chat
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 23: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/pages/ReportBugPage.jsx
git commit -m "feat: add ReportBugPage with form and success state

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 9: Frontend — Admin Dashboard Bug Reports Tab

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 24: Add Bug import to lucide-react imports**

In `AdminDashboard.jsx`, find the lucide-react import block. It currently imports `HelpCircle` and others. Find:

```js
    HelpCircle,
```

Add immediately after it:

```js
    Bug,
```

- [ ] **Step 25: Add BugReportsView component**

In `AdminDashboard.jsx`, find the line:

```js
// ─── Main AdminDashboard ──────────────────────────────────────────────────────
```

Add immediately before it:

```js
// ─── Bug Reports View ─────────────────────────────────────────────────────────

const BugReportsView = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API}/admin/bug-reports`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setReports(res.data.reports);
            } catch (err) {
                setError(err.response?.data?.message || 'Gagal memuat laporan bug');
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    if (loading) return <p className="text-[#a1a1aa] text-sm p-2">Memuat laporan...</p>;
    if (error) return <p className="text-red-400 text-sm p-2">{error}</p>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[#e4e4e7] font-semibold">Bug Reports</h3>
                <span className="text-xs text-[#71717a]">{reports.length} laporan</span>
            </div>
            {reports.length === 0 ? (
                <p className="text-[#71717a] text-sm">Belum ada laporan bug.</p>
            ) : (
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#27272a]">
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">No</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Judul Bug</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Dilaporkan oleh</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r, idx) => (
                                <tr
                                    key={r.id}
                                    className="border-b border-[#27272a] last:border-0 hover:bg-[#27272a]/50 transition-colors"
                                >
                                    <td className="px-4 py-3 text-[#71717a]">{idx + 1}</td>
                                    <td className="px-4 py-3 text-[#e4e4e7]">{r.title}</td>
                                    <td className="px-4 py-3 text-[#a1a1aa]">
                                        <div className="text-sm">{r.user?.fullName}</div>
                                        <div className="text-xs text-[#71717a]">{r.user?.email}</div>
                                    </td>
                                    <td className="px-4 py-3 text-[#71717a] text-xs whitespace-nowrap">
                                        {new Date(r.createdAt).toLocaleDateString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
        </div>
    );
};

```

- [ ] **Step 26: Add 'bug-reports' to tabTitles**

Find:

```js
    const tabTitles = {
        analytics: 'Analytics',
        logs: 'Live Chat Logs',
        'knowledge-base': 'Knowledge Base',
    };
```

Replace with:

```js
    const tabTitles = {
        analytics: 'Analytics',
        logs: 'Live Chat Logs',
        'knowledge-base': 'Knowledge Base',
        'bug-reports': 'Bug Reports',
    };
```

- [ ] **Step 27: Add 'bug-reports' to navItems**

Find:

```js
        { id: 'knowledge-base', label: 'Knowledge Base', icon: <BookOpen size={18} /> },
    ];
```

Replace with:

```js
        { id: 'knowledge-base', label: 'Knowledge Base', icon: <BookOpen size={18} /> },
        { id: 'bug-reports', label: 'Bug Reports', icon: <Bug size={18} /> },
    ];
```

- [ ] **Step 28: Add Bug Reports tab content render**

Find:

```jsx
                        {/* ── Knowledge Base Tab ─────────────────────────── */}
                        {activeTab === 'knowledge-base' && <KnowledgeBaseView />}
```

Add immediately after it:

```jsx
                        {/* ── Bug Reports Tab ────────────────────────────── */}
                        {activeTab === 'bug-reports' && <BugReportsView />}
```

- [ ] **Step 29: Commit**

```bash
cd E:/sapa-tazkia
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat: add Bug Reports tab to AdminDashboard

Co-Authored-By: Claude Sonnet 4.6 <noreply@anthropic.com>"
```

---

## Task 10: Build Verification

- [ ] **Step 30: Build frontend to verify no compile errors**

```bash
cd E:/sapa-tazkia/frontend && CI=false npm run build 2>&1 | tail -10
```

Expected: `The build folder is ready to be deployed.` — no errors.

- [ ] **Step 31: Verify backend starts**

```bash
cd E:/sapa-tazkia/backend && npm run dev 2>&1 | head -20
```

Expected: Server starts without crash. Stop with Ctrl+C.
