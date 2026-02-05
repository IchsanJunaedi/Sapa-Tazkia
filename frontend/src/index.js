import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import App from './App';
import reportWebVitals from './reportWebVitals';

// ============================================================
// 🔇 PRODUCTION CONSOLE SILENCER
// Mematikan semua console.log di production untuk keamanan
// Untuk debug di production: localStorage.setItem('debug', 'true')
// ============================================================
if (process.env.NODE_ENV === 'production') {
  const isDebugEnabled = localStorage.getItem('debug') === 'true';

  if (!isDebugEnabled) {
    // Simpan referensi asli (untuk debugging jika diperlukan)
    window.__console = {
      log: console.log,
      info: console.info,
      debug: console.debug,
      dir: console.dir,
      table: console.table,
      group: console.group,
      groupEnd: console.groupEnd,
    };

    // Override console methods - silent di production
    console.log = () => { };
    console.info = () => { };
    console.debug = () => { };
    console.dir = () => { };
    console.table = () => { };
    console.group = () => { };
    console.groupEnd = () => { };

    // console.warn dan console.error TETAP AKTIF (penting untuk monitoring)
  }
}

const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();
