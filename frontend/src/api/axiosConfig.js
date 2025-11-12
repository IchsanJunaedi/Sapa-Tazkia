import axios from 'axios';

// BUAT INSTANCE AXIOS
const api = axios.create({
  // URL backend - pastikan sesuai dengan server.js Anda
  // ================== PERBAIKAN DI SINI ==================
  // baseURL Anda sebelumnya adalah '.../api', 
  // tapi di ChatPage.jsx Anda memanggil '/api/chat', 
  // sehingga menjadi '.../api/api/chat' (ini menyebabkan 404).
  // Dengan mengubahnya ke '...:5000', panggilan '/api/chat' akan menjadi benar.
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  // =======================================================

  // Tambahkan timeout untuk menghindari request hanging
  timeout: 30000,
  // Untuk mengirim cookies jika diperlukan
  withCredentials: false
});

/*
  INTERCEPTOR REQUEST
  Otomatis menambahkan Token ke setiap request
*/
api.interceptors.request.use(
  (config) => {
    const token = localStorage.getItem('token');
    
    console.log('🔍 [AXIOS REQUEST]', {
      url: config.url,
      method: config.method,
      hasToken: !!token,
      tokenPreview: token ? token.substring(0, 20) + '...' : 'No token'
    });

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }
    
    // Tambahkan headers umum
    config.headers['Content-Type'] = 'application/json';
    
    return config;
  },
  (error) => {
    console.error('❌ [AXIOS REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

/*
  INTERCEPTOR RESPONSE
  Handle response dan error secara global - DIPERBAIKI UNTUK DEBUGGING
*/
api.interceptors.response.use(
  (response) => {
    console.log('✅ [AXIOS RESPONSE SUCCESS]', {
      url: response.config.url,
      status: response.status,
      data: response.data // ⬅️ TAMBAHKAN INI UNTUK DEBUG
    });
    return response;
  },
  (error) => {
    // ⬇️ PERBAIKAN BESAR: TAMPILKAN ERROR DETAIL DARI BACKEND
    console.error('❌ [AXIOS RESPONSE ERROR DETAIL]', {
      url: error.config?.url,
      status: error.response?.status,
      message: error.message,
      responseData: error.response?.data, // ⬅️ INI YANG PENTING!
      requestData: error.config?.data
    });

    // Handle error berdasarkan status code
    if (error.response) {
      const { status } = error.response;
      
      // Unauthorized - redirect ke login
      if (status === 401) {
        console.log('🛑 [AXIOS] 401 Unauthorized - Clearing auth data');
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        
        // Redirect ke login page jika bukan di login page already
        if (!window.location.pathname.includes('/login')) {
          window.location.href = '/login';
        }
      }
      
      // Bad Request - tampilkan error message dari backend
      else if (status === 400) {
        // Gunakan data dari responseData yang sudah di-log di atas
        const errorMessage = error.response?.data?.message || 'Validation error';
        console.log(`🚫 [AXIOS] 400 Bad Request - ${errorMessage}`);
      }
      
      // Forbidden - akses ditolak
      else if (status === 403) {
        console.log('🚫 [AXIOS] 403 Forbidden - Access denied');
      }
      
      // Server error
      else if (status >= 500) {
        console.log('💥 [AXIOS] Server error - Please try again later');
      }
    } else if (error.request) {
      // Network error - tidak dapat terhubung ke server
      console.log('🌐 [AXIOS] Network error - Cannot connect to server');
    } else {
      // Other errors
      console.log('⚠️ [AXIOS] Unknown error:', error.message);
    }

    return Promise.reject(error);
  }
);

// Fungsi helper untuk test koneksi
export const testConnection = async () => {
  try {
    await api.get('/health');
    console.log('✅ [CONNECTION TEST] Backend is reachable');
    return true;
  } catch (error) {
    console.error('❌ [CONNECTION TEST] Cannot reach backend:', error.message);
    return false;
  }
};

export default api;