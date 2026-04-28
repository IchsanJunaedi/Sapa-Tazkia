# SEO & AI Bot Optimization — Sapa-Tazkia Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Optimize the Sapa-Tazkia React frontend for search engines and AI crawlers by improving meta tags, adding JSON-LD schema, updating robots.txt, and enriching the LandingPage with E-E-A-T signals.

**Architecture:** All changes are purely frontend — no backend required. `index.html` gets meta/OG/JSON-LD additions, `robots.txt` gets explicit AI bot rules, and `LandingPage.jsx` gets a semantic SEO-friendly content layer added above its existing UI.

**Tech Stack:** React 19 (CRA), Tailwind CSS, plain HTML (index.html), JSON-LD

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `frontend/public/index.html` | Modify | Meta description, OG tags, JSON-LD script |
| `frontend/public/robots.txt` | Modify | AI bot allowlist + standard crawler rules |
| `frontend/src/pages/LandingPage.jsx` | Modify | Add SEO H1, keyword paragraphs, E-E-A-T footer section |

> **Note on routing:** The project has two router files: `App.js` (capital A, the live entry point imported by `main.jsx`) and `app.jsx` (lowercase, a legacy file). `app.jsx` routes `/` → `LoginPage`, but `App.js` may already route correctly. Task 4 starts by identifying which file is live before touching either one.

---

## Task 1: index.html — Meta Tags & Open Graph

**Files:**
- Modify: `frontend/public/index.html`

- [ ] **Step 1: Read the current file**

  Confirm current state before editing:
  ```bash
  cat frontend/public/index.html
  ```

- [ ] **Step 2: Replace the `<head>` content**

  Replace the entire `<head>` block in `frontend/public/index.html` with:

  ```html
  <head>
    <meta charset="utf-8" />
    <link rel="icon" href="%PUBLIC_URL%/a2.ico" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <meta name="theme-color" content="#f97316" />

    <!-- Primary SEO Meta -->
    <meta
      name="description"
      content="Sapa-Tazkia adalah AI Chatbot akademik berbasis RAG untuk mahasiswa STMIK Tazkia. Tanya jadwal, nilai, dan materi kuliah secara cerdas — gratis dan mudah diakses."
    />
    <meta name="keywords" content="AI chatbot, STMIK Tazkia, chatbot kampus, asisten akademik, pendidikan teknologi, RAG AI" />
    <meta name="author" content="STMIK Tazkia" />
    <meta name="robots" content="index, follow" />

    <!-- Open Graph (Facebook, WhatsApp, LinkedIn) -->
    <meta property="og:type" content="website" />
    <meta property="og:title" content="Sapa-Tazkia | AI Chatbot Akademik STMIK Tazkia" />
    <meta property="og:description" content="Asisten AI berbasis RAG untuk mahasiswa STMIK Tazkia — tanya jadwal, nilai, dan materi kuliah kapan saja." />
    <meta property="og:image" content="%PUBLIC_URL%/logosapatazkia.png" />
    <meta property="og:url" content="https://sapa-tazkia.stmik-tazkia.ac.id" />
    <meta property="og:site_name" content="Sapa-Tazkia" />
    <meta property="og:locale" content="id_ID" />

    <!-- Twitter Card -->
    <meta name="twitter:card" content="summary_large_image" />
    <meta name="twitter:title" content="Sapa-Tazkia | AI Chatbot Akademik STMIK Tazkia" />
    <meta name="twitter:description" content="Asisten AI berbasis RAG untuk mahasiswa STMIK Tazkia — tanya jadwal, nilai, dan materi kuliah kapan saja." />
    <meta name="twitter:image" content="%PUBLIC_URL%/logosapatazkia.png" />

    <!-- PWA -->
    <link rel="apple-touch-icon" href="%PUBLIC_URL%/a2.ico" />
    <link rel="manifest" href="%PUBLIC_URL%/manifest.json" />

    <!-- Fonts -->
    <link rel="preconnect" href="https://api.fontshare.com" />
    <link href="https://api.fontshare.com/v2/css?f[]=satoshi@900,700,500,400,300&display=swap" rel="stylesheet" />

    <title>Sapa-Tazkia | AI Chatbot Akademik STMIK Tazkia</title>
  </head>
  ```

- [ ] **Step 3: Verify visually**

  Start dev server and open browser DevTools → Elements → `<head>`. Confirm all new `<meta>` and `<title>` tags appear with correct values.

  ```bash
  cd frontend && npm start
  ```

- [ ] **Step 4: Commit**

  ```bash
  git add frontend/public/index.html
  git commit -m "seo: update meta tags, Open Graph, and Twitter Card in index.html"
  ```

---

## Task 2: index.html — JSON-LD Schema Markup

**Files:**
- Modify: `frontend/public/index.html`

- [ ] **Step 1: Add JSON-LD script inside `<head>`**

  Insert the following `<script>` block as the **last child of `<head>`** (just before `</head>`):

  ```html
  <!-- JSON-LD Structured Data -->
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "name": "Sapa-Tazkia",
    "alternateName": "Sapa Tazkia AI Chatbot",
    "description": "Sapa-Tazkia adalah asisten AI akademik berbasis RAG (Retrieval-Augmented Generation) yang membantu mahasiswa STMIK Tazkia mendapatkan informasi tentang jadwal, nilai, dan materi perkuliahan.",
    "applicationCategory": "EducationalApplication",
    "operatingSystem": "Web",
    "url": "https://sapa-tazkia.stmik-tazkia.ac.id",
    "author": {
      "@type": "Organization",
      "name": "STMIK Tazkia",
      "url": "https://stmik-tazkia.ac.id"
    },
    "offers": {
      "@type": "Offer",
      "price": "0",
      "priceCurrency": "IDR"
    },
    "inLanguage": "id",
    "audience": {
      "@type": "EducationalAudience",
      "educationalRole": "student"
    }
  }
  </script>
  ```

- [ ] **Step 2: Validate the JSON-LD**

  Open [https://search.google.com/test/rich-results](https://search.google.com/test/rich-results) and paste the URL, or use the URL validator. Alternatively, paste the JSON into [https://validator.schema.org](https://validator.schema.org) to confirm no errors.

  *(Manual step — no automated test needed for static JSON-LD.)*

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/public/index.html
  git commit -m "seo: add JSON-LD SoftwareApplication/EducationalApplication schema markup"
  ```

---

## Task 3: robots.txt — AI Bot Allowlist

**Files:**
- Modify: `frontend/public/robots.txt`

- [ ] **Step 1: Replace entire robots.txt**

  Overwrite `frontend/public/robots.txt` with:

  ```
  # Sapa-Tazkia — STMIK Tazkia AI Chatbot
  # robots.txt: https://www.robotstxt.org/robotstxt.html

  # Standard search engines
  User-agent: *
  Allow: /
  Disallow: /admin
  Disallow: /api/

  # Google
  User-agent: Googlebot
  Allow: /

  # Bing
  User-agent: Bingbot
  Allow: /

  # --- AI Crawlers ---

  # OpenAI ChatGPT
  User-agent: ChatGPT-User
  Allow: /

  # OpenAI GPTBot (training crawler)
  User-agent: GPTBot
  Allow: /

  # Anthropic ClaudeBot
  User-agent: ClaudeBot
  Allow: /

  # Anthropic Claude-User
  User-agent: Claude-User
  Allow: /

  # Perplexity AI
  User-agent: PerplexityBot
  Allow: /

  # Google Gemini / Bard
  User-agent: Google-Extended
  Allow: /

  # Meta AI
  User-agent: Meta-ExternalAgent
  Allow: /

  # Common-Crawl (used by many AI training pipelines)
  User-agent: CCBot
  Allow: /

  Sitemap: https://sapa-tazkia.stmik-tazkia.ac.id/sitemap.xml
  ```

  > **Note:** The `Disallow: /admin` and `Disallow: /api/` lines prevent crawlers from indexing the admin panel and raw API endpoints, which is correct security hygiene.

- [ ] **Step 2: Verify robots.txt is served correctly**

  After `npm start`, navigate to `http://localhost:3000/robots.txt` and confirm the content is the new file.

- [ ] **Step 3: Commit**

  ```bash
  git add frontend/public/robots.txt
  git commit -m "seo: update robots.txt to explicitly allow AI bots (GPTBot, ClaudeBot, PerplexityBot, etc)"
  ```

---

## Task 4: LandingPage.jsx — E-E-A-T SEO Content Layer

**Files:**
- Modify: `frontend/src/pages/LandingPage.jsx`
- Check: `frontend/src/App.js` or `frontend/src/app.jsx` (whichever is the active entry point)

### Step 4a: Verify routing

- [ ] **Step 1: Identify the live router file**

  The project has two router files: `App.js` (capital A) and `app.jsx`. Check `frontend/src/main.jsx` (the Vite/CRA entry point) to see which one is imported:

  ```bash
  cat frontend/src/main.jsx
  ```

  The file that `main.jsx` imports (`./App` or `./app`) is the live one. **Edit only that file.**

- [ ] **Step 2: Check routing in the live router file**

  Open the identified file and look for `path="/"`. If it routes to `LoginPage` instead of `LandingPage`, fix it:

  ```jsx
  // Change:
  <Route path="/" element={<LoginPage />} />
  // To:
  <Route path="/" element={<LandingPage />} />
  // And add the import if missing:
  import LandingPage from './pages/LandingPage';
  ```

  > The CLAUDE.md routing table shows `/` → LandingPage (public), so this is the intended behavior. If it already routes to LandingPage, skip this step.

- [ ] **Step 3: Commit routing fix if changed**

  ```bash
  git add frontend/src/App.js   # or app.jsx — whichever you edited
  git commit -m "fix: route / to LandingPage as intended per architecture"
  ```

### Step 4b: Add SEO content to LandingPage.jsx

- [ ] **Step 4: Read LandingPage.jsx first**

  Understand the current structure before editing (the file is long — read fully).

- [ ] **Step 5: Find and demote any existing `<h1>` tags**

  Search for existing `<h1>` elements in `LandingPage.jsx`:

  ```bash
  grep -n "<h1" frontend/src/pages/LandingPage.jsx
  ```

  If any `<h1>` tags are found (there is one at approximately line 1104), change them to `<h2>` to avoid duplicate H1. A page must have **exactly one** `<h1>` for SEO correctness:

  ```jsx
  // Change any existing:
  <h1 className="...">...</h1>
  // To:
  <h2 className="...">...</h2>
  ```

- [ ] **Step 6: Add an `<SEOContent>` section component**

  Create a standalone functional component at the bottom of `LandingPage.jsx` (before the `export default`). This keeps the SEO content decoupled from the existing UI:

  ```jsx
  // --- SEO Content & E-E-A-T Section ---
  const SEOContent = () => (
    <section
      aria-label="Tentang Sapa-Tazkia"
      className="bg-white border-t border-gray-100 py-16 px-6"
    >
      <div className="max-w-4xl mx-auto">
        {/* H1 — hanya satu per halaman, wajib untuk SEO */}
        <h1 className="text-3xl font-bold text-gray-900 mb-6 text-center">
          Sapa-Tazkia: AI Chatbot Akademik STMIK Tazkia
        </h1>

        {/* Deskripsi utama dengan keyword density natural */}
        <p className="text-gray-700 text-lg leading-relaxed mb-4">
          <strong>Sapa-Tazkia</strong> adalah asisten kecerdasan buatan (AI) berbasis{' '}
          <em>Retrieval-Augmented Generation (RAG)</em> yang dirancang khusus untuk
          mendukung kegiatan akademik mahasiswa{' '}
          <strong>STMIK Tazkia</strong>. Platform chatbot ini memungkinkan Anda
          mendapatkan informasi tentang jadwal kuliah, nilai akademik, dan materi
          perkuliahan secara instan dan akurat.
        </p>

        <p className="text-gray-700 leading-relaxed mb-4">
          Dengan memanfaatkan teknologi AI terkini dan basis data pengetahuan kampus,
          Sapa-Tazkia hadir sebagai solusi digitalisasi layanan pendidikan yang cerdas.
          Chatbot ini memahami konteks pertanyaan dalam bahasa Indonesia dan memberikan
          jawaban yang relevan sesuai dengan kurikulum dan regulasi{' '}
          <strong>STMIK Tazkia</strong>.
        </p>

        <p className="text-gray-700 leading-relaxed mb-10">
          Sapa-Tazkia merupakan wujud nyata penerapan <strong>teknologi AI</strong> dalam
          dunia pendidikan tinggi Indonesia — menggabungkan inovasi, aksesibilitas, dan
          kualitas layanan akademik dalam satu platform terintegrasi.
        </p>

        {/* Fitur Utama */}
        <div className="grid md:grid-cols-3 gap-6 mb-12">
          {[
            {
              title: 'Tanya Jawab Akademik',
              desc: 'Jawab pertanyaan seputar jadwal, nilai, dan mata kuliah menggunakan basis pengetahuan kampus secara real-time.',
            },
            {
              title: 'Berbasis RAG & AI',
              desc: 'Menggunakan Retrieval-Augmented Generation untuk jawaban yang akurat dan relevan, bukan sekadar template.',
            },
            {
              title: 'Akses Multi-Platform',
              desc: 'Tersedia di browser desktop maupun mobile. Login dengan NIM atau akun Google kampus Anda.',
            },
          ].map((f) => (
            <div key={f.title} className="bg-orange-50 rounded-xl p-5">
              <h2 className="font-semibold text-gray-900 mb-2">{f.title}</h2>
              <p className="text-gray-600 text-sm">{f.desc}</p>
            </div>
          ))}
        </div>

        {/* E-E-A-T: Tentang Tim & Kredibilitas */}
        <div className="bg-gray-50 rounded-2xl p-8 mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-3">
            Tentang Pengembang
          </h2>
          <p className="text-gray-700 leading-relaxed mb-3">
            Sapa-Tazkia dikembangkan oleh tim mahasiswa Program Studi Teknik
            Informatika <strong>STMIK Tazkia</strong> sebagai proyek riset terapan
            di bidang kecerdasan buatan dan sistem informasi akademik. Proyek ini
            dibimbing oleh dosen dan staf IT STMIK Tazkia untuk memastikan kualitas,
            keamanan, dan relevansi terhadap kebutuhan civitas akademika.
          </p>
          <p className="text-gray-700 leading-relaxed">
            Kami berkomitmen untuk terus meningkatkan kemampuan AI ini berdasarkan
            feedback dari mahasiswa dan kebutuhan nyata lingkungan kampus.
          </p>
        </div>

        {/* Footer / Kontak */}
        <footer className="border-t border-gray-200 pt-8 text-sm text-gray-500">
          <div className="flex flex-col md:flex-row justify-between gap-4">
            <div>
              <p className="font-semibold text-gray-700 mb-1">Sapa-Tazkia</p>
              <p>AI Chatbot Akademik — STMIK Tazkia</p>
              <p>Bogor, Jawa Barat, Indonesia</p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Kontak</p>
              <p>Email: <a href="mailto:info@stmik-tazkia.ac.id" className="text-orange-500 hover:underline">info@stmik-tazkia.ac.id</a></p>
              <p>Website: <a href="https://stmik-tazkia.ac.id" className="text-orange-500 hover:underline" target="_blank" rel="noopener noreferrer">stmik-tazkia.ac.id</a></p>
            </div>
            <div>
              <p className="font-semibold text-gray-700 mb-1">Legal</p>
              <p>© {new Date().getFullYear()} STMIK Tazkia.</p>
              <p>Hak cipta dilindungi undang-undang.</p>
            </div>
          </div>
        </footer>
      </div>
    </section>
  );
  ```

- [ ] **Step 7: Render `<SEOContent>` in the LandingPage's return**

  Find the outermost `return (...)` in the `LandingPage` default export. Add `<SEOContent />` as the **last child** of the root container so it appears below the existing hero/UI without disrupting layout:

  ```jsx
  // At the end of LandingPage's JSX, before the closing root div:
  <SEOContent />
  ```

- [ ] **Step 8: Verify in browser**

  Run `npm start` and navigate to `/`. Confirm:
  - A visible `<h1>` appears with the correct text
  - The three feature cards render correctly
  - "Tentang Pengembang" section is visible
  - Footer links are functional

  Also open DevTools → Elements and confirm the `<h1>` tag is present and there is only **one** `<h1>` on the page.

- [ ] **Step 9: Run existing tests to confirm no regressions**

  ```bash
  cd frontend && npm test -- --watchAll=false
  ```

  Expected: all existing tests pass (we only added a new component, not changed existing logic).

- [ ] **Step 10: Commit**

  ```bash
  git add frontend/src/pages/LandingPage.jsx
  git commit -m "seo: add E-E-A-T content layer and semantic H1 to LandingPage"
  ```

---

## Validation Checklist (after all tasks complete)

Run these checks before closing the branch:

- [ ] `http://localhost:3000` — page has `<h1>` in DOM (DevTools)
- [ ] `http://localhost:3000/robots.txt` — AI bots listed with `Allow: /`
- [ ] DevTools → `<head>` has `og:title`, `og:description`, `og:image`
- [ ] DevTools → `<head>` has `<script type="application/ld+json">` with valid JSON
- [ ] [Rich Results Test](https://search.google.com/test/rich-results) — no errors on SoftwareApplication schema
- [ ] No console errors in browser

---

## Final Commit (optional)

After all four tasks are done:

```bash
git tag seo-v1.0
```
