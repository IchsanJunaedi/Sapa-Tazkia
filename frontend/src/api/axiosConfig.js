import axios from 'axios';

// BUAT INSTANCE AXIOS
const api = axios.create({
  baseURL: process.env.REACT_APP_API_URL || 'http://localhost:5000',
  timeout: 30000,
  withCredentials: true
});

/*
  INTERCEPTOR REQUEST - DIPERBAIKI
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

    // ✅ PERBAIKAN: Hanya set header jika token ada
    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    // ✅ PERBAIKAN: Jangan timpa Content-Type jika sudah ada (untuk FormData dll)
    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => {
    console.error('❌ [AXIOS REQUEST ERROR]', error);
    return Promise.reject(error);
  }
);

/*
  INTERCEPTOR RESPONSE - DIPERBAIKI
*/
api.interceptors.response.use(
  (response) => {
    console.log('✅ [AXIOS RESPONSE SUCCESS]', {
      url: response.config.url,
      status: response.status,
      data: response.data
    });
    return response;
  },
  (error) => {
    // ✅ PERBAIKAN: Handle error lebih spesifik
    const originalRequest = error.config;

    console.error('❌ [AXIOS RESPONSE ERROR DETAIL]', {
      url: originalRequest?.url,
      status: error.response?.status,
      message: error.message,
      responseData: error.response?.data,
      requestData: originalRequest?.data
    });

    // Handle error berdasarkan status code
    if (error.response) {
      const { status, data } = error.response;

      // Unauthorized - token invalid/expired
      if (status === 401) {
        console.log('🛑 [AXIOS] 401 Unauthorized - Clearing auth data');
        localStorage.removeItem('token');
        localStorage.removeItem('user');

        // ✅ PERBAIKAN: Dispatch event untuk notify AuthContext
        window.dispatchEvent(new Event('authTokenExpired'));

        // Redirect ke home page jika bukan di landing page
        if (!window.location.pathname.includes('/')) {
          setTimeout(() => {
            window.location.href = '/';
          }, 1000);
        }
      }

      // Not Found - endpoint tidak ada
      else if (status === 404) {
        console.log('🔍 [AXIOS] 404 Not Found - Endpoint tidak ada:', originalRequest?.url);
      }

      // Bad Request - validation error
      else if (status === 400) {
        console.log(`🚫 [AXIOS] 400 Bad Request - ${data?.message || 'Validation error'}`);
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

      // ✅ PERBAIKAN: Tampilkan notifikasi ke user
      if (window.showNotification) {
        window.showNotification('Tidak dapat terhubung ke server', 'error');
      }
    } else {
      // Other errors
      console.log('⚠️ [AXIOS] Unknown error:', error.message);
    }

    return Promise.reject(error);
  }
);

// ✅ PERBAIKAN: Tambahkan fungsi untuk clear auth headers
export const clearAuthHeaders = () => {
  delete api.defaults.headers.common['Authorization'];
};

// ✅ PERBAIKAN: Tambahkan fungsi untuk set auth headers manual
export const setAuthHeaders = (token) => {
  if (token) {
    api.defaults.headers.common['Authorization'] = `Bearer ${token}`;
  } else {
    clearAuthHeaders();
  }
};

// Fungsi helper untuk test koneksi
export const testConnection = async () => {
  try {
    const response = await api.get('/health');
    console.log('✅ [CONNECTION TEST] Backend is reachable:', response.data);
    return true;
  } catch (error) {
    console.error('❌ [CONNECTION TEST] Cannot reach backend:', error.message);
    return false;
  }
};

// ✅ PERBAIKAN: Test connection saat load (optional)
// testConnection();

export default api;