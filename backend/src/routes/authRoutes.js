const express = require('express');
const passport = require('passport'); 

const router = express.Router();

/**
 * ======================================================================
 * INI ADALAH KODE BACKEND (NODE.JS / EXPRESS)
 * Ini adalah file yang seharusnya ada di M:\Sapa-Tazkia\backend\src\routes\
 * ======================================================================
 */

/**
 * @route   POST /api/auth/login
 * @desc    Login user (NIM & Password)
 * @access  Public
 * * Ini dipanggil oleh fungsi `login` di AuthContext Anda
 */
router.post('/login', (req, res) => {
    // Ambil NIM dan password dari body request
    const { nim, password } = req.body;

    console.log("BACKEND: Menerima permintaan login untuk NIM:", nim);

    // --- LOGIKA LOGIN ANDA DI SINI ---
    // 1. Cari user di database berdasarkan NIM
    // 2. Bandingkan password (gunakan bcrypt.compare)
    // 3. Jika berhasil, buat JWT Token
    
    // Contoh respons SUKSES (tiruan)
    // Kirim balik token dan data user, sama seperti yg diharapkan frontend
    if (nim === "12345" && password === "password") {
        const mockToken = "ini-adalah-jwt-token-dari-backend";
        const mockUser = { nim: "12345", name: "User dari Database" };
        
        return res.status(200).json({
            token: mockToken,
            user: mockUser
        });
    }

    // Contoh respons GAGAL
    return res.status(401).json({ message: "NIM atau Password salah" });
});

/**
 * @route   POST /api/auth/register
 * @desc    Registrasi user baru
 * @access  Public
 *
 * Ini dipanggil oleh fungsi `register` di AuthContext Anda
 */
router.post('/register', (req, res) => {
    const { nim, nama, password } = req.body;
    console.log("BACKEND: Menerima permintaan registrasi untuk:", nim, nama);

    // --- LOGIKA REGISTER ANDA DI SINI ---
    // 1. Cek apakah NIM sudah ada
    // 2. Hash password (gunakan bcrypt.hash)
    // 3. Simpan user baru ke database
    // 4. Buat JWT Token

    // Contoh respons SUKSES (tiruan)
    const mockToken = "ini-adalah-jwt-token-baru-setelah-register";
    const newUser = { nim: nim, name: nama };

    return res.status(201).json({
        token: mockToken,
        user: newUser
    });
});

/**
 * @route   GET /api/auth/me
 * @desc    Dapatkan data user yang sedang login (via token)
 * @access  Private (Perlu Token)
 *
 * Ini dipanggil oleh `useEffect` di AuthContext Anda
 */
// PENTING: Anda perlu 'middleware' untuk melindungi rute ini
// Ini adalah contoh sederhana, biasanya Anda akan pakai passport.authenticate('jwt', ...)
const protectedMiddleware = (req, res, next) => {
    // Cek header 'Authorization'
    const authHeader = req.headers['authorization']; // 'bearer TOKEN...'
    const token = authHeader && authHeader.split(' ')[1];

    if (!token) {
        return res.status(401).json({ message: "Akses ditolak, tidak ada token" });
    }

    // --- LOGIKA VERIFIKASI TOKEN ANDA DI SINI ---
    // (gunakan jwt.verify(token, ...))
    // Jika token valid, pasang user ke req (req.user = ...)
    
    console.log("BACKEND: Menerima token:", token);
    
    // Jika token (tiruan) valid, lanjutkan
    if (token.startsWith("ini-adalah-jwt-token")) {
        // Pasang data user tiruan ke request
        req.user = { nim: "12345", name: "User dari Token" };
        next(); // Lanjutkan ke handler rute
    } else {
        return res.status(401).json({ message: "Token tidak valid" });
    }
};

router.get('/me', protectedMiddleware, (req, res) => {
    // Karena lolos middleware, kita punya req.user
    console.log("BACKEND: Mengirim data /me untuk user:", req.user.nim);
    
    // Kirim data user (tanpa password)
    return res.status(200).json({
        user: req.user 
    });
});


/**
 * @route   GET /api/auth/google
 * @desc    Mulai proses otentikasi Google
 * @access  Public
 *
 * Ini dipanggil oleh `handleGoogleLogin` di LoginPage Anda
 */
router.get('/google', 
    // Ini akan mengarahkan user ke halaman login Google
    passport.authenticate('google', { scope: ['profile', 'email'] })
);

/**
 * @route   GET /api/auth/google/callback
 * @desc    Callback setelah login Google berhasil
 * @access  Public
 */
router.get('/google/callback', 
    passport.authenticate('google', { 
        failureRedirect: 'http://localhost:3000/login', // Arahkan ke frontend jika gagal
        session: false // Kita pakai token, bukan session
    }),
    (req, res) => {
        // User berhasil login via Google
        // 'req.user' akan berisi data dari Google (disediakan oleh Passport)
        
        // --- LOGIKA BUAT TOKEN ANDA DI SINI ---
        // Buat JWT Token untuk user ini (req.user)
        const token = "ini-adalah-jwt-token-dari-google"; 

        // Redirect kembali ke frontend Anda, sambil mengirim token
        // Cara umum adalah via query parameter
        res.redirect(`http://localhost:3000/auth/callback?token=${token}`);
    }
);


// Jangan lupa export router-nya
// GANTI DARI 'export default router' MENJADI:
module.exports = router;