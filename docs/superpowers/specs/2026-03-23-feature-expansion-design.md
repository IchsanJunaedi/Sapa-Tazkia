# Feature Expansion Design — SAPA-TAZKIA
**Date:** 2026-03-23
**Status:** Approved
**Scope:** 3 features — Suggested Prompts, Dark/Light Mode, Notification System

---

## 1. Suggested Prompts + Sidebar Search

### Overview
Kartu-kartu contoh pertanyaan di `LandingPage.jsx`. Admin kelola dari dashboard. Sistem auto-generate prompt dari konten RAG/Qdrant. Klik prompt → masuk ChatPage dan auto-send.

### Database

**Enum baru:**
```prisma
enum PromptSource {
  manual
  rag
}
```

**Model:**
```prisma
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
```

### Backend Endpoints

**Catatan penting:** Semua endpoint admin HARUS ditambahkan di dalam file `adminRoutes.js` yang sudah ada (bukan file terpisah) agar IP whitelist middleware teraplikasi otomatis.

Route `/suggested-prompts/rag` harus didaftarkan **sebelum** `/suggested-prompts/:id` untuk mencegah konflik Express routing.

| Method | Path | Auth | Fungsi |
|--------|------|------|--------|
| GET | `/api/ai/suggested-prompts` | Public | Ambil prompt aktif (3 manual + 3 RAG), cache Redis 5 menit |
| GET | `/api/ai/suggested-prompts/rag` | Public | Generate dari Qdrant, cache Redis 1 jam. Jika Qdrant gagal/kosong → return `[]` (tidak propagate error ke parent endpoint) |
| GET | `/api/admin/suggested-prompts` | Admin | List semua prompt |
| POST | `/api/admin/suggested-prompts` | Admin | Tambah prompt manual |
| PATCH | `/api/admin/suggested-prompts/:id` | Admin | Edit text/category. Body: `{ text?, category?, order? }` |
| PATCH | `/api/admin/suggested-prompts/:id/toggle` | Admin | Toggle isActive saja |
| DELETE | `/api/admin/suggested-prompts/:id` | Admin | Hard delete (intentional — source field cukup untuk audit manual vs rag) |
| GET | `/api/ai/conversations/search?q=` | User | Cari history chat. Min panjang `q`: 2 karakter, else return 400. Prisma `contains` digunakan (parameterized, aman dari SQL injection). Limit 10 hasil. |

**Fallback utama endpoint (`GET /api/ai/suggested-prompts`):**
- Ambil RAG prompts dari cache Redis
- Jika cache miss atau Qdrant error → hanya kembalikan manual prompts (max 6)
- Jangan propagate error Qdrant sebagai 500 ke client

**Order management:**
- Default `order = 0` untuk semua prompt baru
- PATCH `/:id` menerima `order` field untuk set urutan
- Frontend admin mengirim array sorted dengan field order yang sudah diupdate

### Frontend Flow
```
LandingPage
  └── SuggestedPromptCards component
        ├── Fetch GET /api/ai/suggested-prompts (cached 5 menit)
        ├── Render max 6 kartu
        └── onClick → navigate('/chat', { state: { prompt: teks } })

ChatPage (mount)
  └── Baca location.state?.prompt
        └── Jika ada:
              1. auto call handleSendMessage(prompt)
              2. WAJIB clear state: navigate(location.pathname, { replace: true, state: {} })
              // Mencegah auto-send ulang saat user navigasi balik ke /chat
```

### Sidebar Search
- Input search di atas list conversation di `SideBar.jsx`
- Debounce 400ms
- Min 2 karakter untuk trigger fetch
- Tampilkan skeleton/loading rows selama fetch
- Call `GET /api/ai/conversations/search?q=xxx`
- Hasil replace list conversation sementara
- Jika input kosong → kembali tampil semua history

### Admin Dashboard
- Tab baru "Suggested Prompts" di `AdminDashboard.jsx`
- Tabel: text, category, source (badge manual/rag), isActive (toggle), order, actions
- Form tambah prompt manual (text + category opsional)
- Edit inline untuk text/category/order
- Toggle aktif/nonaktif langsung dari tabel

### Files Baru
- `frontend/src/components/chat/SuggestedPromptCards.jsx`
- `backend/src/controllers/suggestedPromptController.js`

### Files Dimodifikasi
- `frontend/src/pages/LandingPage.jsx` — tambah SuggestedPromptCards section
- `frontend/src/pages/ChatPage.jsx` — baca & clear location.state.prompt on mount
- `frontend/src/components/layout/SideBar.jsx` — tambah search input + skeleton loading
- `backend/src/routes/aiRoutes.js` — mount GET suggested-prompts endpoints (rag sebelum :id)
- `backend/src/routes/adminRoutes.js` — mount admin CRUD endpoints
- `backend/prisma/schema.prisma` — tambah PromptSource enum + SuggestedPrompt model

---

## 2. Dark/Light Mode Toggle

### Overview
Theme toggle dengan localStorage persistence dan system preference fallback. Tailwind class-based dark mode. Current app adalah dark-first — light mode yang didesain baru.

### State
- Key localStorage: `sapa_theme` = `'dark'` | `'light'`
- Inisialisasi **synchronous** di `useState` initializer body (bukan useEffect) untuk mencegah flash of wrong theme:
  ```javascript
  const [theme, setTheme] = useState(() => {
    const saved = localStorage.getItem('sapa_theme')
    if (saved) return saved
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  })
  ```
- Apply class `dark` ke `document.documentElement` juga dilakukan synchronously dalam initializer atau via inline script di `public/index.html` sebelum React load
- `useEffect` hanya untuk sync perubahan theme berikutnya ke DOM + localStorage

### Context
```javascript
// context/ThemeContext.js
export const ThemeContext = createContext()
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(() => { /* sync init above */ })
  const toggleTheme = () => setTheme(t => t === 'dark' ? 'light' : 'dark')

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem('sapa_theme', theme)
  }, [theme])

  return <ThemeContext.Provider value={{ theme, toggleTheme }}>{children}</ThemeContext.Provider>
}
export const useTheme = () => useContext(ThemeContext)
```

### Tailwind Config
```javascript
module.exports = { darkMode: 'class', ... }
```

### Toggle Button
- Lokasi: di dalam `SideBar.jsx`, di baris bawah sidebar — sebagai tombol sendiri di luar ProfilePopover, bersebelahan dengan area profil
- Icon: `Sun` (ketika theme = `'dark'`, klik untuk ke light) / `Moon` (ketika theme = `'light'`, klik untuk ke dark) — lucide-react
- Tooltip: label sesuai aksi berikutnya

### Light Mode Palette
| Element | Light Mode Class |
|---------|-----------------|
| Body/background | `bg-gray-50` |
| Sidebar | `bg-white border-r border-gray-200` |
| Chat bubble AI | `bg-gray-100 text-gray-800` |
| Chat bubble User | orange gradient (sama) |
| Input area | `bg-white border border-gray-300` |
| Teks utama | `text-gray-900` |
| Teks sekunder | `text-gray-500` |
| Card/panel | `bg-white shadow-sm` |

### Files Baru
- `frontend/src/context/ThemeContext.js`

### Files Dimodifikasi
- `frontend/src/App.js` — wrap dengan `<ThemeProvider>`
- `tailwind.config.js` — tambah `darkMode: 'class'`
- `frontend/src/components/layout/SideBar.jsx` — tombol toggle (di luar ProfilePopover)
- Semua pages & components — tambah `dark:` Tailwind variants

---

## 3. Notification System

### Overview
In-app notification untuk authenticated user saja (bukan guest). Admin kirim pengumuman → semua user dengan `status = 'active'` mendapat notifikasi. Bell icon + unread badge di sidebar. Polling 30 detik.

**Note scaling:** Fan-out ke semua user aktif menggunakan `createMany` dengan `skipDuplicates: true`. Untuk jumlah user saat ini masih aman synchronous. Jika user base > 10.000, migrasi ke background job (BullMQ/node-cron).

### Database
```prisma
model Announcement {
  id            Int            @id @default(autoincrement())
  title         String         @db.VarChar(200)
  message       String         @db.Text
  createdAt     DateTime       @default(now())
  // Tidak ada updatedAt — announcement bersifat immutable, tidak ada endpoint edit
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

### Backend Endpoints

**Catatan:** Semua route notifikasi user di `/api/notifications` harus dimount di `app.js`.
Route `read-all` HARUS didaftarkan **sebelum** `/:id/read` untuk mencegah Express menangkap "read-all" sebagai `:id`.

| Method | Path | Auth | Fungsi |
|--------|------|------|--------|
| GET | `/api/notifications` | User | Ambil notifikasi milik `req.user.id`, unread first, max 20 |
| PATCH | `/api/notifications/read-all` | User | Tandai semua milik `req.user.id` sebagai dibaca ← daftarkan PERTAMA |
| PATCH | `/api/notifications/:id/read` | User | Tandai satu sebagai dibaca. WAJIB validasi `notification.userId === req.user.id` (IDOR guard) |
| POST | `/api/admin/announcements` | Admin | Buat pengumuman. Validasi: title max 200 char, message max 2000 char. Fan-out ke semua `User` dengan `status = 'active'` via `createMany({ skipDuplicates: true })` |
| GET | `/api/admin/announcements` | Admin | List semua pengumuman |

### Frontend

**`NotificationContext.js`:**
```javascript
// Hanya aktif jika isAuthenticated && !isGuest
// Polling setiap 30 detik
// Subscribe ke window event 'authTokenExpired' → stop polling
// State: notifications[], unreadCount
// Methods: markRead(id), markAllRead()
```

**Komponen:**
- Bell icon di sidebar (atas, dekat header) dengan badge merah `unreadCount`
- `NotificationDropdown.jsx` — dropdown saat bell diklik:
  - Item: judul, preview message (50 char), waktu relatif, dot biru jika belum dibaca
  - Klik item → `markRead(id)`
  - Tombol "Tandai semua dibaca"
  - Max 20 item, scrollable
- Admin Dashboard: tab "Pengumuman"
  - Form: title (max 200) + message textarea (max 2000) + tombol kirim
  - List pengumuman yang pernah dikirim (id, title, createdAt, jumlah penerima)

**Stop polling saat token expired:**
```javascript
useEffect(() => {
  const handler = () => stopPolling()
  window.addEventListener('authTokenExpired', handler)
  return () => window.removeEventListener('authTokenExpired', handler)
}, [])
```

### Files Baru
- `frontend/src/context/NotificationContext.js`
- `frontend/src/components/common/NotificationDropdown.jsx`
- `backend/src/controllers/notificationController.js`
- `backend/src/routes/notificationRoutes.js`

### Files Dimodifikasi
- `frontend/src/App.js` — wrap dengan `<NotificationProvider>`
- `frontend/src/components/layout/SideBar.jsx` — bell icon + badge
- `frontend/src/pages/AdminDashboard.jsx` — tab Pengumuman
- `backend/src/app.js` — mount `/api/notifications`
- `backend/src/routes/adminRoutes.js` — mount announcement endpoints (dalam file yang sama, bukan terpisah)
- `backend/prisma/schema.prisma` — tambah Announcement + Notification model, **dan tambah back-relation di `User` model:**
  ```prisma
  // Di dalam model User yang sudah ada:
  notifications Notification[]
  ```
  Prisma membutuhkan kedua sisi relasi dideklarasikan. Tanpa ini `prisma db push` akan error.

---

## Implementation Order

1. **Schema migration** — tambah SuggestedPrompt + Announcement + Notification + PromptSource enum sekaligus via `prisma db push`
2. **Dark/Light Mode** — independen, tidak ada dependency backend
3. **Suggested Prompts** — backend endpoints + LandingPage + sidebar search
   - `SideBar.jsx` disentuh di step ini (search input)
4. **Notification System** — backend + context + komponen
   - `SideBar.jsx` disentuh lagi di step ini (bell icon)
   - **Catatan:** `SideBar.jsx` dimodifikasi di step 3 dan 4 secara sequential, tidak paralel

---

## Out of Scope
- Register page (user pakai Google OAuth)
- Jadwal kuliah (belum ada data)
- WebSocket (pakai polling untuk notifikasi)
- Email notifikasi
- Push notification browser
- Guest notifications
- Background job untuk fan-out (ditambahkan jika user base > 10.000)
