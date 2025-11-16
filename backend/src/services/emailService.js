const nodemailer = require('nodemailer');
require('dotenv').config();

/**
 * Email Service untuk mengirim email verifikasi
 */

// Konfigurasi transporter email
const createTransporter = () => {
  // ✅ PERBAIKAN: Ganti createTransporter menjadi createTransport
  return nodemailer.createTransport({
    service: process.env.EMAIL_SERVICE || 'gmail',
    auth: {
      user: process.env.EMAIL_USER || 'your-email@gmail.com',
      pass: process.env.EMAIL_PASSWORD || 'your-app-password'
    }
  });
};

/**
 * Generic function untuk mengirim email
 */
const sendEmail = async (to, subject, html, text = '') => {
  try {
    console.log('📧 [EMAIL SERVICE] Preparing to send email to:', to);
    
    // Validasi input
    if (!to || !subject || !html) {
      throw new Error('Email, subject, dan content harus diisi');
    }

    // Buat transporter
    const transporter = createTransporter();
    
    // Konfigurasi email
    const mailOptions = {
      from: process.env.EMAIL_FROM_ADDRESS ? 
        `"${process.env.EMAIL_FROM_NAME || 'SAPA Tazkia'}" <${process.env.EMAIL_FROM_ADDRESS}>` :
        `"SAPA Tazkia" <${process.env.EMAIL_USER}>`,
      to: to,
      subject: subject,
      html: html,
      text: text || html.replace(/<[^>]*>/g, '') // Generate text from HTML if not provided
    };

    // Kirim email
    const result = await transporter.sendMail(mailOptions);
    
    console.log('✅ [EMAIL SERVICE] Email sent successfully to:', to);
    console.log('📧 [EMAIL SERVICE] Message ID:', result.messageId);
    
    return {
      success: true,
      messageId: result.messageId,
      message: 'Email berhasil dikirim'
    };

  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error sending email:', error);
    
    // Handle error spesifik
    let errorMessage = 'Gagal mengirim email';
    
    if (error.code === 'EAUTH') {
      errorMessage = 'Konfigurasi email tidak valid. Silakan hubungi administrator.';
    } else if (error.code === 'EENVELOPE') {
      errorMessage = 'Alamat email tidak valid.';
    } else if (error.code === 'ECONNECTION') {
      errorMessage = 'Tidak dapat terhubung ke server email.';
    }
    
    throw new Error(errorMessage);
  }
};

/**
 * Mengirim email verifikasi dengan kode 6 digit
 */
const sendVerificationEmail = async (to, verificationCode, userName = 'User') => {
  try {
    console.log('📧 [EMAIL SERVICE] Preparing to send verification email to:', to);
    
    // Validasi input
    if (!to || !verificationCode) {
      throw new Error('Email dan kode verifikasi harus diisi');
    }

    if (verificationCode.length !== 6) {
      throw new Error('Kode verifikasi harus 6 digit');
    }

    const subject = 'Kode Verifikasi Email - SAPA Tazkia';
    const html = generateVerificationEmailHTML(userName, verificationCode);
    const text = generateVerificationEmailText(userName, verificationCode);

    const result = await sendEmail(to, subject, html, text);
    
    console.log('✅ [EMAIL SERVICE] Verification email sent successfully to:', to);
    
    return result;

  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error sending verification email:', error);
    throw error;
  }
};

/**
 * Generate HTML template untuk email verifikasi
 */
const generateVerificationEmailHTML = (userName, verificationCode) => {
  return `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Verifikasi Email - SAPA Tazkia</title>
  <style>
    body {
      font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
      line-height: 1.6;
      color: #333;
      background-color: #f4f4f4;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 600px;
      margin: 0 auto;
      background-color: #ffffff;
      border-radius: 10px;
      overflow: hidden;
      box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
    }
    .header {
      background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
      color: white;
      padding: 30px 20px;
      text-align: center;
    }
    .header h1 {
      margin: 0;
      font-size: 28px;
      font-weight: 600;
    }
    .content {
      padding: 40px 30px;
    }
    .verification-code {
      background-color: #f8f9fa;
      border: 2px dashed #dee2e6;
      border-radius: 8px;
      padding: 20px;
      text-align: center;
      margin: 30px 0;
      font-family: 'Courier New', monospace;
    }
    .code {
      font-size: 32px;
      font-weight: bold;
      color: #495057;
      letter-spacing: 8px;
    }
    .instructions {
      background-color: #e7f3ff;
      border-left: 4px solid #1890ff;
      padding: 15px;
      margin: 20px 0;
      border-radius: 4px;
    }
    .footer {
      background-color: #f8f9fa;
      padding: 20px;
      text-align: center;
      color: #6c757d;
      font-size: 14px;
    }
    .warning {
      color: #dc3545;
      font-weight: 600;
    }
    .info-box {
      background-color: #e7f3ff;
      border-radius: 8px;
      padding: 15px;
      margin: 20px 0;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <h1>🔐 Verifikasi Email</h1>
      <p>Sistem Akademik Terpadu - SAPA Tazkia</p>
    </div>
    
    <div class="content">
      <h2>Halo, ${userName}!</h2>
      <p>Terima kasih telah mendaftar di SAPA Tazkia. Untuk menyelesaikan proses registrasi, silakan verifikasi alamat email Anda dengan kode berikut:</p>
      
      <div class="verification-code">
        <div class="code">${verificationCode}</div>
      </div>
      
      <div class="instructions">
        <p><strong>Petunjuk Verifikasi:</strong></p>
        <ol>
          <li>Salin kode verifikasi di atas</li>
          <li>Kembali ke halaman verifikasi di aplikasi SAPA Tazkia</li>
          <li>Tempelkan kode verifikasi pada kolom yang tersedia</li>
          <li>Klik tombol "Verifikasi" untuk menyelesaikan pendaftaran</li>
        </ol>
      </div>
      
      <div class="info-box">
        <p><strong>Informasi Penting:</strong></p>
        <ul>
          <li>Kode verifikasi akan kadaluarsa dalam <strong>10 menit</strong></li>
          <li>Anda memiliki maksimal <strong>5 kali percobaan</strong> verifikasi</li>
          <li>Jika kode kadaluarsa, Anda dapat meminta kode baru</li>
        </ul>
      </div>
      
      <p class="warning">⚠️ Jangan berikan kode verifikasi ini kepada siapapun, termasuk pihak yang mengaku dari SAPA Tazkia.</p>
      
      <p>Jika Anda tidak merasa mendaftar di SAPA Tazkia, silakan abaikan email ini.</p>
      
      <p>Terima kasih,<br><strong>Tim SAPA Tazkia</strong></p>
    </div>
    
    <div class="footer">
      <p>© ${new Date().getFullYear()} SAPA Tazkia. All rights reserved.</p>
      <p>Email ini dikirim secara otomatis, mohon tidak membalas email ini.</p>
      <p>Jika Anda membutuhkan bantuan, hubungi support@sapa-tazkia.ac.id</p>
    </div>
  </div>
</body>
</html>
  `;
};

/**
 * Generate plain text template untuk email verifikasi
 */
const generateVerificationEmailText = (userName, verificationCode) => {
  return `
Verifikasi Email - SAPA Tazkia

Halo ${userName}!

Terima kasih telah mendaftar di SAPA Tazkia. Untuk menyelesaikan proses registrasi, silakan verifikasi alamat email Anda dengan kode berikut:

KODE VERIFIKASI: ${verificationCode}

Petunjuk Verifikasi:
1. Salin kode verifikasi di atas
2. Kembali ke halaman verifikasi di aplikasi SAPA Tazkia
3. Tempelkan kode verifikasi pada kolom yang tersedia
4. Klik tombol "Verifikasi" untuk menyelesaikan pendaftaran

Informasi Penting:
- Kode verifikasi akan kadaluarsa dalam 10 menit
- Anda memiliki maksimal 5 kali percobaan verifikasi
- Jika kode kadaluarsa, Anda dapat meminta kode baru

PERINGATAN: Jangan berikan kode verifikasi ini kepada siapapun, termasuk pihak yang mengaku dari SAPA Tazkia.

Jika Anda tidak merasa mendaftar di SAPA Tazkia, silakan abaikan email ini.

Terima kasih,
Tim SAPA Tazkia

© ${new Date().getFullYear()} SAPA Tazkia. All rights reserved.
Email ini dikirim secara otomatis, mohon tidak membalas email ini.
Jika Anda membutuhkan bantuan, hubungi support@sapa-tazkia.ac.id
  `;
};

/**
 * Mengirim email welcome setelah verifikasi berhasil
 */
const sendWelcomeEmail = async (to, userName, userType = 'student') => {
  try {
    console.log('📧 [EMAIL SERVICE] Preparing to send welcome email to:', to);
    
    const userTypeLabels = {
      'student': 'Mahasiswa',
      'staff': 'Staff',
      'regular': 'Pengguna'
    };
    
    const subject = 'Selamat Datang di SAPA Tazkia!';
    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
        <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center;">
          <h1 style="margin: 0; font-size: 28px;">🎉 Selamat Datang!</h1>
          <p style="margin: 10px 0 0 0; opacity: 0.9;">Sistem Akademik Terpadu - SAPA Tazkia</p>
        </div>
        <div style="padding: 30px;">
          <h2 style="color: #333; margin-bottom: 20px;">Halo, ${userName}!</h2>
          <p style="color: #555; line-height: 1.6;">Selamat! Akun Anda sebagai <strong>${userTypeLabels[userType] || 'Pengguna'}</strong> telah berhasil diverifikasi dan aktif di sistem SAPA Tazkia.</p>
          
          <div style="background-color: #f0f8ff; padding: 20px; border-radius: 8px; margin: 20px 0; border-left: 4px solid #1890ff;">
            <h3 style="color: #1890ff; margin-top: 0;">✅ Akun Anda Sudah Aktif</h3>
            <p style="color: #555; margin-bottom: 0;">Anda sekarang dapat mengakses semua fitur yang tersedia di SAPA Tazkia.</p>
          </div>
          
          <p style="color: #555; font-weight: 600;">Fitur yang dapat Anda gunakan:</p>
          <ul style="color: #555; line-height: 1.8;">
            <li>📚 Akses materi pembelajaran</li>
            <li>📊 Lihat nilai akademik</li>
            <li>🗓️ Cek jadwal kuliah</li>
            <li>💬 Konsultasi dengan dosen</li>
            ${userType === 'student' ? '<li>🎓 Informasi kelulusan</li>' : ''}
            <li>📱 Akses mobile-friendly</li>
          </ul>
          
          <div style="background-color: #fff3cd; padding: 15px; border-radius: 5px; margin: 20px 0;">
            <p style="color: #856404; margin: 0;"><strong>Tips Keamanan:</strong></p>
            <ul style="color: #856404; margin: 10px 0 0 0;">
              <li>Jangan bagikan kredensial login Anda</li>
              <li>Gunakan password yang kuat dan unik</li>
              <li>Selalu logout setelah menggunakan perangkat bersama</li>
            </ul>
          </div>
          
          <p style="color: #555;">Jika Anda memiliki pertanyaan atau mengalami kendala, silakan hubungi tim support kami.</p>
          
          <p style="color: #555;">Selamat menggunakan SAPA Tazkia!</p>
          
          <p style="color: #555;">Salam,<br><strong>Tim SAPA Tazkia</strong></p>
        </div>
        <div style="background-color: #f8f9fa; padding: 20px; text-align: center; color: #6c757d;">
          <p style="margin: 0; font-size: 14px;">© ${new Date().getFullYear()} SAPA Tazkia. All rights reserved.</p>
        </div>
      </div>
    `;

    const result = await sendEmail(to, subject, html);
    
    console.log('✅ [EMAIL SERVICE] Welcome email sent successfully to:', to);
    
    return result;

  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Error sending welcome email:', error);
    throw error;
  }
};

/**
 * Test koneksi email service
 */
const testEmailConnection = async () => {
  try {
    console.log('🔧 [EMAIL SERVICE] Testing email connection...');
    
    const transporter = createTransporter();
    
    // Verify connection configuration
    await transporter.verify();
    
    console.log('✅ [EMAIL SERVICE] Email connection test successful');
    
    return {
      success: true,
      message: 'Email service is configured correctly'
    };
    
  } catch (error) {
    console.error('❌ [EMAIL SERVICE] Email connection test failed:', error);
    
    return {
      success: false,
      error: 'Email service configuration error',
      details: error.message
    };
  }
};

module.exports = {
  sendEmail,
  sendVerificationEmail,
  sendWelcomeEmail,
  testEmailConnection,
  generateVerificationEmailHTML,
  generateVerificationEmailText
};