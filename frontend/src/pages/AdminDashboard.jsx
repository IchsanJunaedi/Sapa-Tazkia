import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import {
    LayoutDashboard,
    MessageSquare,
    Settings,
    LogOut,
    User,
    ShieldCheck,
    Search,
    Users,
    Zap,
    DollarSign,
    Clock,
    AlertTriangle,
    BookOpen,
    Plus,
    Trash2,
    HelpCircle,
    Bug,
    RefreshCw,
    X,
    Upload
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

// REACT_APP_API_URL already includes /api (e.g. http://localhost:5000/api) — do NOT add /api in paths below
const API = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

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
            const res = await axios.get(`${API}/admin/analytics/realtime`, {
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
            const res = await axios.get(`${API}/admin/analytics/history?range=${range}`, {
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
    // GPT-4o-mini input-only pricing: $0.15 per 1M tokens = $0.00000015 per token
    // NOTE: tokenUsage includes both input+output tokens. Output costs $0.60/M (4x higher).
    // This formula gives a LOWER BOUND — real cost will be higher. UI label: "Est. Min. Cost"
    const COST_PER_TOKEN = 0.00000015;
    const estCostUSD = (tokensUsed * COST_PER_TOKEN).toFixed(4);
    const estCostIDR = Math.round(tokensUsed * COST_PER_TOKEN * 16000).toLocaleString('id-ID');

    const avgMs = realtime?.avgResponseTime;
    const avgMsDisplay = avgMs != null ? `${Math.round(avgMs)}ms` : null;

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
        {
            label: 'Avg Response Time',
            value: realtime ? (avgMsDisplay ?? '—') : null,
            delta: null,
            icon: <Clock size={18} />,
            gradient: 'from-sky-400 to-indigo-500',
        },
        {
            label: 'Error Count',
            value: realtime ? (realtime.errorCount ?? 0) : null,
            delta: realtime?.delta?.errorCount ?? null,
            icon: <AlertTriangle size={18} />,
            gradient: 'from-rose-500 to-red-600',
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
    const topQuestions = Array.isArray(history?.topQuestions) ? history.topQuestions : [];

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

            {/* ── KPI Cards (6) ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 xl:grid-cols-3 gap-4">
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

            {/* ── Top Questions (last 7 days) ─────────────────────────────── */}
            {!historyLoading && (
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl p-5">
                    <div className="flex items-center gap-2 mb-4">
                        <HelpCircle size={16} className="text-[#a855f7]" />
                        <h3 className="text-sm font-semibold text-[#e4e4e7]">Most Asked Questions</h3>
                        <span className="ml-auto text-[10px] text-[#71717a] italic">last 7 days</span>
                    </div>
                    {topQuestions.length === 0 ? (
                        <p className="text-[#71717a] text-sm text-center py-4">No data yet</p>
                    ) : (
                        <div className="space-y-2">
                            {topQuestions.map((q, i) => {
                                const maxCount = topQuestions[0]?.count ?? 1;
                                const pct = Math.round((q.count / maxCount) * 100);
                                return (
                                    <div key={i} className="flex items-center gap-3">
                                        <span className="text-xs text-[#71717a] w-4 text-right shrink-0">{i + 1}</span>
                                        <div className="flex-1 min-w-0">
                                            <div className="flex items-center justify-between mb-0.5">
                                                <p className="text-xs text-[#e4e4e7] truncate max-w-[85%]">{q.question}</p>
                                                <span className="text-[10px] text-[#a1a1aa] shrink-0 ml-2">{q.count}×</span>
                                            </div>
                                            <div className="h-1 rounded-full bg-[#27272a] overflow-hidden">
                                                <div
                                                    className="h-full rounded-full bg-gradient-to-r from-purple-500 to-pink-500"
                                                    style={{ width: `${pct}%` }}
                                                />
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>
                    )}
                </div>
            )}
        </div>
    );
};

// ─── Knowledge Base View ─────────────────────────────────────────────────────

const KnowledgeBaseView = () => {
    const [docs, setDocs] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [formData, setFormData] = useState({ content: '', source: '', category: '' });
    const [formError, setFormError] = useState('');
    const [deleteId, setDeleteId] = useState(null);
    const [showPdfForm, setShowPdfForm] = useState(false);
    const [pdfFile, setPdfFile] = useState(null);
    const [pdfCategory, setPdfCategory] = useState('');
    const [pdfSubmitting, setPdfSubmitting] = useState(false);
    const [pdfError, setPdfError] = useState('');
    const [pdfSuccess, setPdfSuccess] = useState('');

    const fetchDocs = useCallback(async () => {
        try {
            setLoading(true);
            const token = localStorage.getItem('token');
            const res = await axios.get(`${API}/admin/knowledge-base`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocs(res.data.documents ?? []);
            setError('');
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to load knowledge base');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => { fetchDocs(); }, [fetchDocs]);

    const handleAdd = async (e) => {
        e.preventDefault();
        if (!formData.content.trim() || formData.content.trim().length < 10) {
            setFormError('Content must be at least 10 characters');
            return;
        }
        try {
            setSubmitting(true);
            setFormError('');
            const token = localStorage.getItem('token');
            await axios.post(`${API}/admin/knowledge-base`, formData, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setFormData({ content: '', source: '', category: '' });
            setShowForm(false);
            await fetchDocs();
        } catch (err) {
            setFormError(err.response?.data?.message || 'Failed to add document');
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (id) => {
        try {
            setDeleteId(id);
            const token = localStorage.getItem('token');
            await axios.delete(`${API}/admin/knowledge-base/${id}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            setDocs((prev) => prev.filter((d) => d.id !== id));
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to delete document');
        } finally {
            setDeleteId(null);
        }
    };

    const handleUploadPdf = async (e) => {
        e.preventDefault();
        if (!pdfFile) { setPdfError('Please select a PDF file.'); return; }
        if (pdfFile.type !== 'application/pdf') { setPdfError('Only PDF files are allowed.'); return; }
        if (pdfFile.size > 10 * 1024 * 1024) { setPdfError('File too large. Maximum size is 10MB.'); return; }

        try {
            setPdfSubmitting(true);
            setPdfError('');
            setPdfSuccess('');
            const token = localStorage.getItem('token');
            const form = new FormData();
            form.append('file', pdfFile);
            if (pdfCategory.trim()) form.append('category', pdfCategory.trim());

            const res = await axios.post(`${API}/admin/knowledge-base/upload-pdf`, form, {
                headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'multipart/form-data' }
            });

            setPdfSuccess(`✓ ${res.data.fileName} — ${res.data.chunksAdded} chunks embedded`);
            setPdfFile(null);
            setPdfCategory('');
            setShowPdfForm(false);
            await fetchDocs();
        } catch (err) {
            setPdfError(err.response?.data?.message || 'Failed to upload PDF.');
        } finally {
            setPdfSubmitting(false);
        }
    };

    return (
        <div className="space-y-6">
            {/* Header row */}
            <div className="flex items-center justify-between">
                <div>
                    <p className="text-[#71717a] text-sm mt-0.5">{docs.length} document{docs.length !== 1 ? 's' : ''} in Qdrant</p>
                </div>
                <div className="flex gap-2">
                    <button
                        onClick={fetchDocs}
                        className="flex items-center gap-2 px-3 py-2 text-sm rounded-lg bg-[#18181b] border border-[#27272a] text-[#a1a1aa] hover:text-[#e4e4e7] hover:border-[#3f3f46] transition-all"
                    >
                        <RefreshCw size={14} className={loading ? 'animate-spin' : ''} />
                        Refresh
                    </button>
                    <button
                        onClick={() => { setShowForm(!showForm); setShowPdfForm(false); setFormError(''); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 transition-all"
                    >
                        {showForm ? <X size={14} /> : <Plus size={14} />}
                        {showForm ? 'Cancel' : 'Add Document'}
                    </button>
                    <button
                        onClick={() => { setShowPdfForm(!showPdfForm); setShowForm(false); setPdfError(''); setPdfSuccess(''); }}
                        className="flex items-center gap-2 px-4 py-2 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 transition-all"
                    >
                        {showPdfForm ? <X size={14} /> : <Upload size={14} />}
                        {showPdfForm ? 'Cancel' : 'Upload PDF'}
                    </button>
                </div>
            </div>

            {/* Add Document form */}
            {showForm && (
                <div className="bg-[#18181b] border border-purple-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-4">New Document</h3>
                    <form onSubmit={handleAdd} className="space-y-4">
                        <div>
                            <label className="block text-xs text-[#a1a1aa] mb-1.5">Content <span className="text-red-400">*</span></label>
                            <textarea
                                value={formData.content}
                                onChange={(e) => setFormData((p) => ({ ...p, content: e.target.value }))}
                                rows={5}
                                placeholder="Enter document content to embed..."
                                className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 resize-none transition-all"
                            />
                        </div>
                        <div className="grid grid-cols-2 gap-4">
                            <div>
                                <label className="block text-xs text-[#a1a1aa] mb-1.5">Source</label>
                                <input
                                    type="text"
                                    value={formData.source}
                                    onChange={(e) => setFormData((p) => ({ ...p, source: e.target.value }))}
                                    placeholder="e.g. admin-manual"
                                    className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>
                            <div>
                                <label className="block text-xs text-[#a1a1aa] mb-1.5">Category</label>
                                <input
                                    type="text"
                                    value={formData.category}
                                    onChange={(e) => setFormData((p) => ({ ...p, category: e.target.value }))}
                                    placeholder="e.g. manual"
                                    className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 transition-all"
                                />
                            </div>
                        </div>
                        {formError && (
                            <p className="text-red-400 text-xs">{formError}</p>
                        )}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-purple-600 text-white hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {submitting ? (
                                    <div className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <Plus size={14} />
                                )}
                                {submitting ? 'Embedding...' : 'Add & Embed'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* PDF Upload form */}
            {showPdfForm && (
                <div className="bg-[#18181b] border border-blue-500/30 rounded-xl p-5">
                    <h3 className="text-sm font-semibold text-[#e4e4e7] mb-1">Upload PDF</h3>
                    <p className="text-xs text-[#71717a] mb-4">Teks akan diekstrak, di-chunk (~1500 karakter), dan di-embed ke Qdrant secara otomatis.</p>
                    <form onSubmit={handleUploadPdf} className="space-y-4">
                        <div>
                            <label className="block text-xs text-[#a1a1aa] mb-1.5">
                                PDF File <span className="text-red-400">*</span>
                                <span className="text-[#71717a] ml-1">(max 10MB, text-layer only)</span>
                            </label>
                            <input
                                type="file"
                                accept="application/pdf"
                                onChange={(e) => { setPdfFile(e.target.files[0] || null); setPdfError(''); }}
                                className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] file:mr-3 file:py-1 file:px-3 file:rounded file:border-0 file:text-xs file:bg-blue-600 file:text-white hover:file:bg-blue-700 focus:outline-none focus:border-blue-500 transition-all"
                            />
                        </div>
                        <div>
                            <label className="block text-xs text-[#a1a1aa] mb-1.5">Category</label>
                            <input
                                type="text"
                                value={pdfCategory}
                                onChange={(e) => setPdfCategory(e.target.value)}
                                placeholder="e.g. modul-kuliah (default: pdf-upload)"
                                className="w-full px-3 py-2 bg-[#09090b] border border-[#27272a] rounded-lg text-sm text-[#e4e4e7] placeholder-[#71717a] focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all"
                            />
                        </div>
                        {pdfError && <p className="text-red-400 text-xs">{pdfError}</p>}
                        <div className="flex justify-end">
                            <button
                                type="submit"
                                disabled={pdfSubmitting || !pdfFile}
                                className="flex items-center gap-2 px-5 py-2.5 text-sm rounded-lg bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                            >
                                {pdfSubmitting ? (
                                    <div className="animate-spin w-4 h-4 rounded-full border-2 border-white border-t-transparent" />
                                ) : (
                                    <Upload size={14} />
                                )}
                                {pdfSubmitting ? 'Processing PDF...' : 'Upload & Embed'}
                            </button>
                        </div>
                    </form>
                </div>
            )}

            {/* Error */}
            {error && (
                <div className="p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-sm">
                    {error}
                </div>
            )}

            {/* PDF success banner */}
            {pdfSuccess && (
                <div className="p-3 rounded-lg bg-green-500/10 border border-green-500/20 text-green-400 text-sm flex items-center gap-2">
                    <span>{pdfSuccess}</span>
                    <button onClick={() => setPdfSuccess('')} className="ml-auto text-green-300 hover:text-green-100">
                        <X size={14} />
                    </button>
                </div>
            )}

            {/* Documents table */}
            <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                {loading ? (
                    <div className="h-48 flex items-center justify-center">
                        <div className="animate-spin w-8 h-8 rounded-full border-2 border-purple-500 border-t-transparent" />
                    </div>
                ) : docs.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-[#71717a]">
                        <BookOpen size={32} className="mb-3 opacity-40" />
                        <p className="text-sm">No documents in knowledge base</p>
                        <p className="text-xs mt-1 opacity-70">Add your first document above</p>
                    </div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-sm">
                            <thead className="bg-[#27272a]/40 border-b border-[#27272a]">
                                <tr className="text-[#71717a] text-xs uppercase tracking-wider">
                                    <th className="px-5 py-3.5 text-left font-medium">Content Preview</th>
                                    <th className="px-5 py-3.5 text-left font-medium">Source</th>
                                    <th className="px-5 py-3.5 text-left font-medium">Category</th>
                                    <th className="px-5 py-3.5 text-left font-medium">Added</th>
                                    <th className="px-5 py-3.5 text-right font-medium">Action</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-[#27272a]/80">
                                {docs.map((doc) => (
                                    <tr key={doc.id} className="hover:bg-[#27272a]/30 transition-colors">
                                        <td className="px-5 py-4 max-w-xs">
                                            <p className="text-[#e4e4e7] text-xs leading-relaxed line-clamp-2">
                                                {doc.content || '(empty)'}
                                            </p>
                                            <p className="text-[10px] text-[#71717a] mt-1 font-mono truncate max-w-[200px]">
                                                id: {String(doc.id).substring(0, 20)}…
                                            </p>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-[#27272a] text-[#a1a1aa] text-xs font-mono">
                                                {doc.source || '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4">
                                            <span className="inline-flex items-center px-2 py-0.5 rounded bg-purple-500/10 text-purple-400 text-xs">
                                                {doc.category || '—'}
                                            </span>
                                        </td>
                                        <td className="px-5 py-4 text-[#71717a] text-xs whitespace-nowrap">
                                            {doc.createdAt
                                                ? new Date(doc.createdAt).toLocaleDateString('id-ID', { day: '2-digit', month: 'short', year: 'numeric' })
                                                : '—'
                                            }
                                        </td>
                                        <td className="px-5 py-4 text-right">
                                            <button
                                                onClick={() => handleDelete(doc.id)}
                                                disabled={deleteId === doc.id}
                                                className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/20 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                                            >
                                                {deleteId === doc.id ? (
                                                    <div className="animate-spin w-3 h-3 rounded-full border-2 border-red-400 border-t-transparent" />
                                                ) : (
                                                    <Trash2 size={13} />
                                                )}
                                                Delete
                                            </button>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
};

// ─── Bug Reports View ─────────────────────────────────────────────────────────

const BugReportsView = () => {
    const [reports, setReports] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchReports = async () => {
            try {
                const token = localStorage.getItem('token');
                const res = await axios.get(`${API}/admin/bug-reports`, {
                    headers: { Authorization: `Bearer ${token}` },
                });
                setReports(res.data.reports);
            } catch (err) {
                setError(err.response?.data?.message || 'Gagal memuat laporan bug');
            } finally {
                setLoading(false);
            }
        };
        fetchReports();
    }, []);

    if (loading) return <p className="text-[#a1a1aa] text-sm p-2">Memuat laporan...</p>;
    if (error) return <p className="text-red-400 text-sm p-2">{error}</p>;

    return (
        <div className="space-y-4">
            <div className="flex items-center justify-between">
                <h3 className="text-[#e4e4e7] font-semibold">Bug Reports</h3>
                <span className="text-xs text-[#71717a]">{reports.length} laporan</span>
            </div>
            {reports.length === 0 ? (
                <p className="text-[#71717a] text-sm">Belum ada laporan bug.</p>
            ) : (
                <div className="bg-[#18181b] border border-[#27272a] rounded-xl overflow-hidden">
                    <table className="w-full text-sm">
                        <thead>
                            <tr className="border-b border-[#27272a]">
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">No</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Judul Bug</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Dilaporkan oleh</th>
                                <th className="text-left px-4 py-3 text-[#71717a] font-medium text-xs">Tanggal</th>
                            </tr>
                        </thead>
                        <tbody>
                            {reports.map((r, idx) => (
                                <tr
                                    key={r.id}
                                    className="border-b border-[#27272a] last:border-0 hover:bg-[#27272a]/50 transition-colors"
                                >
                                    <td className="px-4 py-3 text-[#71717a]">{idx + 1}</td>
                                    <td className="px-4 py-3 text-[#e4e4e7]">{r.title}</td>
                                    <td className="px-4 py-3 text-[#a1a1aa]">
                                        <div className="text-sm">{r.user?.fullName}</div>
                                        <div className="text-xs text-[#71717a]">{r.user?.email}</div>
                                    </td>
                                    <td className="px-4 py-3 text-[#71717a] text-xs whitespace-nowrap">
                                        {new Date(r.createdAt).toLocaleDateString('id-ID', {
                                            day: '2-digit',
                                            month: 'short',
                                            year: 'numeric',
                                        })}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}
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
    const [dateFrom, setDateFrom] = useState('');
    const [dateTo, setDateTo] = useState('');

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
            const res = await axios.get(`${API}/admin/chat-logs`, {
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
            await axios.post(`${API}/auth/logout`, {}, { withCredentials: true });
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

        let matchesDate = true;
        if (dateFrom) {
            matchesDate = matchesDate && new Date(log.timestamp) >= new Date(dateFrom);
        }
        if (dateTo) {
            // include the full day of dateTo
            const endOfDay = new Date(dateTo);
            endOfDay.setHours(23, 59, 59, 999);
            matchesDate = matchesDate && new Date(log.timestamp) <= endOfDay;
        }

        return matchesSearch && matchesType && matchesDate;
    });

    const tabTitles = {
        analytics: 'Analytics',
        logs: 'Live Chat Logs',
        'knowledge-base': 'Knowledge Base',
        'bug-reports': 'Bug Reports',
    };

    const navItems = [
        { id: 'analytics', label: 'Analytics', icon: <LayoutDashboard size={18} /> },
        { id: 'logs', label: 'Chat Logs', icon: <MessageSquare size={18} /> },
        { id: 'knowledge-base', label: 'Knowledge Base', icon: <BookOpen size={18} /> },
        { id: 'bug-reports', label: 'Bug Reports', icon: <Bug size={18} /> },
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
                        {tabTitles[activeTab] ?? activeTab}
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

                        {/* ── Knowledge Base Tab ─────────────────────────── */}
                        {activeTab === 'knowledge-base' && <KnowledgeBaseView />}

                        {/* ── Bug Reports Tab ────────────────────────────── */}
                        {activeTab === 'bug-reports' && <BugReportsView />}

                        {/* ── Chat Logs Tab ──────────────────────────────── */}
                        {activeTab === 'logs' && (
                            <div className="space-y-6">
                                {/* Filters */}
                                <div className="flex flex-col sm:flex-row justify-between gap-4 flex-wrap">
                                    {/* Search */}
                                    <div className="relative">
                                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-[#71717a]" size={18} />
                                        <input
                                            type="text"
                                            placeholder="Search messages or identifiers..."
                                            value={searchTerm}
                                            onChange={(e) => setSearchTerm(e.target.value)}
                                            className="pl-10 pr-4 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 w-full sm:w-72 transition-all text-[#e4e4e7] placeholder-[#71717a]"
                                        />
                                    </div>

                                    {/* Date range */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="date"
                                            value={dateFrom}
                                            onChange={(e) => setDateFrom(e.target.value)}
                                            className="px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm text-[#a1a1aa] focus:outline-none focus:border-purple-500 transition-all [color-scheme:dark]"
                                        />
                                        <span className="text-[#71717a] text-xs">to</span>
                                        <input
                                            type="date"
                                            value={dateTo}
                                            onChange={(e) => setDateTo(e.target.value)}
                                            className="px-3 py-2 bg-[#18181b] border border-[#27272a] rounded-lg text-sm text-[#a1a1aa] focus:outline-none focus:border-purple-500 transition-all [color-scheme:dark]"
                                        />
                                        {(dateFrom || dateTo) && (
                                            <button
                                                onClick={() => { setDateFrom(''); setDateTo(''); }}
                                                className="text-[#71717a] hover:text-[#e4e4e7] transition-colors"
                                            >
                                                <X size={15} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Type filter */}
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
                                                        <th className="px-6 py-4 font-medium text-right">Resp. Time</th>
                                                        <th className="px-6 py-4 font-medium text-center">Status</th>
                                                        <th className="px-6 py-4 font-medium text-right">Tokens</th>
                                                    </tr>
                                                </thead>
                                                <tbody className="divide-y divide-[#27272a]/80">
                                                    {filteredLogs.length === 0 ? (
                                                        <tr>
                                                            <td colSpan={7} className="px-6 py-12 text-center text-[#71717a]">
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
                                                                    <span className="text-xs text-[#a1a1aa] font-mono">
                                                                        {log.responseTime != null ? `${Math.round(log.responseTime)}ms` : '—'}
                                                                    </span>
                                                                </td>
                                                                <td className="px-6 py-4 text-center">
                                                                    {log.isError ? (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-red-500/10 text-red-400 text-xs">
                                                                            <AlertTriangle size={10} /> Error
                                                                        </span>
                                                                    ) : (
                                                                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-green-500/10 text-green-400 text-xs">
                                                                            ✓ OK
                                                                        </span>
                                                                    )}
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
