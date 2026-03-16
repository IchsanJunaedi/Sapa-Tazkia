import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { ShieldCheck, Eye, EyeOff, LogIn, KeyRound } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

const AdminLogin = () => {
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [totpCode, setTotpCode] = useState('');
    const [tempToken, setTempToken] = useState('');
    const [step, setStep] = useState('credentials'); // 'credentials' | 'totp'
    const [error, setError] = useState('');
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();
    const { login } = useAuth();

    useEffect(() => {
        const storedUser = localStorage.getItem('user');
        if (storedUser) {
            try {
                const userData = JSON.parse(storedUser);
                if (userData.userType === 'admin') {
                    navigate('/admin/dashboard', { replace: true });
                }
            } catch (e) { }
        }
    }, [navigate]);

    const handleCredentials = async (e) => {
        e.preventDefault();
        if (!email || !password) { setError('Email dan password harus diisi'); return; }
        setLoading(true);
        setError('');

        try {
            const res = await axios.post(
                `${API}/auth/login`,
                { identifier: email, password },
                { withCredentials: true }
            );

            if (res.data.success) {
                if (res.data.requiresTwoFactor) {
                    setTempToken(res.data.tempToken);
                    setStep('totp');
                    return;
                }

                const { token, user } = res.data;
                if (user.userType !== 'admin') {
                    setError('Akses ditolak. Hanya akun admin yang dapat masuk ke sini.');
                    return;
                }
                await login(token, user);
                navigate('/admin/dashboard', { replace: true });
            } else {
                setError(res.data.message || 'Login gagal');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Terjadi kesalahan. Periksa koneksi atau kredensial Anda.');
        } finally {
            setLoading(false);
        }
    };

    const handleTotp = async (e) => {
        e.preventDefault();
        if (!totpCode || totpCode.length !== 6) { setError('Masukkan kode 6 digit dari aplikasi authenticator'); return; }
        setLoading(true);
        setError('');

        try {
            const res = await axios.post(
                `${API}/auth/admin/2fa/verify`,
                { tempToken, totpCode },
                { withCredentials: true }
            );

            if (res.data.success) {
                const { token, user } = res.data;
                await login(token, user);
                navigate('/admin/dashboard', { replace: true });
            } else {
                setError(res.data.message || 'Kode 2FA tidak valid');
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Kode 2FA tidak valid atau sudah expired');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#0F172A] flex items-center justify-center px-4">
            <div className="w-full max-w-sm">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 rounded-2xl bg-blue-600 flex items-center justify-center mx-auto mb-4 shadow-xl shadow-blue-600/20">
                        {step === 'totp' ? <KeyRound size={36} className="text-white" /> : <ShieldCheck size={36} className="text-white" />}
                    </div>
                    <h1 className="text-2xl font-bold text-white tracking-tight">Sapa Admin</h1>
                    <p className="text-slate-400 text-sm mt-1">
                        {step === 'totp' ? 'Verifikasi 2 Langkah' : 'Dashboard Management'}
                    </p>
                </div>

                <form
                    onSubmit={step === 'credentials' ? handleCredentials : handleTotp}
                    className="bg-[#1E293B] rounded-2xl border border-slate-800 p-8 shadow-2xl space-y-5"
                >
                    {error && (
                        <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                            {error}
                        </div>
                    )}

                    {step === 'credentials' ? (
                        <>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">Email Admin</label>
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="sapa@stmik.tazkia.ac.id"
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    disabled={loading}
                                    autoComplete="username"
                                    required
                                />
                            </div>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">Password</label>
                                <div className="relative">
                                    <input
                                        type={showPassword ? 'text' : 'password'}
                                        value={password}
                                        onChange={(e) => setPassword(e.target.value)}
                                        placeholder="••••••••"
                                        className="w-full px-4 py-2.5 pr-10 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                        disabled={loading}
                                        autoComplete="current-password"
                                        required
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setShowPassword(!showPassword)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                                    >
                                        {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                                    </button>
                                </div>
                            </div>
                        </>
                    ) : (
                        <div className="space-y-3">
                            <p className="text-slate-400 text-sm text-center">
                                Buka aplikasi Google Authenticator dan masukkan kode 6 digit untuk <span className="text-slate-200 font-medium">Sapa Tazkia Admin</span>.
                            </p>
                            <div className="space-y-1.5">
                                <label className="block text-sm font-medium text-slate-300">Kode Authenticator</label>
                                <input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="[0-9]{6}"
                                    maxLength={6}
                                    value={totpCode}
                                    onChange={(e) => setTotpCode(e.target.value.replace(/\D/g, ''))}
                                    placeholder="123456"
                                    className="w-full px-4 py-2.5 rounded-lg bg-slate-800 border border-slate-700 text-slate-200 placeholder-slate-500 text-sm text-center tracking-widest text-lg focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                                    disabled={loading}
                                    autoFocus
                                    required
                                />
                            </div>
                            <button
                                type="button"
                                onClick={() => { setStep('credentials'); setError(''); setTotpCode(''); }}
                                className="w-full text-center text-xs text-slate-500 hover:text-slate-300 transition-colors"
                            >
                                Kembali ke login
                            </button>
                        </div>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full flex items-center justify-center gap-2 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed text-white font-medium rounded-lg text-sm transition-all shadow-lg shadow-blue-600/30 mt-2"
                    >
                        {loading ? (
                            <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                        ) : step === 'totp' ? (
                            <>
                                <KeyRound size={16} />
                                Verifikasi
                            </>
                        ) : (
                            <>
                                <LogIn size={16} />
                                Masuk ke Dashboard
                            </>
                        )}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-600 mt-6">
                    Sapa Tazkia Admin © {new Date().getFullYear()}
                </p>
            </div>
        </div>
    );
};

export default AdminLogin;
