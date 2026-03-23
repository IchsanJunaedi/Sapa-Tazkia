# Feature Expansion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tambah 3 fitur ke SAPA-TAZKIA — Dark/Light Mode, Suggested Prompts (dengan admin CRUD + RAG auto-generate + sidebar search), dan Notification System (in-app, user only, polling).

**Architecture:** ThemeContext dan NotificationContext dibuat terpisah mengikuti pola AuthContext yang sudah ada. Semua endpoint admin ditambahkan di dalam `adminRoutes.js` yang sudah ada (bukan file baru) agar IP whitelist berlaku otomatis. SideBar.jsx dimodifikasi secara sequential di Task 3 (theme toggle + search) dan Task 8 (bell icon).

**Tech Stack:** React 19, Tailwind CSS (`darkMode: 'class'`), Node.js/Express, Prisma/MySQL, Redis (cache prompt RAG), Jest + Supertest (backend tests).

**Spec:** `docs/superpowers/specs/2026-03-23-feature-expansion-design.md`

---

## File Map

### Baru — Backend
| File | Tanggung Jawab |
|------|---------------|
| `backend/src/controllers/suggestedPromptController.js` | CRUD prompt + GET public + RAG generate |
| `backend/src/services/ragService.js` | Tambah `getSampleDocuments()` menggunakan `listDocuments()` yang sudah ada |
| `backend/src/controllers/notificationController.js` | GET notifikasi user, mark read, fan-out announcement |
| `backend/src/routes/notificationRoutes.js` | Mount user notification endpoints |
| `backend/tests/unit/suggestedPrompt.test.js` | Unit tests controller suggested prompt |
| `backend/tests/unit/notification.test.js` | Unit tests controller notification |

### Baru — Frontend
| File | Tanggung Jawab |
|------|---------------|
| `frontend/src/context/ThemeContext.js` | State theme, toggle, sync ke localStorage + DOM |
| `frontend/src/context/NotificationContext.js` | Polling notifikasi, state, mark read |
| `frontend/src/components/chat/SuggestedPromptCards.jsx` | Kartu prompt di LandingPage |
| `frontend/src/components/common/NotificationDropdown.jsx` | Dropdown list notifikasi |

### Dimodifikasi — Backend
| File | Perubahan |
|------|-----------|
| `backend/prisma/schema.prisma` | Tambah `PromptSource` enum + `SuggestedPrompt` + `Announcement` + `Notification` model + `notifications` back-relation di `User` |
| `backend/src/routes/aiRoutes.js` | Mount `GET /suggested-prompts` dan `GET /suggested-prompts/rag` |
| `backend/src/routes/adminRoutes.js` | Mount admin suggested-prompt CRUD + announcement endpoints |
| `backend/src/app.js` | Mount `notificationRoutes` di `/api/notifications` |

### Dimodifikasi — Frontend
| File | Perubahan |
|------|-----------|
| `frontend/tailwind.config.js` | Tambah `darkMode: 'class'` |
| `frontend/src/App.js` | Wrap `<ThemeProvider>` + `<NotificationProvider>` |
| `frontend/src/components/layout/SideBar.jsx` | Search input (Task 5) + theme toggle button (Task 4) + bell icon (Task 9) |
| `frontend/src/pages/LandingPage.jsx` | Tambah `<SuggestedPromptCards>` section |
| `frontend/src/pages/ChatPage.jsx` | Baca + clear `location.state.prompt` on mount |
| `frontend/src/pages/AdminDashboard.jsx` | Tab "Suggested Prompts" + Tab "Pengumuman" |

---

## Task 1: Schema Migration

**Files:**
- Modify: `backend/prisma/schema.prisma`

- [ ] **Step 1: Tambah enum dan model baru di schema.prisma**

Tambahkan di akhir file `backend/prisma/schema.prisma`:

```prisma
// ==================== SUGGESTED PROMPTS ====================

enum PromptSource {
  manual
  rag
}

model SuggestedPrompt {
  id        Int          @id @default(autoincrement())
  text      String
  category  String?
  source    PromptSource @default(manual)
  isActive  Boolean      @default(true)
  order     Int          @default(0)
  createdAt DateTime     @default(now())
  updatedAt DateTime     @updatedAt

  @@index([isActive, order])
  @@map("suggested_prompts")
}

// ==================== NOTIFICATIONS ====================

model Announcement {
  id            Int            @id @default(autoincrement())
  title         String         @db.VarChar(200)
  message       String         @db.Text
  createdAt     DateTime       @default(now())
  notifications Notification[]

  @@map("announcements")
}

model Notification {
  id             Int          @id @default(autoincrement())
  userId         Int
  announcementId Int
  isRead         Boolean      @default(false)
  createdAt      DateTime     @default(now())
  user           User         @relation(fields: [userId], references: [id], onDelete: Cascade)
  announcement   Announcement @relation(fields: [announcementId], references: [id], onDelete: Cascade)

  @@unique([userId, announcementId])
  @@index([userId, isRead, createdAt])
  @@map("notifications")
}
```

Tambahkan back-relation di model `User` yang sudah ada (setelah `bugReports BugReport[]`):
```prisma
  notifications Notification[]
```

- [ ] **Step 2: Jalankan migration**

```bash
cd backend && npx prisma db push
```

Expected output: `Your database is now in sync with your Prisma schema.`

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

- [ ] **Step 4: Commit**

```bash
git add backend/prisma/schema.prisma
git commit -m "feat(db): add SuggestedPrompt, Announcement, Notification models"
```

---

## Task 2: Dark/Light Mode — Context & Tailwind

**Files:**
- Create: `frontend/src/context/ThemeContext.js`
- Modify: `frontend/tailwind.config.js`
- Modify: `frontend/src/App.js`

- [ ] **Step 1: Aktifkan darkMode di tailwind.config.js**

```js
// frontend/tailwind.config.js
module.exports = {
  darkMode: 'class',
  content: ["./src/**/*.{js,jsx,ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter','system-ui','-apple-system','BlinkMacSystemFont','Segoe UI','Roboto','sans-serif'],
      },
    },
  },
  plugins: [],
}
```

- [ ] **Step 2: Buat ThemeContext.js**

```js
// frontend/src/context/ThemeContext.js
import { createContext, useContext, useState, useEffect } from 'react';

const ThemeContext = createContext(null);

export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('sapa_theme');
    if (saved) return saved;
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  });

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark');
    localStorage.setItem('sapa_theme', theme);
  }, [theme]);

  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark');

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};

export default ThemeContext;
```

- [ ] **Step 3: Tambah inline script di public/index.html untuk mencegah flash**

Tambahkan di `frontend/public/index.html`, di dalam `<head>` sebelum semua `<link>` dan `<script>`:
```html
<script>
  // Apply theme class BEFORE React loads to prevent flash of wrong theme
  (function() {
    var saved = localStorage.getItem('sapa_theme');
    var prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    var theme = saved || (prefersDark ? 'dark' : 'light');
    if (theme === 'dark') document.documentElement.classList.add('dark');
  })();
</script>
```

- [ ] **Step 4: Wrap App.js dengan ThemeProvider**

Di `frontend/src/App.js`, import dan wrap root:
```jsx
import { ThemeProvider } from './context/ThemeContext';

// Wrap paling luar, sebelum AuthProvider:
<ThemeProvider>
  <AuthProvider>
    ...
  </AuthProvider>
</ThemeProvider>
```

- [ ] **Step 5: Verifikasi manual**

Buka browser, buka DevTools Console, jalankan:
```js
localStorage.setItem('sapa_theme', 'light')
location.reload()
```
Expected: `<html>` TIDAK memiliki class `dark` — tanpa flash.

Kemudian:
```js
localStorage.setItem('sapa_theme', 'dark')
location.reload()
```
Expected: `<html>` memiliki class `dark` sejak render pertama (tidak ada flash putih).

- [ ] **Step 6: Commit**

```bash
git add frontend/tailwind.config.js frontend/src/context/ThemeContext.js \
        frontend/src/App.js frontend/public/index.html
git commit -m "feat(frontend): add ThemeContext with dark/light mode, flash-free init"
```

---

## Task 3: Dark/Light Mode — Tombol Toggle di Sidebar

**Files:**
- Modify: `frontend/src/components/layout/SideBar.jsx`

- [ ] **Step 1: Import useTheme dan ikon di SideBar.jsx**

Tambahkan di bagian import atas `SideBar.jsx`:
```jsx
import { Sun, Moon } from 'lucide-react';
import { useTheme } from '../../context/ThemeContext';
```

- [ ] **Step 2: Ambil theme di dalam komponen**

Di dalam fungsi komponen `SideBar`, tambahkan:
```jsx
const { theme, toggleTheme } = useTheme();
```

- [ ] **Step 3: Tambahkan tombol toggle**

Cari area bawah sidebar (sebelum atau sesudah ProfilePopover / logout button), tambahkan tombol:
```jsx
<button
  onClick={toggleTheme}
  title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
  className="flex items-center gap-2 w-full px-3 py-2 rounded-lg text-sm
    text-white/60 hover:text-white hover:bg-white/10
    dark:text-white/60 dark:hover:text-white
    transition-colors"
>
  {theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
  <span>{theme === 'dark' ? 'Light Mode' : 'Dark Mode'}</span>
</button>
```

- [ ] **Step 4: Tambahkan dark: variants pada elemen sidebar utama**

Untuk sidebar wrapper, ubah className agar mendukung light mode:
```jsx
// Contoh wrapper sidebar (default = light, dark: = dark mode override):
className="... bg-white dark:bg-gray-900 border-r border-gray-200 dark:border-white/10"
```

Lakukan hal yang sama untuk elemen penting lain di SideBar (chat history items, header, dll) — tambahkan pasangan `dark:` dan default light class.

- [ ] **Step 5: Verifikasi manual**

Klik tombol toggle di sidebar. Expected:
- Dark → Light: background sidebar berubah putih, teks jadi gelap
- Light → Dark: kembali ke tema gelap

- [ ] **Step 6: Apply dark: variants ke halaman utama**

Untuk setiap page dan komponen yang disentuh user (ChatPage, LandingPage, AdminDashboard, dll), tambahkan `dark:` prefix pada elemen background, teks, dan border. Contoh pattern:
```jsx
// Background
className="bg-white dark:bg-gray-900"
// Teks
className="text-gray-900 dark:text-white"
// Border
className="border-gray-200 dark:border-white/10"
// Card/panel
className="bg-gray-50 dark:bg-gray-800"
```

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/layout/SideBar.jsx frontend/src/pages/
git commit -m "feat(frontend): implement dark/light mode toggle with Tailwind class strategy"
```

---

## Task 4: Suggested Prompts — Backend

**Files:**
- Create: `backend/src/controllers/suggestedPromptController.js`
- Create: `backend/tests/unit/suggestedPrompt.test.js`
- Modify: `backend/src/routes/aiRoutes.js`
- Modify: `backend/src/routes/adminRoutes.js`

- [ ] **Step 1: Tulis failing tests**

```js
// backend/tests/unit/suggestedPrompt.test.js
const prisma = require('../../src/config/prismaClient');

// Mock prisma
jest.mock('../../src/config/prismaClient', () => ({
  suggestedPrompt: {
    findMany: jest.fn(),
    create: jest.fn(),
    update: jest.fn(),
    delete: jest.fn(),
  }
}));

// Mock redisService — wajib agar test tidak perlu koneksi Redis
jest.mock('../../src/services/redisService', () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue(true),
  del: jest.fn().mockResolvedValue(true),
}));

const { getPublicPrompts, createPrompt, updatePrompt, deletePrompt, togglePrompt } =
  require('../../src/controllers/suggestedPromptController');

const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('suggestedPromptController', () => {
  afterEach(() => jest.clearAllMocks());

  test('getPublicPrompts returns max 3 manual + 3 rag prompts', async () => {
    const fakePrompts = [
      { id: 1, text: 'Apa syarat KRS?', source: 'manual', isActive: true, order: 0 },
      { id: 2, text: 'Bagaimana cara bayar SPP?', source: 'manual', isActive: true, order: 1 },
    ];
    prisma.suggestedPrompt.findMany.mockResolvedValue(fakePrompts);
    const req = {};
    const res = mockRes();
    await getPublicPrompts(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  test('createPrompt validates required text field', async () => {
    const req = { body: {} };
    const res = mockRes();
    await createPrompt(req, res);
    expect(res.status).toHaveBeenCalledWith(400);
  });

  test('createPrompt creates a prompt with valid data', async () => {
    const fake = { id: 1, text: 'Test prompt', source: 'manual', isActive: true, order: 0 };
    prisma.suggestedPrompt.create.mockResolvedValue(fake);
    const req = { body: { text: 'Test prompt' } };
    const res = mockRes();
    await createPrompt(req, res);
    expect(res.status).toHaveBeenCalledWith(201);
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd backend && npm test -- tests/unit/suggestedPrompt.test.js
```

Expected: FAIL — "Cannot find module ... suggestedPromptController"

- [ ] **Step 3: Tambah `getSampleDocuments` ke ragService.js**

Di `backend/src/services/ragService.js`, tambahkan fungsi baru menggunakan `listDocuments()` yang sudah ada:

```js
// Tambahkan di bawah fungsi listDocuments yang sudah ada
const getSampleDocuments = async (limit = 6) => {
  try {
    const docs = await listDocuments(limit);
    // listDocuments returns array of { id, payload: { text, title, ... } }
    return (docs || []).slice(0, limit).map(doc => ({
      text: doc.payload?.title || doc.payload?.text?.substring(0, 80),
      suggestedQuestion: doc.payload?.title ? `Apa itu ${doc.payload.title}?` : null,
    })).filter(d => d.text);
  } catch {
    return [];
  }
};

module.exports = { ...(module.exports), getSampleDocuments };
// Atau tambahkan ke exports yang sudah ada di bawah file
```

**Catatan:** Periksa terlebih dahulu bagian `module.exports` di akhir `ragService.js` dan tambahkan `getSampleDocuments` di sana, jangan timpa exports yang ada.

- [ ] **Step 4: Implementasi controller**

```js
// backend/src/controllers/suggestedPromptController.js
const prisma = require('../config/prismaClient');
const redisService = require('../services/redisService');
const logger = require('../utils/logger');

const CACHE_KEY_PUBLIC = 'suggested_prompts:public';
const CACHE_KEY_RAG = 'suggested_prompts:rag';
const CACHE_TTL_PUBLIC = 300;  // 5 menit
const CACHE_TTL_RAG = 3600;    // 1 jam

// GET /api/ai/suggested-prompts — public
const getPublicPrompts = async (req, res) => {
  try {
    // Cek cache
    const cached = await redisService.get(CACHE_KEY_PUBLIC).catch(() => null);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), fromCache: true });

    // Ambil 3 manual aktif
    const manual = await prisma.suggestedPrompt.findMany({
      where: { isActive: true, source: 'manual' },
      orderBy: { order: 'asc' },
      take: 3,
    });

    // Ambil 3 RAG dari cache (jangan generate di sini — pakai endpoint terpisah)
    let ragPrompts = [];
    const ragCached = await redisService.get(CACHE_KEY_RAG).catch(() => null);
    if (ragCached) ragPrompts = JSON.parse(ragCached).slice(0, 3);

    const data = [...manual, ...ragPrompts].slice(0, 6);

    // Cache hasil gabungan 5 menit
    await redisService.set(CACHE_KEY_PUBLIC, JSON.stringify(data), CACHE_TTL_PUBLIC).catch(() => {});

    res.json({ success: true, data });
  } catch (error) {
    logger.error('getPublicPrompts error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil suggested prompts' });
  }
};

// GET /api/ai/suggested-prompts/rag — generate dari Qdrant, cache 1 jam
const getRagPrompts = async (req, res) => {
  try {
    const cached = await redisService.get(CACHE_KEY_RAG).catch(() => null);
    if (cached) return res.json({ success: true, data: JSON.parse(cached), fromCache: true });

    // Generate dari Qdrant — ambil sample topics dari knowledge base
    let ragPrompts = [];
    try {
      const ragService = require('../services/ragService');
      // Ambil dokumen sample dari Qdrant untuk generate pertanyaan
      const sampleDocs = await ragService.getSampleDocuments(6);
      ragPrompts = sampleDocs.map((doc, i) => ({
        id: `rag_${i}`,
        text: doc.suggestedQuestion || doc.text?.substring(0, 80) + '?',
        source: 'rag',
        isActive: true,
        order: i,
      })).filter(p => p.text && p.text.length > 10);
    } catch (ragError) {
      logger.warn('RAG prompt generation failed, returning empty:', ragError.message);
      // Fallback graceful — return empty array, jangan propagate error
    }

    await redisService.set(CACHE_KEY_RAG, JSON.stringify(ragPrompts), CACHE_TTL_RAG).catch(() => {});
    res.json({ success: true, data: ragPrompts });
  } catch (error) {
    logger.error('getRagPrompts error:', error.message);
    res.json({ success: true, data: [] }); // Graceful fallback
  }
};

// GET /api/admin/suggested-prompts — admin list semua
const getAllPrompts = async (req, res) => {
  try {
    const prompts = await prisma.suggestedPrompt.findMany({
      orderBy: [{ order: 'asc' }, { createdAt: 'desc' }],
    });
    res.json({ success: true, data: prompts });
  } catch (error) {
    logger.error('getAllPrompts error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil data' });
  }
};

// POST /api/admin/suggested-prompts
const createPrompt = async (req, res) => {
  const { text, category, order } = req.body;
  if (!text || text.trim().length === 0) {
    return res.status(400).json({ success: false, message: 'Field text wajib diisi' });
  }
  try {
    const prompt = await prisma.suggestedPrompt.create({
      data: { text: text.trim(), category: category?.trim() || null, order: order ?? 0 },
    });
    // Invalidate cache
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.status(201).json({ success: true, data: prompt });
  } catch (error) {
    logger.error('createPrompt error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal membuat prompt' });
  }
};

// PATCH /api/admin/suggested-prompts/:id — edit text/category/order
const updatePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  const { text, category, order } = req.body;
  if (!text && category === undefined && order === undefined) {
    return res.status(400).json({ success: false, message: 'Tidak ada field yang diupdate' });
  }
  try {
    const data = {};
    if (text) data.text = text.trim();
    if (category !== undefined) data.category = category?.trim() || null;
    if (order !== undefined) data.order = order;
    const prompt = await prisma.suggestedPrompt.update({ where: { id }, data });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, data: prompt });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    res.status(500).json({ success: false, message: 'Gagal update prompt' });
  }
};

// PATCH /api/admin/suggested-prompts/:id/toggle
const togglePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    const existing = await prisma.suggestedPrompt.findUnique({ where: { id } });
    if (!existing) return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    const prompt = await prisma.suggestedPrompt.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, data: prompt });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal toggle prompt' });
  }
};

// DELETE /api/admin/suggested-prompts/:id
const deletePrompt = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    await prisma.suggestedPrompt.delete({ where: { id } });
    await redisService.del(CACHE_KEY_PUBLIC).catch(() => {});
    res.json({ success: true, message: 'Prompt dihapus' });
  } catch (error) {
    if (error.code === 'P2025') return res.status(404).json({ success: false, message: 'Prompt tidak ditemukan' });
    res.status(500).json({ success: false, message: 'Gagal hapus prompt' });
  }
};

module.exports = { getPublicPrompts, getRagPrompts, getAllPrompts, createPrompt, updatePrompt, togglePrompt, deletePrompt };
```

- [ ] **Step 4: Mount di routes**

Di `backend/src/routes/aiRoutes.js`, tambahkan (SEBELUM route `/:id` manapun):
```js
const { getPublicPrompts, getRagPrompts } = require('../controllers/suggestedPromptController');
// ...
router.get('/suggested-prompts/rag', getRagPrompts);   // /rag HARUS sebelum /:id
router.get('/suggested-prompts', getPublicPrompts);
```

Di `backend/src/routes/adminRoutes.js`, tambahkan di dalam router yang sudah ada:
```js
const { getAllPrompts, createPrompt, updatePrompt, togglePrompt, deletePrompt } =
  require('../controllers/suggestedPromptController');
// ...
router.get('/suggested-prompts', getAllPrompts);
router.post('/suggested-prompts', createPrompt);
router.patch('/suggested-prompts/:id/toggle', togglePrompt);  // /toggle SEBELUM /:id
router.patch('/suggested-prompts/:id', updatePrompt);
router.delete('/suggested-prompts/:id', deletePrompt);
```

- [ ] **Step 5: Jalankan test — pastikan PASS**

```bash
cd backend && npm test -- tests/unit/suggestedPrompt.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 6: Commit**

```bash
git add backend/src/controllers/suggestedPromptController.js \
        backend/src/routes/aiRoutes.js \
        backend/src/routes/adminRoutes.js \
        backend/tests/unit/suggestedPrompt.test.js
git commit -m "feat(backend): add suggested prompts endpoints with Redis cache"
```

---

## Task 5: Suggested Prompts — Frontend (LandingPage + Sidebar Search)

**Files:**
- Create: `frontend/src/components/chat/SuggestedPromptCards.jsx`
- Modify: `frontend/src/pages/LandingPage.jsx`
- Modify: `frontend/src/pages/ChatPage.jsx`
- Modify: `frontend/src/components/layout/SideBar.jsx`

- [ ] **Step 1: Buat SuggestedPromptCards.jsx**

```jsx
// frontend/src/components/chat/SuggestedPromptCards.jsx
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';

const SuggestedPromptCards = () => {
  const [prompts, setPrompts] = useState([]);
  const navigate = useNavigate();
  const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

  useEffect(() => {
    axios.get(`${API}/api/ai/suggested-prompts`)
      .then(res => setPrompts(res.data.data || []))
      .catch(() => {}); // Gagal silently — section cukup tidak tampil
  }, [API]);

  if (prompts.length === 0) return null;

  const handleClick = (text) => {
    navigate('/chat', { state: { prompt: text } });
  };

  return (
    <div className="w-full max-w-3xl mx-auto px-4 mt-8">
      <p className="text-sm text-gray-400 dark:text-gray-500 mb-3 text-center font-medium">
        Coba tanyakan...
      </p>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {prompts.map((p) => (
          <button
            key={p.id}
            onClick={() => handleClick(p.text)}
            className="text-left px-4 py-3 rounded-xl border text-sm
              bg-gray-50 border-gray-200 text-gray-700 hover:bg-gray-100
              dark:bg-white/5 dark:border-white/10 dark:text-white/80 dark:hover:bg-white/10 dark:hover:border-white/20
              transition-all duration-200"
          >
            {p.text}
          </button>
        ))}
      </div>
    </div>
  );
};

export default SuggestedPromptCards;
```

- [ ] **Step 2: Tambahkan SuggestedPromptCards ke LandingPage**

Di `frontend/src/pages/LandingPage.jsx`, import dan tambahkan di section yang relevan (setelah hero/CTA):
```jsx
import SuggestedPromptCards from '../components/chat/SuggestedPromptCards';

// Di dalam JSX, setelah tombol CTA utama:
<SuggestedPromptCards />
```

- [ ] **Step 3: Tambahkan auto-send di ChatPage**

Di `frontend/src/pages/ChatPage.jsx`, cari `useEffect` awal (atau tambahkan baru) untuk baca dan clear `location.state.prompt`:

```jsx
import { useLocation } from 'react-router-dom';
// ...
const location = useLocation();

// Tambahkan useEffect ini SETELAH semua state sudah terdefinisi:
useEffect(() => {
  if (location.state?.prompt) {
    const promptText = location.state.prompt;
    // Clear state agar tidak auto-send lagi saat navigasi balik
    navigate(location.pathname, { replace: true, state: {} });
    // Delay kecil agar component sudah fully mounted
    setTimeout(() => {
      handleSendMessage(promptText);
    }, 300);
  }
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []); // Run once on mount only
```

- [ ] **Step 4: Tambahkan search di SideBar.jsx**

Tambahkan state dan search input di `SideBar.jsx`:
```jsx
import { Search } from 'lucide-react';
// ...
const [searchQuery, setSearchQuery] = useState('');
const [searchResults, setSearchResults] = useState(null);
const [isSearching, setIsSearching] = useState(false);

// Debounce search
useEffect(() => {
  if (searchQuery.trim().length < 2) {
    setSearchResults(null);
    return;
  }
  const timer = setTimeout(async () => {
    setIsSearching(true);
    try {
      const res = await api.get(`/ai/conversations/search?q=${encodeURIComponent(searchQuery)}`);
      setSearchResults(res.data.conversations || []);
    } catch {
      setSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, 400);
  return () => clearTimeout(timer);
}, [searchQuery]);

// Di JSX, tambahkan di atas list conversation:
<div className="relative px-3 pb-2">
  <Search size={14} className="absolute left-5 top-1/2 -translate-y-1/2 text-white/40" />
  <input
    type="text"
    placeholder="Cari percakapan..."
    value={searchQuery}
    onChange={e => setSearchQuery(e.target.value)}
    className="w-full pl-7 pr-3 py-1.5 rounded-lg text-xs bg-white/10 text-white
      placeholder-white/30 border border-white/10 focus:outline-none focus:border-white/30"
  />
</div>

{/* Render searchResults jika ada, atau chatHistory jika tidak */}
```

- [ ] **Step 5: Tambahkan `searchConversations` ke aiController.js**

Sesuai layer pattern project (controllers = handler, routes = mount saja), tambahkan di `backend/src/controllers/aiController.js`:
```js
const searchConversations = async (req, res) => {
  const { q } = req.query;
  if (!q || q.trim().length < 2) {
    return res.status(400).json({ success: false, message: 'Query minimal 2 karakter' });
  }
  try {
    const conversations = await prisma.conversation.findMany({
      where: {
        userId: req.user.id,
        OR: [
          { title: { contains: q.trim() } },
          { messages: { some: { content: { contains: q.trim() } } } },
        ],
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, title: true, createdAt: true, _count: { select: { messages: true } } },
    });
    res.json({ success: true, conversations });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mencari percakapan' });
  }
};
// Tambahkan searchConversations ke module.exports yang sudah ada
```

Di `backend/src/routes/aiRoutes.js`, import dan mount **sebelum** route parameterized manapun:
```js
const { ..., searchConversations } = require('../controllers/aiController');
// ...
router.get('/conversations/search', requireAuth, searchConversations); // Sebelum /conversations/:id jika ada
```

- [ ] **Step 6: Verifikasi manual**

1. Buka LandingPage — kartu suggested prompts harus tampil
2. Klik salah satu kartu → harus redirect ke `/chat` dan pesan terkirim otomatis
3. Buka sidebar search, ketik minimal 2 karakter → hasil conversation muncul

- [ ] **Step 7: Commit**

```bash
git add frontend/src/components/chat/SuggestedPromptCards.jsx \
        frontend/src/pages/LandingPage.jsx \
        frontend/src/pages/ChatPage.jsx \
        frontend/src/components/layout/SideBar.jsx \
        backend/src/routes/aiRoutes.js
git commit -m "feat: add suggested prompt cards to landing page, auto-send in chat, sidebar search"
```

---

## Task 6: Suggested Prompts — Admin CRUD Tab

**Files:**
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Tambahkan tab "Suggested Prompts" di AdminDashboard**

Cari bagian tab navigation di `AdminDashboard.jsx` dan tambahkan tab baru:
```jsx
// Tambahkan ke array/list tab yang ada:
{ id: 'prompts', label: 'Suggested Prompts' }
```

- [ ] **Step 2: Buat panel konten tab Suggested Prompts**

Tambahkan state dan fetch:
```jsx
const [prompts, setPrompts] = useState([]);
const [newPromptText, setNewPromptText] = useState('');
const [newPromptCategory, setNewPromptCategory] = useState('');

const fetchPrompts = async () => {
  try {
    const res = await axios.get(`${API}/admin/suggested-prompts`, { headers: authHeader });
    setPrompts(res.data.data || []);
  } catch (err) { console.error(err); }
};

const handleAddPrompt = async () => {
  if (!newPromptText.trim()) return;
  await axios.post(`${API}/admin/suggested-prompts`,
    { text: newPromptText, category: newPromptCategory || undefined },
    { headers: authHeader }
  );
  setNewPromptText(''); setNewPromptCategory('');
  fetchPrompts();
};

const handleToggle = async (id) => {
  await axios.patch(`${API}/admin/suggested-prompts/${id}/toggle`, {}, { headers: authHeader });
  fetchPrompts();
};

const handleDelete = async (id) => {
  if (!window.confirm('Hapus prompt ini?')) return;
  await axios.delete(`${API}/admin/suggested-prompts/${id}`, { headers: authHeader });
  fetchPrompts();
};
```

Panel JSX (taruh di dalam kondisi `activeTab === 'prompts'`):
```jsx
<div>
  <h3 className="text-lg font-semibold mb-4">Suggested Prompts</h3>

  {/* Form tambah */}
  <div className="flex gap-2 mb-6">
    <input value={newPromptText} onChange={e => setNewPromptText(e.target.value)}
      placeholder="Teks pertanyaan..." className="flex-1 px-3 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/20" />
    <input value={newPromptCategory} onChange={e => setNewPromptCategory(e.target.value)}
      placeholder="Kategori (opsional)" className="w-36 px-3 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/20" />
    <button onClick={handleAddPrompt} className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg">Tambah</button>
  </div>

  {/* Tabel */}
  <table className="w-full text-sm">
    <thead><tr className="text-left text-white/50 border-b border-white/10">
      <th className="pb-2">Teks</th><th className="pb-2">Kategori</th>
      <th className="pb-2">Source</th><th className="pb-2">Aktif</th><th className="pb-2">Aksi</th>
    </tr></thead>
    <tbody>
      {prompts.map(p => (
        <tr key={p.id} className="border-b border-white/5">
          <td className="py-2 pr-4 text-white/80">{p.text}</td>
          <td className="py-2 pr-4 text-white/50">{p.category || '—'}</td>
          <td className="py-2 pr-4">
            <span className={`px-2 py-0.5 rounded text-xs ${p.source === 'rag' ? 'bg-blue-500/20 text-blue-300' : 'bg-green-500/20 text-green-300'}`}>
              {p.source}
            </span>
          </td>
          <td className="py-2 pr-4">
            <button onClick={() => handleToggle(p.id)}
              className={`w-10 h-5 rounded-full transition-colors ${p.isActive ? 'bg-orange-500' : 'bg-white/20'}`} />
          </td>
          <td className="py-2">
            <button onClick={() => handleDelete(p.id)} className="text-red-400 hover:text-red-300 text-xs">Hapus</button>
          </td>
        </tr>
      ))}
    </tbody>
  </table>
</div>
```

- [ ] **Step 3: Verifikasi manual**

1. Login ke `/admin/dashboard`
2. Klik tab "Suggested Prompts"
3. Tambah prompt baru → muncul di tabel
4. Toggle aktif/nonaktif → perubahan langsung
5. Hapus prompt → hilang dari tabel
6. Buka LandingPage → prompt baru muncul (setelah cache 5 menit expire atau restart)

- [ ] **Step 4: Commit**

```bash
git add frontend/src/pages/AdminDashboard.jsx
git commit -m "feat(admin): add suggested prompts CRUD tab in dashboard"
```

---

## Task 7: Notification System — Backend

**Files:**
- Create: `backend/src/controllers/notificationController.js`
- Create: `backend/src/routes/notificationRoutes.js`
- Create: `backend/tests/unit/notification.test.js`
- Modify: `backend/src/routes/adminRoutes.js`
- Modify: `backend/src/app.js`

- [ ] **Step 1: Tulis failing tests**

```js
// backend/tests/unit/notification.test.js
const prisma = require('../../src/config/prismaClient');

jest.mock('../../src/config/prismaClient', () => ({
  notification: {
    findMany: jest.fn(),
    updateMany: jest.fn(),
    update: jest.fn(),
    findFirst: jest.fn(),
  },
  user: { findMany: jest.fn() },
  announcement: { create: jest.fn(), findMany: jest.fn() },
  $transaction: jest.fn(),
}));

const { getNotifications, markRead, markAllRead } =
  require('../../src/controllers/notificationController');

const mockReq = (overrides = {}) => ({ user: { id: 1 }, params: {}, body: {}, ...overrides });
const mockRes = () => {
  const res = {};
  res.status = jest.fn().mockReturnValue(res);
  res.json = jest.fn().mockReturnValue(res);
  return res;
};

describe('notificationController', () => {
  afterEach(() => jest.clearAllMocks());

  test('getNotifications returns user notifications', async () => {
    prisma.notification.findMany.mockResolvedValue([
      { id: 1, isRead: false, announcement: { title: 'Test', message: 'Isi' }, createdAt: new Date() }
    ]);
    const req = mockReq();
    const res = mockRes();
    await getNotifications(req, res);
    expect(res.json).toHaveBeenCalledWith(
      expect.objectContaining({ success: true, data: expect.any(Array) })
    );
  });

  test('markRead checks ownership before updating', async () => {
    prisma.notification.findFirst.mockResolvedValue(null); // Tidak ditemukan = bukan milik user
    const req = mockReq({ params: { id: '99' } });
    const res = mockRes();
    await markRead(req, res);
    expect(res.status).toHaveBeenCalledWith(404);
  });

  test('markAllRead only updates notifications milik user tersebut', async () => {
    prisma.notification.updateMany.mockResolvedValue({ count: 3 });
    const req = mockReq();
    const res = mockRes();
    await markAllRead(req, res);
    expect(prisma.notification.updateMany).toHaveBeenCalledWith({
      where: { userId: 1, isRead: false },
      data: { isRead: true },
    });
  });
});
```

- [ ] **Step 2: Jalankan test — pastikan FAIL**

```bash
cd backend && npm test -- tests/unit/notification.test.js
```

Expected: FAIL — "Cannot find module ... notificationController"

- [ ] **Step 3: Implementasi notificationController.js**

```js
// backend/src/controllers/notificationController.js
const prisma = require('../config/prismaClient');
const logger = require('../utils/logger');

// GET /api/notifications — user punya sendiri, unread first, max 20
const getNotifications = async (req, res) => {
  try {
    const notifications = await prisma.notification.findMany({
      where: { userId: req.user.id },
      orderBy: [{ isRead: 'asc' }, { createdAt: 'desc' }],
      take: 20,
      include: {
        announcement: { select: { id: true, title: true, message: true, createdAt: true } },
      },
    });
    const unreadCount = notifications.filter(n => !n.isRead).length;
    res.json({ success: true, data: notifications, unreadCount });
  } catch (error) {
    logger.error('getNotifications error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal mengambil notifikasi' });
  }
};

// PATCH /api/notifications/read-all — harus mount SEBELUM /:id/read di router
const markAllRead = async (req, res) => {
  try {
    const result = await prisma.notification.updateMany({
      where: { userId: req.user.id, isRead: false },
      data: { isRead: true },
    });
    res.json({ success: true, updated: result.count });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
  }
};

// PATCH /api/notifications/:id/read
const markRead = async (req, res) => {
  const id = parseInt(req.params.id);
  try {
    // IDOR guard — pastikan notifikasi milik user ini
    const notif = await prisma.notification.findFirst({
      where: { id, userId: req.user.id },
    });
    if (!notif) return res.status(404).json({ success: false, message: 'Notifikasi tidak ditemukan' });

    const updated = await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });
    res.json({ success: true, data: updated });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal update notifikasi' });
  }
};

// POST /api/admin/announcements — fan-out ke semua user aktif
const createAnnouncement = async (req, res) => {
  const { title, message } = req.body;
  if (!title || title.trim().length === 0)
    return res.status(400).json({ success: false, message: 'Title wajib diisi' });
  if (title.length > 200)
    return res.status(400).json({ success: false, message: 'Title maksimal 200 karakter' });
  if (!message || message.trim().length === 0)
    return res.status(400).json({ success: false, message: 'Message wajib diisi' });
  if (message.length > 2000)
    return res.status(400).json({ success: false, message: 'Message maksimal 2000 karakter' });

  try {
    // Buat announcement
    const announcement = await prisma.announcement.create({
      data: { title: title.trim(), message: message.trim() },
    });

    // Fan-out ke semua user aktif
    const activeUsers = await prisma.user.findMany({
      where: { status: 'active' },
      select: { id: true },
    });

    if (activeUsers.length > 0) {
      await prisma.notification.createMany({
        data: activeUsers.map(u => ({
          userId: u.id,
          announcementId: announcement.id,
        })),
        skipDuplicates: true,
      });
    }

    res.status(201).json({
      success: true,
      data: announcement,
      recipientCount: activeUsers.length,
    });
  } catch (error) {
    logger.error('createAnnouncement error:', error.message);
    res.status(500).json({ success: false, message: 'Gagal membuat pengumuman' });
  }
};

// GET /api/admin/announcements
const getAnnouncements = async (req, res) => {
  try {
    const announcements = await prisma.announcement.findMany({
      orderBy: { createdAt: 'desc' },
      include: { _count: { select: { notifications: true } } },
    });
    res.json({ success: true, data: announcements });
  } catch (error) {
    res.status(500).json({ success: false, message: 'Gagal mengambil pengumuman' });
  }
};

module.exports = { getNotifications, markAllRead, markRead, createAnnouncement, getAnnouncements };
```

- [ ] **Step 4: Buat notificationRoutes.js**

```js
// backend/src/routes/notificationRoutes.js
const express = require('express');
const router = express.Router();
const { requireAuth } = require('../middleware/authMiddleware');
const { getNotifications, markAllRead, markRead } = require('../controllers/notificationController');

router.use(requireAuth);

router.get('/', getNotifications);
router.patch('/read-all', markAllRead);   // HARUS sebelum /:id/read
router.patch('/:id/read', markRead);

module.exports = router;
```

- [ ] **Step 5: Mount di adminRoutes.js dan app.js**

Di `backend/src/routes/adminRoutes.js`, tambahkan di dalam router (setelah import):
```js
const { createAnnouncement, getAnnouncements } = require('../controllers/notificationController');
// ...
router.post('/announcements', createAnnouncement);
router.get('/announcements', getAnnouncements);
```

Di `backend/src/app.js`, tambahkan import dan mount:
```js
const notificationRoutes = require('./routes/notificationRoutes');
// ...
app.use('/api/notifications', notificationRoutes);
```

- [ ] **Step 6: Jalankan test — pastikan PASS**

```bash
cd backend && npm test -- tests/unit/notification.test.js
```

Expected: PASS (3 tests)

- [ ] **Step 7: Commit**

```bash
git add backend/src/controllers/notificationController.js \
        backend/src/routes/notificationRoutes.js \
        backend/src/routes/adminRoutes.js \
        backend/src/app.js \
        backend/tests/unit/notification.test.js
git commit -m "feat(backend): add notification system with announcement fan-out"
```

---

## Task 8: Notification System — Frontend

**Files:**
- Create: `frontend/src/context/NotificationContext.js`
- Create: `frontend/src/components/common/NotificationDropdown.jsx`
- Modify: `frontend/src/App.js`
- Modify: `frontend/src/components/layout/SideBar.jsx`
- Modify: `frontend/src/pages/AdminDashboard.jsx`

- [ ] **Step 1: Buat NotificationContext.js**

```js
// frontend/src/context/NotificationContext.js
import { createContext, useContext, useState, useEffect, useRef, useCallback } from 'react';
import api from '../api/axiosConfig';
import { useAuth } from './AuthContext';

const NotificationContext = createContext(null);

export const NotificationProvider = ({ children }) => {
  const { isAuthenticated } = useAuth();
  // Gunakan isAuthenticated saja — jangan pakai user.nim sebagai guard
  // karena Google OAuth user yang belum isi profil punya nim = null
  // Tapi mereka tetap user terautentikasi yang harus dapat notifikasi
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const intervalRef = useRef(null);

  const fetchNotifications = useCallback(async () => {
    try {
      const res = await api.get('/notifications');
      setNotifications(res.data.data || []);
      setUnreadCount(res.data.unreadCount || 0);
    } catch {
      // Diam saja kalau gagal (token expired ditangani AuthContext)
    }
  }, []);

  const markRead = async (id) => {
    try {
      await api.patch(`/notifications/${id}/read`);
      setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
      setUnreadCount(prev => Math.max(0, prev - 1));
    } catch {}
  };

  const markAllRead = async () => {
    try {
      await api.patch('/notifications/read-all');
      setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch {}
  };

  const stopPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
  };

  useEffect(() => {
    if (!isAuthenticated) return;

    fetchNotifications();
    intervalRef.current = setInterval(fetchNotifications, 30000);

    // Stop polling saat token expired
    const handler = () => stopPolling();
    window.addEventListener('authTokenExpired', handler);

    return () => {
      stopPolling();
      window.removeEventListener('authTokenExpired', handler);
    };
  }, [isAuthenticated, fetchNotifications]);

  return (
    <NotificationContext.Provider value={{ notifications, unreadCount, markRead, markAllRead }}>
      {children}
    </NotificationContext.Provider>
  );
};

export const useNotifications = () => {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error('useNotifications must be used within NotificationProvider');
  return ctx;
};
```

- [ ] **Step 2: Wrap NotificationProvider di App.js**

```jsx
import { NotificationProvider } from './context/NotificationContext';

// Wrap di dalam AuthProvider (butuh auth context):
<ThemeProvider>
  <AuthProvider>
    <NotificationProvider>
      ...
    </NotificationProvider>
  </AuthProvider>
</ThemeProvider>
```

- [ ] **Step 3: Buat NotificationDropdown.jsx**

```jsx
// frontend/src/components/common/NotificationDropdown.jsx
import { useState, useRef, useEffect } from 'react';
import { Bell } from 'lucide-react';
import { useNotifications } from '../../context/NotificationContext';

const timeAgo = (date) => {
  const diff = Math.floor((Date.now() - new Date(date)) / 1000);
  if (diff < 60) return 'Baru saja';
  if (diff < 3600) return `${Math.floor(diff / 60)} mnt lalu`;
  if (diff < 86400) return `${Math.floor(diff / 3600)} jam lalu`;
  return `${Math.floor(diff / 86400)} hari lalu`;
};

const NotificationDropdown = () => {
  const { notifications, unreadCount, markRead, markAllRead } = useNotifications();
  const [isOpen, setIsOpen] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="relative p-2 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors"
        title="Notifikasi"
      >
        <Bell size={18} />
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-4 h-4 bg-red-500 rounded-full text-[10px] text-white flex items-center justify-center font-bold">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="absolute right-0 top-full mt-2 w-80 rounded-xl shadow-2xl
          bg-gray-900 border border-white/10 dark:bg-gray-900 dark:border-white/10
          z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-white/10">
            <span className="text-sm font-semibold text-white">Notifikasi</span>
            {unreadCount > 0 && (
              <button onClick={markAllRead} className="text-xs text-orange-400 hover:text-orange-300">
                Tandai semua dibaca
              </button>
            )}
          </div>

          <div className="max-h-80 overflow-y-auto">
            {notifications.length === 0 ? (
              <p className="text-center text-white/40 text-sm py-8">Belum ada notifikasi</p>
            ) : (
              notifications.map(n => (
                <div
                  key={n.id}
                  onClick={() => markRead(n.id)}
                  className={`px-4 py-3 cursor-pointer border-b border-white/5 transition-colors
                    ${n.isRead ? 'opacity-60' : 'hover:bg-white/5'}`}
                >
                  <div className="flex items-start gap-2">
                    {!n.isRead && <span className="w-2 h-2 bg-blue-400 rounded-full flex-shrink-0 mt-1.5" />}
                    <div className={!n.isRead ? '' : 'pl-4'}>
                      <p className="text-sm text-white font-medium">{n.announcement?.title}</p>
                      <p className="text-xs text-white/50 mt-0.5 line-clamp-2">
                        {n.announcement?.message?.substring(0, 80)}{n.announcement?.message?.length > 80 ? '...' : ''}
                      </p>
                      <p className="text-[10px] text-white/30 mt-1">{timeAgo(n.createdAt)}</p>
                    </div>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default NotificationDropdown;
```

- [ ] **Step 4: Tambahkan bell icon di SideBar.jsx**

Di bagian atas sidebar (header/nav area), tambahkan:
```jsx
import NotificationDropdown from '../common/NotificationDropdown';
import { useAuth } from '../../context/AuthContext';
// ...
const { isAuthenticated } = useAuth();
// ...
// Di JSX header sidebar:
{isAuthenticated && <NotificationDropdown />}
```

- [ ] **Step 5: Tambahkan tab Pengumuman di AdminDashboard.jsx**

```jsx
// State
const [announcementTitle, setAnnouncementTitle] = useState('');
const [announcementMessage, setAnnouncementMessage] = useState('');
const [announcements, setAnnouncements] = useState([]);

const fetchAnnouncements = async () => {
  const res = await axios.get(`${API}/admin/announcements`, { headers: authHeader });
  setAnnouncements(res.data.data || []);
};

const handleSendAnnouncement = async () => {
  if (!announcementTitle.trim() || !announcementMessage.trim()) return;
  await axios.post(`${API}/admin/announcements`,
    { title: announcementTitle, message: announcementMessage },
    { headers: authHeader }
  );
  setAnnouncementTitle(''); setAnnouncementMessage('');
  fetchAnnouncements();
};

// Panel JSX (di dalam activeTab === 'announcements'):
```
```jsx
<div>
  <h3 className="text-lg font-semibold mb-4">Kirim Pengumuman</h3>
  <div className="space-y-3 mb-6 max-w-xl">
    <input value={announcementTitle} onChange={e => setAnnouncementTitle(e.target.value)}
      placeholder="Judul pengumuman..." maxLength={200}
      className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/20" />
    <textarea value={announcementMessage} onChange={e => setAnnouncementMessage(e.target.value)}
      placeholder="Isi pengumuman..." maxLength={2000} rows={4}
      className="w-full px-3 py-2 rounded-lg bg-white/10 text-white text-sm border border-white/20 resize-none" />
    <button onClick={handleSendAnnouncement}
      className="px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white text-sm rounded-lg">
      Kirim ke Semua Mahasiswa
    </button>
  </div>

  <h4 className="text-sm font-semibold text-white/60 mb-3">Riwayat Pengumuman</h4>
  <div className="space-y-2">
    {announcements.map(a => (
      <div key={a.id} className="px-4 py-3 rounded-lg bg-white/5 border border-white/10">
        <p className="text-sm font-medium text-white">{a.title}</p>
        <p className="text-xs text-white/50 mt-1">{a.message.substring(0, 100)}{a.message.length > 100 ? '...' : ''}</p>
        <p className="text-[10px] text-white/30 mt-1">
          {new Date(a.createdAt).toLocaleString('id-ID')} · {a._count?.notifications || 0} penerima
        </p>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 6: Verifikasi manual**

1. Login sebagai user aktif
2. Bell icon muncul di sidebar
3. Admin kirim pengumuman dari dashboard
4. Tunggu 30 detik atau refresh → badge merah muncul di bell
5. Klik bell → dropdown terbuka dengan notifikasi
6. Klik notifikasi → dot biru hilang
7. "Tandai semua dibaca" → semua hilang

- [ ] **Step 7: Commit**

```bash
git add frontend/src/context/NotificationContext.js \
        frontend/src/components/common/NotificationDropdown.jsx \
        frontend/src/components/layout/SideBar.jsx \
        frontend/src/pages/AdminDashboard.jsx \
        frontend/src/App.js
git commit -m "feat(frontend): add notification system with bell icon, dropdown, admin panel"
```

---

## Task 9: Push ke GitHub

- [ ] **Step 1: Pastikan semua test hijau**

```bash
cd backend && npm test
```

Expected: Semua test PASS (termasuk suggestedPrompt + notification)

- [ ] **Step 2: Push**

```bash
cd E:/sapa-tazkia && git push origin main
```

---

## Checklist Akhir

- [ ] Schema migration sukses (`prisma db push`)
- [ ] Dark/Light mode toggle berfungsi di semua halaman
- [ ] System preference (OS dark/light) terdeteksi saat pertama load
- [ ] Suggested prompts tampil di LandingPage
- [ ] Klik prompt → auto-send di ChatPage dan state di-clear
- [ ] Sidebar search berfungsi dengan debounce 400ms
- [ ] Admin CRUD suggested prompts berfungsi
- [ ] Bell icon tampil hanya untuk authenticated non-guest user
- [ ] Notifikasi dikirim ke semua user aktif saat admin buat pengumuman
- [ ] Polling 30 detik berjalan, berhenti saat token expired
- [ ] IDOR guard berfungsi (user tidak bisa tandai notif milik orang lain)
- [ ] Semua test backend PASS
