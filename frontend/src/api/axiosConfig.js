import axios from 'axios';

// BUAT INSTANCE AXIOS
const api = axios.create({
  // PENTING: URL ini sudah sesuai dengan server.js Anda
  // (http://localhost:5000 + /api)
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000/api' 
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