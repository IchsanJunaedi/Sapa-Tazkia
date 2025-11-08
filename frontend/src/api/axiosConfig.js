import axios from 'axios';

// BUAT INSTANCE AXIOS
const api = axios.create({
  // PENTING: Ganti URL ini dengan alamat backend Anda!
  // Jika backend Anda berjalan di port 5000, mungkin seperti ini:
  baseURL: 'http://localhost:5000/api' 
  // Pastikan backend Anda memiliki endpoint seperti /api/auth/login
});

/*
  INTERCEPTOR (Opsional tapi sangat bagus)
  Ini akan otomatis menambahkan Token (jika ada) ke setiap request
  yang Anda buat menggunakan 'api'
*/
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);

export default api;