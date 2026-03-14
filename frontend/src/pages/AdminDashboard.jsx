import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    MessageSquare,
    Settings,
    LogOut,
    User,
    ShieldCheck,
    Search,
    TrendingUp,
    Users,
    Zap,
    DollarSign
} from 'lucide-react';
import {
    BarChart,
    Bar,
    XAxis,
    YAxis,
    Tooltip,
    ResponsiveContainer,
    PieChart,
    Pie,
    Cell,
    AreaChart,
    Area
} from 'recharts';

const API = process.env.REACT_APP_API_URL || 'http://localhost:5000';

// ─── Shared sub-components ───────────────────────────────────────────────────

const DeltaBadge = ({ delta }) => {
    if (delta === null || delta === undefined) return <span className="text-xs text-[#71717a]">-</span>;
    const positive = delta >= 0;
    return (
        <span className={`text-xs font-medium px-1.5 py-0.5 rounded ${positive ? 'bg-green-500/15 text-green-400' : 'bg-red-500/15 text-red-400'}`}>
            {positive ? '↑' : '↓'} {Math.abs(delta)}%
        </span>
    );
};

// Heatmap cell — extracted to module scope so it has a stable reference across renders
const HeatCell = ({ hour, count, opacity }) => {
    const [hovered, setHovered] = useState(false);
    return (
        <div className="relative group">
            <div
                className="w-7 h-7 rounded cursor-default transition-opacity"
                style={{ background: `rgba(168, 85, 247, ${opacity})` }}
                onMouseEnter={() => setHovered(true)}
                onMouseLeave={() => setHovered(false)}
            />
            {hovered && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-1 px-2 py-1 rounded bg-[#18181b] border border-[#27272a] text-[10px] text-[#e4e4e7] whitespace-nowrap z-10 pointer-events-none">
                    {String(hour).padStart(2, '0')}:00 — {count}
                </div>
            )}
        </div>
    );
};

// ─── Analytics View ──────────────────────────────────────────────────────────

const AnalyticsView = () => {
    const [realtime, setRealtime] = useState(null);
    const [history, setHistory] = useState(null);
    const [historyRange, setHistoryRange] = useState('7d');
    const [realtimeError, setRealtimeError] = useState('');
    const [historyError, setHistoryError] = useState('');
    const [historyLoading, setHistoryLoading] = useState(true);

    const fetchRealtime = async () => {
        try {
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/api/admin/analytics/realtime`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setRealtime(res.data.realtime);
            setRealtimeError('');
        } catch (err) {
            setRealtimeError(err.response?.data?.message || 'Failed to load realtime data');
        }
    };

    const fetchHistory = async (range) => {
        try {
            setHistoryLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/api/admin/analytics/history?range=${range}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setHistory(res.data);
            setHistoryError('');
        } catch (err) {
            setHistoryError(err.response?.data?.message || 'Failed to load history data');
        } finally {
            setHistoryLoading(false);
        }
    };

    useEffect(() => {
        fetchHistory(historyRange);
    }, [historyRange]);

    useEffect(() => {
        fetchRealtime();
        const interval = setInterval(fetchRealtime, 30000);
        return () => clearInterval(interval);
    }, []);

    // ── Derived data ────────────────────────────────────────────────────────
    const tokensUsed = realtime?.tokensUsed ?? 0;
    const estCostUSD = (tokensUsed * 0.00000015).toFixed(4);
    const estCostIDR = Math.round(tokensUsed * 0.00000015 * 16000).toLocaleString('id-ID');

    const kpiCards = [
        {
            label: 'Chat Today',
            value: realtime ? (realtime.chatToday ?? 0) : null,
            delta: realtime?.delta?.chatToday ?? null,
            icon: <MessageSquare size={18} />,
            gradient: 'from-purple-500 to-pink-500',
        },
        {
            label: 'Active Users',
            value: realtime ? (realtime.activeUsers ?? 0) : null,
            delta: realtime?.delta?.activeUsers ?? null,
            icon: <Users size={18} />,
            gradient: 'from-cyan-400 to-blue-500',
        },
        {
            label: 'Tokens Used',
            value: realtime ? tokensUsed.toLocaleString() : null,
            delta: realtime?.delta?.tokensUsed ?? null,
            icon: <Zap size={18} />,
            gradient: 'from-amber-400 to-red-500',
        },
        {
            label: 'Est. Min. Cost',
            value: realtime ? `$${estCostUSD}` : null,
            sub: realtime ? `~Rp ${estCostIDR}` : null,
            hint: 'input token rate only',
            delta: null,
            icon: <DollarSign size={18} />,
            gradient: 'from-green-400 to-cyan-500',
        },
    ];

    const barData = history?.snapshots?.map((s) => ({
        date: new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short' }),
        chats: s.totalChats ?? 0,
    })) ?? [];

    const areaData = history?.snapshots?.map((s) => ({
        date: new Date(s.date).toLocaleDateString('id-ID', { weekday: 'short' }),
        tokens: s.totalTokens ?? 0,
    })) ?? [];

    const donutData = realtime
        ? [
              { name: 'Users', value: realtime.userChats ?? 0, fill: '#a855f7' },
              { name: 'Guests', value: realtime.guestChats ?? 0, fill: '#f59e0b' },
          ]
        : [];
    const donutTotal = donutData.reduce((acc, d) => acc + d.value, 0);

    const hourlyData = history?.hourlyData ?? {};
    const hourlyMax = Math.max(...Object.values(hourlyData).map(Number), 1);

    const topUsers = history?.topUsers ?? [];

    // ── Tooltip styles ────────────────────────────────────────────────────
    const tooltipStyle = {
        contentStyle: { background: '#18181b', border: '1px solid #27272a', borderRadius: '8px', color: '#e4e4e7', fontSize: '12px' },
        labelStyle: { color: '#a1a1aa' },
        cursor: { fill: 'rgba(168,85,247,0.08)' },
    };

    return (
        <div className="space-y-6">

            {/* Error banners */}
            {realtimeError && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    Realtime: {realtimeError}
                </div>
            )}

            {/* ── KPI Cards ─────────────────────────────────────────────── */}
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4">
                {kpiCards.map((card) => (
                    <div key={card.label} className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                        {/* Colored top border */}
                        <div className={`h-[2px] w-full bg-gradient-to-r ${card.gradient}`} />
                        <div className="p-5">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-[#a1a1aa] text-sm">{card.label}</span>
                                <span className="text-[#71717a]">{card.icon}</span>
                            </div>
                            <div className="flex items-end gap-3">
                                <span className="text-2xl font-bold text-[#e4e4e7]">
                                    {card.value !== null ? card.value : <span className="text-[#71717a]">-</span>}
                                </span>
                                <DeltaBadge delta={card.delta} />
                            </div>
                            {card.sub && (
                                <p className="text-xs text-[#71717a] mt-1">{card.sub}</p>
                            )}
                            {card.hint && (
                                <p className="text-[10px] text-[#71717a] mt-0.5 italic">{card.hint}</p>
                            )}
                        </div>
                    </div>
                ))}
            </div>

            {/* ── Chat Volume + User/Guest Donut ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">

                {/* Bar chart — 2/3 width */}
                <div className="lg:col-span-2 bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-[#e4e4e7]">Chat Volume</h3>
                        <div className="flex gap-1 bg-[#09090b] border border-[#27272a] rounded-lg p-0.5">
                            {['7d', '30d'].map((r) => (
                                <button
                                    key={r}
                                    onClick={() => setHistoryRange(r)}
                                    className={`px-3 py-1 text-xs rounded-md transition-all ${historyRange === r ? 'bg-[#27272a] text-[#e4e4e7]' : 'text-[#71717a] hover:text-[#a1a1aa]'}`}
                                >
                                    {r.toUpperCase()}
                                </button>
                            ))}
                        </div>
                    </div>
                    {historyLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-2 border-[#a855f7] border-t-transparent" />
                        </div>
                    ) : historyError ? (
                        <p className="text-red-400 text-sm text-center py-10">{historyError}</p>
                    ) : (
                        <ResponsiveContainer width="100%" height={180}>
                            <BarChart data={barData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                                <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                                <Tooltip {...tooltipStyle} />
                                <Bar dataKey="chats" fill="#a855f7" radius={[4, 4, 0, 0]} />
                            </BarChart>
                        </ResponsiveContainer>
                    )}
                </div>

                {/* Donut — 1/3 width */}
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">User vs Guest</h3>
                    {!realtime ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-2 border-[#a855f7] border-t-transparent" />
                        </div>
                    ) : (
                        <>
                            <ResponsiveContainer width="100%" height={140}>
                                <PieChart>
                                    <Pie
                                        data={donutData}
                                        cx="50%"
                                        cy="50%"
                                        innerRadius={50}
                                        outerRadius={70}
                                        dataKey="value"
                                        paddingAngle={2}
                                    >
                                        {donutData.map((entry, i) => (
                                            <Cell key={i} fill={entry.fill} />
                                        ))}
                                    </Pie>
                                    <Tooltip {...tooltipStyle} />
                                </PieChart>
                            </ResponsiveContainer>
                            <div className="flex justify-center gap-4 mt-2">
                                {donutData.map((d) => (
                                    <div key={d.name} className="flex items-center gap-1.5 text-xs text-[#a1a1aa]">
                                        <span className="w-2.5 h-2.5 rounded-full" style={{ background: d.fill }} />
                                        <span>{d.name}</span>
                                        <span className="text-[#e4e4e7] font-medium">{d.value}</span>
                                        <span className="text-[#71717a]">
                                            ({donutTotal > 0 ? Math.round((d.value / donutTotal) * 100) : 0}%)
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ── Token Usage Area Chart ────────────────────────────────── */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">Token Usage</h3>
                {historyLoading ? (
                    <div className="h-40 flex items-center justify-center">
                        <div className="animate-spin w-6 h-6 rounded-full border-2 border-cyan-500 border-t-transparent" />
                    </div>
                ) : historyError ? (
                    <p className="text-red-400 text-sm text-center py-10">{historyError}</p>
                ) : (
                    <ResponsiveContainer width="100%" height={180}>
                        <AreaChart data={areaData} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                            <XAxis dataKey="date" tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <YAxis tick={{ fill: '#71717a', fontSize: 11 }} axisLine={false} tickLine={false} />
                            <Tooltip {...tooltipStyle} />
                            <Area
                                type="monotone"
                                dataKey="tokens"
                                stroke="#06b6d4"
                                fill="#06b6d4"
                                fillOpacity={0.15}
                                strokeWidth={2}
                            />
                        </AreaChart>
                    </ResponsiveContainer>
                )}
            </div>

            {/* ── Peak Hours Heatmap + Top Users ────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">

                {/* Heatmap */}
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">Peak Hours</h3>
                    {historyLoading ? (
                        <div className="h-20 flex items-center justify-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-2 border-[#a855f7] border-t-transparent" />
                        </div>
                    ) : historyError ? (
                        <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs">{historyError}</div>
                    ) : (
                        <>
                            <div className="flex gap-1 flex-wrap">
                                {Array.from({ length: 24 }, (_, h) => {
                                    const count = Number(hourlyData[String(h)] ?? 0);
                                    const opacity = hourlyMax > 0 ? 0.1 + (count / hourlyMax) * 0.9 : 0.1;
                                    return (
                                        <HeatCell key={h} hour={h} count={count} opacity={opacity} />
                                    );
                                })}
                            </div>
                            <div className="flex justify-between mt-1 px-0.5">
                                {['00', '06', '12', '18', '24'].map((lbl) => (
                                    <span key={lbl} className="text-[10px] text-[#71717a]">{lbl}</span>
                                ))}
                            </div>
                        </>
                    )}
                </div>

                {/* Top Users */}
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">Top 10 Users</h3>
                    {historyLoading ? (
                        <div className="h-40 flex items-center justify-center">
                            <div className="animate-spin w-6 h-6 rounded-full border-2 border-[#a855f7] border-t-transparent" />
                        </div>
                    ) : topUsers.length === 0 ? (
                        <p className="text-[#71717a] text-sm text-center py-8">No data</p>
                    ) : (
                        <div className="overflow-x-auto">
                            <table className="w-full text-sm">
                                <thead>
                                    <tr className="text-[#71717a] text-xs uppercase tracking-wider border-b border-[#27272a]">
                                        <th className="pb-2 pr-3 text-left font-medium">Rank</th>
                                        <th className="pb-2 pr-3 text-left font-medium">Name / Email</th>
                                        <th className="pb-2 pr-3 text-right font-medium">Chats</th>
                                        <th className="pb-2 text-right font-medium">Tokens</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {topUsers.map((u, i) => (
                                        <tr
                                            key={u.rank ?? i}
                                            className={`${i % 2 === 0 ? 'bg-[#18181b]' : 'bg-transparent'} hover:bg-[#27272a]/40 transition-colors`}
                                        >
                                            <td className="py-2 pr-3">
                                                {u.rank === 1 ? (
                                                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-purple-500/20 text-purple-400 text-xs font-bold">1</span>
                                                ) : (
                                                    <span className="text-[#71717a] pl-1.5">{u.rank ?? i + 1}</span>
                                                )}
                                            </td>
                                            <td className="py-2 pr-3">
                                                <p className="text-[#e4e4e7] font-medium truncate max-w-[130px]">{u.name || '-'}</p>
                                                <p className="text-[10px] text-[#71717a] truncate max-w-[130px]">{u.email || ''}</p>
                                            </td>
                                            <td className="py-2 pr-3 text-right text-[#a1a1aa]">{(u.chats ?? 0).toLocaleString()}</td>
                                            <td className="py-2 text-right text-[#a1a1aa]">{(u.tokens ?? 0).toLocaleString()}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
};

// ─── Main AdminDashboard ──────────────────────────────────────────────────────

const AdminDashboard = () => {
    const [activeTab, setActiveTab] = useState('analytics');
    const [logs, setLogs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [filterType, setFilterType] = useState('All');

    useEffect(() => {
        if (activeTab !== 'logs') return;
        fetchLogs();
        const interval = setInterval(() => {
            fetchLogs(false);
        }, 10000);
        return () => clearInterval(interval);
    }, [activeTab]);

    const fetchLogs = async (showLoading = true) => {
        try {
            if (showLoading) setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/api/admin/chat-logs`, {
                withCredentials: true,
                headers: { Authorization: `Bearer ${token}` }
            });
            if (res.data.success) {
                setLogs(res.data.logs);
            } else {
                if (showLoading) setError(res.data.message || 'Gagal memuat log');
            }
        } catch (err) {
            if (showLoading) setError(err.response?.data?.message || 'Terjadi kesalahan jaringan');
        } finally {
            if (showLoading) setLoading(false);
        }
    };

    const handleLogout = async () => {
        try {
            await axios.post(`${API}/api/auth/logout`, {}, { withCredentials: true });
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/admin/login';
        } catch (err) {
            console.error('Logout failed:', err);
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            window.location.href = '/admin/login';
        }
    };

    const filteredLogs = logs.filter((log) => {
        const matchesSearch =
            log.message?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            log.identifier?.toLowerCase().includes(searchTerm.toLowerCase());
        const matchesType = filterType === 'All' ? true : log.userType === filterType;
        return matchesSearch && matchesType;
    });

    const navItems = [
        { id: 'analytics', label: 'Analytics', icon: <LayoutDashboard size={18} /> },
        { id: 'logs', label: 'Chat Logs', icon: <MessageSquare size={18} /> },
    ];

    return (
        <div className="flex h-screen bg-[#09090b] text-[#e4e4e7] font-sans">
            {/* Sidebar */}
            <aside className="w-64 bg-[#18181b] border-r border-[#27272a] flex flex-col justify-between hidden md:flex">
                <div>
                    <div className="p-6 border-b border-[#27272a] flex items-center gap-3">
                        <div className="w-8 h-8 rounded bg-purple-600 flex items-center justify-center">
                            <ShieldCheck size={20} className="text-white" />
                        </div>
                        <h1 className="text-xl font-bold text-[#e4e4e7] tracking-tight">Sapa Admin</h1>
                    </div>
                    <nav className="p-4 space-y-1">
                        {navItems.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setActiveTab(item.id)}
                                className={`w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium transition-colors ${
                                    activeTab === item.id
                                        ? 'bg-purple-600/15 text-purple-400'
                                        : 'text-[#a1a1aa] hover:bg-[#27272a] hover:text-[#e4e4e7]'
                                }`}
                            >
                                {item.icon}
                                {item.label}
                            </button>
                        ))}
                        <button
                            disabled
                            className="w-full flex items-center gap-3 px-4 py-3 rounded-lg text-sm font-medium text-[#71717a] opacity-40 cursor-not-allowed"
                        >
                            <Settings size={18} />
                            Settings
                        </button>
                    </nav>
                </div>
                <div className="p-4 border-t border-[#27272a]">
                    <button
                        onClick={handleLogout}
                        className="flex w-full items-center gap-3 px-4 py-2.5 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors text-sm"
                    >
                        <LogOut size={18} />
                        Sign Out
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 flex flex-col h-screen overflow-hidden">
                {/* Header */}
                <header className="h-16 border-b border-[#27272a] bg-[#18181b]/50 backdrop-blur flex items-center justify-between px-8 shrink-0">
                    <h2 className="text-base font-semibold text-[#e4e4e7]">
                        {activeTab === 'analytics' ? 'Analytics' : 'Live Chat Logs'}
                    </h2>
                    <div className="flex items-center gap-2 text-sm text-[#a1a1aa] bg-[#27272a] px-3 py-1.5 rounded-full">
                        <User size={14} />
                        <span>Admin Sapa Tazkia</span>
                    </div>
                </header>

                {/* Content Body */}
                <div className="flex-1 overflow-auto p-6">
                    <div className="max-w-7xl mx-auto">

                        {/* ── Analytics Tab ──────────────────────────────── */}
                        {activeTab === 'analytics' && <AnalyticsView />}

                        {/* ── Chat Logs Tab ──────────────────────────────── */}
                        {activeTab === 'logs' && (
                            <div className="space-y-6">
                                {/* Filters */}
                                <div className="flex flex-col sm:flex-row justify-between gap-4">
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search messages or identifiers..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-full sm:w-80 transition-all text-[#e4e4e7] placeholder-[#71717a]"
                                        />
                                    </div>
                                    <div className="flex items-center gap-2 bg-[#18181b] border border-[#27272a] rounded-lg p-1">
                                        {['All', 'User', 'Guest'].map((type) => (
                                            <button
                                                key={type}
                                                onClick={() => setFilterType(type)}
                                                className={`px-4 py-1.5 text-sm rounded-md transition-all ${filterType === type ? 'bg-[#27272a] text-[#e4e4e7] shadow-sm' : 'text-[#a1a1aa] hover:text-[#e4e4e7]'}`}
                                            >
                                                {type}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                {/* Table */}
                                {loading ? (
                                    <div className="h-64 flex items-center justify-center">
                                        <div className="animate-spin w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent" />
                                    </div>
                                ) : error ? (
                                    <div className="p-4 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                                        {error}
                                    </div>
                                ) : (
                                    <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden shadow-sm">
                                        <div className="overflow-x-auto">
                                            <table className="w-full text-left text-sm whitespace-nowrap">
                                                <thead className="bg-[#27272a]/40 text-[#71717a] border-b border-[#27272a] uppercase text-xs tracking-wider">
                                                    <tr>
                                                        <th className="px-6 py-4 font-medium">Pengirim</th>
                                                        <th className="px-6 py-4 font-medium">Waktu</th>
                                                        <th className="px-6 py-4 font-medium w-96 leading-relaxed">Pesan User</th>
                                                        <th className="px-6 py-4 font-medium w-96">Response Bot</th>
                                                        <th className="px-6 py-4 font-medium text-right">Tokens</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#27272a]/80">
                                                    {filteredLogs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={5} className="px-6 py-12 text-center text-[#71717a]">
                                                                Tidak ada log yang ditemukan.
                                                            </td>
                                                        </tr>
                                                    ) : (
                                                        filteredLogs.map((log) => (
                                                            <tr key={log.id} className="hover:bg-[#27272a]/30 transition-colors">
                                                                <td className="px-6 py-4">
                                                                    <div className="flex items-center gap-3">
                                                                        <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold ${log.userType === 'User' ? 'bg-purple-500/20 text-purple-400' : 'bg-amber-500/20 text-amber-400'}`}>
                                                                            {log.userType === 'User' ? 'U' : 'G'}
                                                                        </div>
                                                                        <div className="flex flex-col">
                                                                            <span className="font-medium text-[#e4e4e7]">{log.userType}</span>
                                                                            <span className="text-xs text-[#71717a] truncate max-w-[150px]">{log.identifier}</span>
                                                                        </div>
                                                                    </div>
                                                                </td>
                                                                <td className="px-6 py-4 text-[#a1a1aa]">
                                                                    {new Date(log.timestamp).toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit' })}
                                                                    <span className="block text-xs text-[#71717a]">{new Date(log.timestamp).toLocaleDateString('id-ID')}</span>
                                                                </td>
                                                                <td className="px-6 py-4 text-[#e4e4e7] font-medium whitespace-normal break-words leading-relaxed min-w-[250px]">
                                                                    {log.message}
                                                                </td>
                                                                <td className="px-6 py-4 text-[#a1a1aa] whitespace-normal break-words leading-relaxed min-w-[250px]">
                                                                    {log.response?.length > 100 ? `${log.response.substring(0, 100)}...` : log.response}
                                                                </td>
                                                                <td className="px-6 py-4 text-right">
                                                                    <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-md bg-[#27272a] text-[#a1a1aa] text-xs font-mono">
                                                                        {log.tokens || 'N/A'}
                                                                    </span>
                                                                </td>
                                                            </tr>
                                                        ))
                                                    )}
                                                </tbody>
                                            </table>
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}

                    </div>
                </div>
            </main>
        </div>
    );
};

export default AdminDashboard;
