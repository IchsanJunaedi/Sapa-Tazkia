# Help Center, Terms & Policies, Report a Bug — Design Spec

**Date:** 2026-03-18
**Status:** Approved

---

## Goal

Add three informational/utility pages to SAPA-TAZKIA:
1. **Help Center** — FAQ grouped by category, public
2. **Terms & Policies** — paraphrased terms of service, public
3. **Report a Bug** — single-field form that saves to DB, authenticated only

Wire all three into the existing ProfilePopover flyout menu. Add a Bug Reports tab to the admin dashboard.

---

## Routes

| Route | Page Component | Access |
|---|---|---|
| `/help` | `pages/HelpCenterPage.jsx` | Public |
| `/terms` | `pages/TermsPoliciesPage.jsx` | Public |
| `/report-bug` | `pages/ReportBugPage.jsx` | Protected (login required) |

"Team dev" item in ProfilePopover stays as a disabled/grayed placeholder — no page yet.

---

## Styling Constraints

All three pages follow the existing design system:
- **Background:** `linear-gradient(135deg, #0A1560 0%, #1E3BCC 55%, #3D4FE0 100%)` (same as ChatPage)
- **Text:** `text-white` primary, `text-white/70` secondary
- **Container:** `max-w-3xl mx-auto px-4 md:px-8 py-10`
- **Font:** `font-sans`, body `text-sm md:text-base leading-relaxed`
- **Cards/sections:** `bg-white/10 border border-white/10 rounded-xl backdrop-blur-sm`
- **Minimum tap target on mobile:** 44px height (via `py-3` minimum on interactive elements)

---

## Page 1: Help Center (`/help`)

### Layout
- Page title: "Help Center" — `text-2xl font-bold`
- Subtitle: "Temukan jawaban atas pertanyaan kamu" — `text-white/70`
- Categories stacked vertically, each with its FAQ items below it
- Each FAQ item is an accordion (click to expand/collapse answer)
- No filter/tab — pure scroll-down layout

### Categories & Content

**1. Akun & Login**
- Bagaimana cara login ke SAPA?
- Apakah saya bisa login dengan Google?
- Bagaimana jika lupa password?
- Bagaimana cara menghapus akun saya?

**2. Chat AI**
- Apa itu SAPA dan bagaimana cara kerjanya?
- Apa itu RAG (Retrieval-Augmented Generation)?
- Berapa batas pesan yang bisa saya kirim?
- Mengapa jawaban AI kadang berbeda untuk pertanyaan yang sama?

**3. Nilai & Transkrip**
- Bagaimana cara melihat nilai saya?
- Apakah data nilai saya aman?
- Bagaimana cara memperbarui data akademik saya?

**4. Privasi & Keamanan**
- Di mana data saya disimpan?
- Apakah percakapan saya dengan AI disimpan?
- Bagaimana SAPA melindungi data pengguna?

### Accordion Behavior
- Single open at a time (opening one closes the other) OR multi-open — keep it simple: **multi-open** (each item independent)
- Chevron rotates 180° when open
- Answer text: `text-white/80 text-sm leading-relaxed`
- Mobile: full-width, tap area `py-4`

---

## Page 2: Terms & Policies (`/terms`)

### Layout
- Page title: "Terms & Policies"
- Last updated date
- Table of contents (anchor links to each section)
- Sections numbered 1–8, each with a heading and prose paragraphs
- Font: `text-sm md:text-base leading-relaxed text-white/80`

### Sections (paraphrased from Claude/Gemini terms)

1. **Penerimaan Syarat** — Dengan menggunakan SAPA, pengguna menyetujui syarat ini. Jika tidak setuju, jangan gunakan layanan.
2. **Penggunaan Layanan** — SAPA hanya boleh digunakan untuk keperluan akademik yang sah. Dilarang menyalahgunakan, meretas, atau menggunakan bot.
3. **Akun Pengguna** — Pengguna bertanggung jawab menjaga keamanan akun. Jangan bagikan kredensial login.
4. **Konten & Kekayaan Intelektual** — Konten yang dihasilkan AI adalah untuk referensi. Pengguna tetap bertanggung jawab atas penggunaan konten tersebut.
5. **Privasi & Data** — Data dikumpulkan sesuai Kebijakan Privasi. Tidak dijual ke pihak ketiga.
6. **Batasan Tanggung Jawab** — SAPA tidak bertanggung jawab atas kerugian akibat penggunaan layanan. Informasi AI bukan pengganti penasihat akademik resmi.
7. **Perubahan Layanan** — Tim SAPA dapat mengubah atau menghentikan layanan sewaktu-waktu dengan pemberitahuan.
8. **Kontak** — Pertanyaan terkait syarat ini dapat dikirim melalui halaman Report a Bug atau menghubungi admin institusi.

---

## Page 3: Report a Bug (`/report-bug`)

### Layout
- Page title: "Report a Bug"
- Subtitle: "Temukan masalah? Beritahu kami."
- Single form: satu input field "Judul Bug" + tombol submit
- Setelah submit: tampilkan success state (ikon centang, pesan terima kasih, tombol "Kirim laporan lain")
- Protected route — redirect ke `/login` jika belum login

### Form Fields
- **Judul Bug** — text input, required, max 200 karakter, placeholder "Contoh: Tombol kirim pesan tidak merespons"
- **Submit button** — "Kirim Laporan", full-width di mobile

### Validation
- Judul tidak boleh kosong
- Judul minimal 10 karakter

---

## Backend

### Prisma Model

```prisma
model BugReport {
  id        Int      @id @default(autoincrement())
  title     String
  userId    Int
  user      User     @relation(fields: [userId], references: [id])
  createdAt DateTime @default(now())
}
```

Also add `bugReports BugReport[]` to the `User` model.

### API Endpoints

**POST `/api/bug-reports`** — Protected
- Request body: `{ title: string }`
- Validates: title present, 10–200 chars
- Saves to DB with `userId` from JWT
- Response: `{ success: true, id: number }`

**GET `/api/admin/bug-reports`** — Admin only
- Returns all bug reports with user name + email
- Ordered by `createdAt DESC`
- Response: `{ reports: [{ id, title, user: { fullName, email }, createdAt }] }`

### Files to create/modify (backend)

| Action | File |
|---|---|
| Modify | `backend/prisma/schema.prisma` |
| Create | `backend/src/controllers/bugReportController.js` |
| Create | `backend/src/routes/bugReportRoutes.js` |
| Modify | `backend/src/app.js` (register route) |
| Modify | `backend/src/controllers/adminController.js` (add getBugReports) |
| Modify | `backend/src/routes/adminRoutes.js` (add GET endpoint) |

---

## ProfilePopover Navigation

`ProfilePopover.jsx` receives a new `onNavigate` prop (a function that takes a path string). Each Help submenu item and main menu item calls `onNavigate(path)` then `onClose()`.

Alternatively (simpler): import `useNavigate` directly inside `ProfilePopover.jsx` since it's always rendered inside a Router context.

**Go with:** `useNavigate` inside ProfilePopover — no new prop needed, cleaner.

Items wired:
- "Help center" → `navigate('/help')`
- "Terms & policies" → `navigate('/terms')`
- "Team dev" → disabled, `opacity-50 cursor-not-allowed`
- "Report a bug" → `navigate('/report-bug')`

---

## Admin Dashboard — Bug Reports Tab

In `AdminDashboard.jsx`, add a new tab "Bug Reports" to the existing tab list. Tab content: a table with columns:
- No
- Judul Bug
- Dilaporkan oleh (name + email)
- Tanggal

Table style matches existing admin dashboard table styling.

---

## Mobile Optimization Summary

- All pages: `px-4 md:px-8`, `py-10 md:py-16`
- Help Center accordion: `py-4` tap targets, chevron icon always visible
- Terms: font readable at `text-sm` on mobile, section headings `text-base font-semibold`
- Report a Bug: input + button full-width, stacked layout
- ProfilePopover navigation closes before navigating (no layering issue)

---

## Out of Scope

- Search functionality in Help Center
- "Team dev" page (placeholder only)
- Email notifications for bug reports
- Bug report status tracking (open/closed)
- File/screenshot attachments
