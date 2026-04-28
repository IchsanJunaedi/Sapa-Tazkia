# Testing & Coverage Guide

Panduan end-to-end untuk menjalankan **Unit / API / Integration Testing**
(Jest + Supertest + Prisma) dan **Functional / E2E Testing** (Playwright),
serta menggabungkan hasil coverage-nya menjadi satu laporan `lcov.info`
yang dapat di-upload ke **Codecov**.

Target: **test coverage > 75%**.

---

## 1. Struktur Direktori

```
backend/
├── jest.config.js                 # Konfigurasi Jest + coverage reporters (lcov)
├── playwright.config.js           # Konfigurasi Playwright
├── scripts/
│   └── merge-coverage.js          # Menggabungkan lcov Jest + Playwright
└── tests/
    ├── setup.js                   # Load env vars untuk test
    ├── helpers/
    │   ├── appHelper.js           # Supertest agent yang dibind ke Express app
    │   └── dbHelper.js            # truncateAll() + seed helpers via Prisma
    ├── unit/                      # Pure-function unit tests
    ├── integration/               # Multi-layer integration tests (DB + HTTP)
    ├── api/
    │   └── qa.test.js             # ← API + Integration: POST /api/tanya
    └── e2e/
        ├── fixtures.js            # Custom Playwright fixture → V8 coverage
        └── qa-flow.spec.js        # ← Functional: form tanya-jawab di browser
```

---

## 2. Setup Awal

### 2.1 Dependencies

```bash
cd backend
npm install
```

`package.json` sudah mencakup `jest`, `supertest`, `@playwright/test`, dan
`monocart-coverage-reports`. Setelah install, unduh browser Chromium untuk
Playwright (**sekali saja** per machine):

```bash
npm run test:e2e:install
```

### 2.2 Environment Variables

Copy template dan edit sesuai kebutuhan:

```bash
cp backend/.env.test.example backend/.env.test
```

File `.env.test` harus menunjuk ke **database test** (bukan dev / production).
File sudah di-gitignore.

Apply schema ke DB test:

```bash
npx prisma db push --skip-generate
```

---

## 3. Menjalankan Test

| Perintah                       | Apa yang dijalankan                                                      |
| ------------------------------ | ------------------------------------------------------------------------ |
| `npm test`                     | Semua Jest test (unit + integration + api).                              |
| `npm run test:unit`            | Hanya `tests/unit/**`.                                                   |
| `npm run test:api`             | Hanya `tests/api/**` dan `tests/integration/**` (HTTP + DB).             |
| `npm run test:coverage`        | Jest + coverage → `coverage/jest/lcov.info`.                             |
| `npm run test:e2e`             | Playwright E2E → `coverage/e2e/lcov.info` + screenshots/video on failure.|
| `npm run coverage:merge`       | Gabungkan lcov Jest + Playwright → `coverage/lcov.info`.                 |
| `npm run coverage:all`         | Shortcut: coverage → e2e → merge.                                        |

### 3.1 Menjalankan API / Integration saja

```bash
cd backend
npm run test:api
```

Contoh skenario di `tests/api/qa.test.js`:

1. `POST /api/tanya` dengan payload tanya-jawab.
2. Expect `status ∈ {200, 201}` dan body `{ success: true, data: … }`.
3. Integration: `prisma.tanya.findUnique({ where: { id } })` → pastikan row ada.
4. Negative path: payload kosong → expect `400|422`.
5. Teardown: delete record + `prisma.$disconnect()`.

> **Catatan**: Endpoint `/api/tanya` dan model `Tanya` di-config sebagai
> variabel **dummy** di atas file. Ganti `TANYA_ENDPOINT`, `TANYA_MODEL_KEY`,
> dan `TANYA_UNIQUE_FIELD` (atau set env vars) sesuai kode aktual Anda.

### 3.2 Menjalankan Functional / E2E

Pastikan frontend jalan di `http://localhost:3000` (atau set `E2E_BASE_URL`):

```bash
# Terminal 1 — jalankan frontend
cd frontend && npm start

# Terminal 2 — jalankan E2E
cd backend && npm run test:e2e
```

Report HTML Playwright tersedia di `backend/coverage/e2e/html-report/index.html`.

---

## 4. Coverage Merging untuk Codecov

Pipeline coverage:

```
Jest       → coverage/jest/lcov.info
Playwright → coverage/e2e/lcov.info   (via monocart-coverage-reports)
             │
             └──►  scripts/merge-coverage.js  ──►  coverage/lcov.info  ──►  Codecov
```

### 4.1 Manual merge (lokal)

```bash
npm run test:coverage     # hasil: coverage/jest/lcov.info
npm run test:e2e          # hasil: coverage/e2e/lcov.info
npm run coverage:merge    # hasil: coverage/lcov.info
```

### 4.2 Cara kerja `scripts/merge-coverage.js`

Script membaca kedua `lcov.info`, meng-concat blok `SF:` / `end_of_record`,
dan menulis `coverage/lcov.info`. Format lcov mengizinkan concat selama file
sumber berbeda — backend (`backend/src/**`) dan frontend (`frontend/src/**`)
tidak pernah overlap, jadi aman.

Jika Anda ingin deduplikasi & sum line counts (misalnya ketika backend juga
dibundle di E2E), ganti dengan:

```bash
npx lcov-result-merger 'coverage/*/lcov.info' coverage/lcov.info
```

### 4.3 Upload ke Codecov di CI

CI sudah di-wire: `.github/workflows/ci.yml` meng-upload `backend/coverage/jest/lcov.info`
ke Codecov pada setiap PR ke `main` dan push ke `main`/`develop`.

**Yang perlu disetup sekali**:

1. Tambahkan repository ini di [app.codecov.io](https://app.codecov.io/) dan
   dapatkan `CODECOV_TOKEN`.
2. Tambahkan token ke GitHub Secrets:
   `Settings → Secrets and variables → Actions → New repository secret`
   dengan nama `CODECOV_TOKEN`.
3. Target coverage (75%) dikonfigurasi di `codecov.yml` di root repo.

**Opsional — menambahkan E2E ke CI** (butuh MySQL + Redis + frontend dev server
running di job yang sama). Snippet contoh untuk CI job terpisah:

```yaml
- name: Install Playwright browsers
  working-directory: backend
  run: npm run test:e2e:install

- name: Run E2E (Playwright)
  working-directory: backend
  env:
    E2E_BASE_URL: http://localhost:3000
  run: npm run test:e2e

- name: Merge coverage
  working-directory: backend
  run: npm run coverage:merge

- name: Upload merged coverage to Codecov
  uses: codecov/codecov-action@v4
  with:
    files: backend/coverage/lcov.info
    flags: e2e
    token: ${{ secrets.CODECOV_TOKEN }}
```

---

## 5. Mencapai Coverage > 75%

Strategi yang disarankan:

1. **Unit test** services murni (fungsi helper, validator, formatter)
   — cepat, tanpa DB, bobot baris besar.
2. **API test** untuk setiap controller (happy + negative path).
3. **Integration test** untuk skenario end-to-end yang menyentuh Prisma + Redis.
4. **E2E test** untuk alur kritis user (login, chat, transcript download).

Threshold Jest sudah di-set di `jest.config.js`:

```js
coverageThreshold: {
  global: { branches: 50, functions: 60, lines: 60, statements: 60 }
}
```

Setelah Codecov mengagregasi Jest + Playwright, total baris biasanya
naik 15-25 poin di atas angka Jest saja — menargetkan `lines ≥ 60` di Jest
umumnya mencapai `>= 75%` di Codecov setelah merge.

---

## 6. Troubleshooting

| Gejala                                                     | Fix                                                                            |
| ---------------------------------------------------------- | ------------------------------------------------------------------------------ |
| `Cannot find module 'monocart-coverage-reports'`           | `cd backend && npm install`                                                    |
| Playwright: `Executable doesn't exist`                     | `npm run test:e2e:install`                                                     |
| `coverage/e2e/lcov.info` kosong                            | Pastikan `tests/e2e/*.spec.js` mengimport `{ test, expect }` dari `./fixtures` |
| Jest hang setelah test selesai                             | Sudah ada `--forceExit --detectOpenHandles`; cek Prisma `$disconnect()` di afterAll |
| MySQL error `ECONNREFUSED` saat `npm run test:api`         | `docker-compose up -d mysql` dan tunggu healthcheck                            |
