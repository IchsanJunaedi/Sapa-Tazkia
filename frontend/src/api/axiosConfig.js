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

    if (token) {
      config.headers['Authorization'] = `Bearer ${token}`;
    }

    if (!config.headers['Content-Type']) {
      config.headers['Content-Type'] = 'application/json';
    }

    return config;
  },
  (error) => Promise.reject(error)
);

/*
  INTERCEPTOR RESPONSE - DIPERBAIKI
*/
api.interceptors.response.use(
  (response) => response,
  (error) => {
    const { status } = error.response || {};

    if (status === 401) {
      localStorage.removeItem('token');
      localStorage.removeItem('user');
      window.dispatchEvent(new Event('authTokenExpired'));

      if (!window.location.pathname.includes('/')) {
        setTimeout(() => { window.location.href = '/'; }, 1000);
      }
    } else if (!error.response && error.request) {
      if (window.showNotification) {
        window.showNotification('Tidak dapat terhubung ke server', 'error');
      }
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

export const testConnection = async () => {
  try {
    await api.get('/health');
    return true;
  } catch {
    return false;
  }
};

// ✅ PERBAIKAN: Test connection saat load (optional)
// testConnection();

export default api;