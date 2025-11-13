# 🤖 Sapa Tazkia — Chatbot Akademik AI Berbasis Web

Sapa Tazkia adalah **asisten virtual kampus** berbasis AI yang dikembangkan untuk mahasiswa dan calon mahasiswa **STMIK & Universitas Tazkia**.  
Chatbot ini membantu pengguna mengakses informasi akademik seperti **IPK, nilai, jadwal kuliah, panduan kampus, dan transkrip PDF** secara cepat, aman, dan tersedia 24/7.

---

## 🚀 Fitur Utama

### 💬 Chatbot Akademik Interaktif
- Menjawab pertanyaan akademik dan pendaftaran dalam bahasa natural.
- Menggunakan pendekatan **Retrieval-Augmented Generation (RAG)** untuk memberikan jawaban yang akurat dari dokumen resmi kampus.
- Mampu menyimpan konteks percakapan agar interaksi terasa natural.

### 🔐 Autentikasi Mahasiswa
- Login dengan email akademik (`@student.stmik.tazkia.ac.id` / `@student.tazkia.ac.id`).
- Akses ke data akademik pribadi seperti nilai, IPK, dan status akademik.

### 📄 Ekspor Transkrip ke PDF
- Mahasiswa dapat mengunduh nilai/transkrip langsung dari chatbot.
- File dihasilkan otomatis menggunakan **PDFKit/Puppeteer**.

### 📚 Integrasi Knowledge Base
- Chatbot menggunakan **Qdrant Vector Database** untuk menyimpan embedding dokumen kampus (SOP, panduan, FAQ).
- Hasil pencarian relevan berdasarkan **cosine similarity**.

### ⚙️ Monitoring & Keamanan
- **JWT Authentication**, **Helmet.js**, **Rate Limiting**, dan **HTTPS (TLS 1.3)**.
- Logging dengan **Winston**, error tracking dengan **Sentry**, dan monitoring via **Grafana + Prometheus**.

---

## 🧩 Arsitektur Sistem

┌───────────────────────────┐
│ Frontend (React) │
│ └── Chat UI, Login, PDF │
└──────────────┬────────────┘
│
HTTPS / REST API
│
┌──────────────┴────────────┐
│ Backend (Express) │
│ └── Auth, RAG, PDF, AI │
└──────────────┬────────────┘
│
┌──────────┴──────────┐
│ MySQL / Prisma │ ← Data akademik & pengguna
│ Qdrant (VectorDB) │ ← Embedding dokumen kampus
└──────────────────────┘


## 🛠️ Teknologi yang Digunakan

### **Frontend**
| Komponen | Teknologi |
|-----------|------------|
| Framework | React.js 18.2.0 |
| CSS | Tailwind CSS 3.4.1 |
| State Management | Redux / Zustand |
| Routing | React Router v6 |
| UI Library | shadcn/ui |
| HTTP Client | Axios |

### **Backend**
| Komponen | Teknologi |
|-----------|------------|
| Runtime | Node.js 20.12.2 |
| Framework | Express.js 4.18.2 |
| ORM | Prisma 5.x |
| Database | MySQL 8.0 |
| Authentication | JWT + Bcrypt |
| PDF Generator | PDFKit / Puppeteer |
| Cache (opsional) | Redis |
| AI API | Gemini Flash-8B / GPT-4o mini |

### **DevOps & Infrastruktur**
| Komponen | Teknologi |
|-----------|------------|
| Hosting Frontend | Vercel |
| Hosting Backend | Railway / Render |
| CI/CD | GitHub Actions |
| Containerization | Docker + Docker Compose |
| Monitoring | Grafana + Prometheus |

---

## 📦 Prasyarat Instalasi

Sebelum menjalankan proyek, pastikan sudah menginstal:

- Node.js ≥ 20.12.2  
- npm / yarn  
- MySQL ≥ 8.0  
- Docker & Docker Compose (opsional)
- Prisma CLI (`npm install prisma --save-dev`)

---

## ⚙️ Cara Instalasi

### 1️⃣ Clone Repository
```bash
git clone https://github.com/IchsanJunaedi/Sapa-Tazkia.git
cd Sapa-Tazkia
2️⃣ Konfigurasi Environment
Buat file .env di root project:

bash
Copy code
DATABASE_URL="mysql://user:password@localhost:3306/sapa_tazkia"
JWT_SECRET="your_jwt_secret"
AI_API_KEY="your_api_key_here"
3️⃣ Instal Dependensi
bash
Copy code
cd backend && npm install
cd ../frontend && npm install
4️⃣ Migrasi Database
bash
Copy code
cd backend
npx prisma migrate dev
5️⃣ Jalankan Aplikasi
bash
Copy code
# Jalankan backend
cd backend
npm run dev

# Jalankan frontend
cd ../frontend
npm run dev
Frontend berjalan di http://localhost:5173
Backend berjalan di http://localhost:5000

🗂️ Struktur Project
bash
Copy code
sapa-tazkia/
├── frontend/           # React source code (UI)
│   ├── src/
│   ├── public/
│   └── package.json
│
├── backend/            # Express.js API
│   ├── src/
│   ├── prisma/
│   └── package.json
│
├── database/           # Skema & migrasi MySQL
├── docs/               # Dokumentasi proyek
├── .env                # Variabel lingkungan
└── docker-compose.yml  # Konfigurasi Docker
💡 Contoh Penggunaan
🧠 1. Chatting Umum
User:

"Apa saja program studi di STMIK Tazkia?"

Chatbot:

"STMIK Tazkia memiliki dua program studi:

Sistem Informasi (S1)

Teknik Informatika (S1)"

🔐 2. Akses Nilai Mahasiswa
User:

"Tampilkan nilai saya semester ini"

Chatbot:

"IPK Anda semester ini adalah 3.74. Nilai terperinci dapat diunduh dalam format PDF."

📄 3. Download Transkrip
User:

"Unduh transkrip saya"

Chatbot:

Menghasilkan file Transkrip_2021010001.pdf otomatis dari database akademik.

🧪 Test Scenario Singkat
ID	Test Case	Hasil yang Diharapkan
TC-01	Buka aplikasi pertama kali	Menampilkan welcome message
TC-03	Input kosong	Sistem tidak mengirim request
TC-04	Pertanyaan program studi	Jawaban akurat dari knowledge base
TC-06	Follow-up dengan konteks	Sistem ingat konteks percakapan
TC-07	Login mahasiswa valid	Akses fitur nilai & transkrip
TC-11	Download PDF transkrip	File PDF berhasil diunduh
TC-12	Test waktu respon	< 2 detik

🧠 Keunggulan Pendekatan RAG
Akurasi Tinggi: Jawaban berdasarkan dokumen resmi kampus.

Tanpa Halusinasi: AI hanya menjawab jika ada data valid.

Mudah Diperbarui: Knowledge base bisa diupdate kapan saja tanpa retrain model.

Transparan: Setiap jawaban bisa ditelusuri ke sumber dokumennya.

📜 Lisensi
Proyek ini dilisensikan di bawah MIT License.

👨‍💻 Tim Pengembang
Muhammad Ichsan Junaedi — Lead Developer

Tim Pengembang STMIK Tazkia — Kontributor Sistem & Data Akademik

🌐 Website: https://sapatazkia.ac.id
📬 Kontak: admin@sapatazkia.ac.id
🧾 Dokumentasi lengkap tersedia di folder /docs
