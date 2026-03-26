import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  ArrowUpRight, ArrowRight, Menu, X,
  Zap, Calendar, FileText, ShieldCheck, BarChart3, Bell,
  Wand2, BookOpen, Twitter, Linkedin, Instagram,
  Mail, MapPin, MessageCircle,
} from 'lucide-react';

// ─── BlurText Animation ─────────────────────────────────────────────────────

const BlurText = ({ text, className = '' }) => {
  const words = text.split(' ');
  const containerRef = useRef(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setInView(true); },
      { threshold: 0.2 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <span ref={containerRef} className={className}>
      {words.map((word, i) => (
        <motion.span
          key={i}
          className="inline-block mr-[0.25em]"
          initial={{ opacity: 0, y: 30, filter: 'blur(10px)' }}
          animate={inView ? { opacity: 1, y: 0, filter: 'blur(0px)' } : {}}
          transition={{ duration: 0.55, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}
        >
          {word}
        </motion.span>
      ))}
    </span>
  );
};

// ─── Typing Chat Preview ─────────────────────────────────────────────────────

const chatMessages = [
  { from: 'user', text: 'Berapa IPK saya semester ini?' },
  { from: 'ai', text: 'IPK kamu semester 5 adalah 3.72 dari skala 4.00' },
  { from: 'user', text: 'Jadwal kuliah hari Senin?' },
  { from: 'ai', text: 'Senin: Fiqh Muamalah (08.00), Statistika (10.00), Pemrograman Web (13.00)' },
];

const TypingPreview = () => {
  const [visible, setVisible] = useState([]);
  const [typedText, setTypedText] = useState('');
  const [idx, setIdx] = useState(0);
  const [isTyping, setIsTyping] = useState(false);

  useEffect(() => {
    let t;
    const run = (i) => {
      if (i >= chatMessages.length) {
        t = setTimeout(() => { setVisible([]); setTypedText(''); setIdx(0); run(0); }, 3000);
        return;
      }
      const msg = chatMessages[i];
      setIsTyping(true);
      if (msg.from === 'ai') {
        let c = 0;
        setTypedText('');
        const type = () => {
          if (c <= msg.text.length) { setTypedText(msg.text.slice(0, c)); c++; t = setTimeout(type, 22); }
          else { setIsTyping(false); setVisible(p => [...p, msg]); setTypedText(''); setIdx(i + 1); t = setTimeout(() => run(i + 1), 700); }
        };
        t = setTimeout(type, 350);
      } else {
        t = setTimeout(() => { setIsTyping(false); setVisible(p => [...p, msg]); setIdx(i + 1); t = setTimeout(() => run(i + 1), 500); }, 400);
      }
    };
    t = setTimeout(() => run(0), 600);
    return () => clearTimeout(t);
  }, []);

  const current = chatMessages[idx];

  return (
    <div className="liquid-glass rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 pb-2 border-b border-white/5">
        <span className="font-display text-xs font-medium text-white/50 tracking-wide">Sapa Tazkia AI</span>
        <span className="ml-auto flex gap-1">
          <span className="w-2 h-2 rounded-full bg-red-500/60" />
          <span className="w-2 h-2 rounded-full bg-yellow-500/60" />
          <span className="w-2 h-2 rounded-full bg-green-500/60" />
        </span>
      </div>
      <div className="space-y-2 min-h-[90px]">
        <AnimatePresence>
          {visible.map((msg, i) => (
            <motion.div key={i} initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.from === 'user' ? 'justify-end' : 'justify-start'}`}>
              <span className={`px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[82%] font-display ${msg.from === 'user' ? 'bg-white/8 text-white/80' : 'text-white/70'}`}
                style={{ background: msg.from === 'ai' ? 'rgba(255,255,255,0.05)' : 'rgba(255,255,255,0.08)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {msg.text}
              </span>
            </motion.div>
          ))}
          {isTyping && current?.from === 'ai' && (
            <motion.div key="t" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex justify-start">
              <span className="px-3 py-2 rounded-xl text-xs leading-relaxed max-w-[82%] font-display text-white/70" style={{ background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.08)' }}>
                {typedText}<span className="inline-block w-0.5 h-3 bg-white/50 ml-0.5 animate-pulse align-middle" />
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};

// ─── Floating Navbar (scrolled state) ────────────────────────────────────────

const navLinks = [
  { label: 'Cara Pakai', href: '#how-it-works' },
  { label: 'Fitur', href: '#features' },
  { label: 'Kontak', href: '#contact' },
  { label: 'Docs', href: '/docs', internal: true },
];

const Navbar = ({ activeSection }) => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > window.innerHeight * 0.85);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  const scrollTo = (href) => {
    setMenuOpen(false);
    const el = document.getElementById(href.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  if (!scrolled) return null;

  return (
    <motion.header
      initial={{ y: -80, opacity: 0 }}
      animate={{ y: 0, opacity: 1 }}
      transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
      className="fixed top-4 left-0 right-0 z-50 flex justify-center px-4"
    >
      <div className="w-full max-w-7xl flex items-center justify-between">
        <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })} className="flex items-center gap-2 focus:outline-none">
          <img src="/a2.png" className="w-7 h-7 object-contain" alt="Sapa Tazkia" />
          <span className="font-display font-semibold text-white text-lg tracking-tighter">Sapa Tazkia</span>
        </button>

        <nav className="hidden md:flex items-center liquid-glass rounded-full px-2 py-1.5 gap-1 shadow-lg shadow-black/20">
          {navLinks.map(link => (
            link.external ? (
              <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                className="font-display text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-full transition-colors">
                {link.label}
              </a>
            ) : link.internal ? (
              <Link key={link.href} to={link.href}
                className="font-display text-sm font-medium text-white/70 hover:text-white px-4 py-2 rounded-full transition-colors">
                {link.label}
              </Link>
            ) : (
              <button key={link.href} onClick={() => scrollTo(link.href)}
                className={`font-display text-sm font-medium px-4 py-2 rounded-full transition-all ${activeSection === link.href.replace('#', '') ? 'text-white bg-white/10' : 'text-white/70 hover:text-white'}`}>
                {link.label}
              </button>
            )
          ))}
          <Link to="/login"
            className="font-display text-sm font-medium bg-white text-black rounded-full px-5 py-2 hover:bg-white/90 transition-colors flex items-center gap-1 ml-1">
            Login <ArrowUpRight size={13} />
          </Link>
        </nav>

        <button onClick={() => setMenuOpen(p => !p)} className="md:hidden p-2 rounded-full liquid-glass text-white/70 hover:text-white transition-colors">
          {menuOpen ? <X size={20} /> : <Menu size={20} />}
        </button>
      </div>

      <AnimatePresence>
        {menuOpen && (
          <motion.div
            initial={{ opacity: 0, y: -10, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.97 }}
            transition={{ duration: 0.22 }}
            className="absolute top-full mt-2 left-4 right-4 liquid-glass-strong rounded-2xl p-4 space-y-1"
          >
            {navLinks.map(link => (
              link.external ? (
                <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                  className="block px-4 py-2.5 rounded-full font-display text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                  {link.label}
                </a>
              ) : link.internal ? (
                <Link key={link.href} to={link.href} onClick={() => setMenuOpen(false)}
                  className="block px-4 py-2.5 rounded-full font-display text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                  {link.label}
                </Link>
              ) : (
                <button key={link.href} onClick={() => scrollTo(link.href)}
                  className="block w-full text-left px-4 py-2.5 rounded-full font-display text-sm font-medium text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                  {link.label}
                </button>
              )
            ))}
            <div className="pt-2 border-t border-white/8">
              <Link to="/login" onClick={() => setMenuOpen(false)}
                className="flex items-center justify-center gap-1 w-full px-4 py-2.5 bg-white text-black rounded-full font-display text-sm font-medium hover:bg-white/90 transition-colors">
                Login <ArrowUpRight size={13} />
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

// ─── Hero Section — Two-Panel with Collapsible Left Glass ────────────────────

const HeroSection = () => {
  const navigate = useNavigate();
  const [panelOpen, setPanelOpen] = useState(true);
  const [menuDropOpen, setMenuDropOpen] = useState(false);

  const scrollTo = (href) => {
    setMenuDropOpen(false);
    const el = document.getElementById(href.replace('#', ''));
    if (el) el.scrollIntoView({ behavior: 'smooth' });
  };

  return (
    <section className="relative flex min-h-screen overflow-hidden bg-black">
      {/* Video background */}
      <video
        autoPlay loop muted playsInline
        className="absolute inset-0 w-full h-full object-cover z-0 pointer-events-none"
        style={{ filter: 'hue-rotate(120deg) saturate(1.4) brightness(0.7)' }}
        src="https://d8j0ntlcm91z4.cloudfront.net/user_38xzZboKViGWJOttwIXH07lWA1P/hf_20260315_073750_51473149-4350-4920-ae24-c8214286f323.mp4"
      />
      <div className="absolute inset-0 bg-black/35 z-[1]" />

      {/* ── Left Panel (collapsible) ── */}
      <AnimatePresence initial={false}>
        {panelOpen && (
          <motion.div
            key="left-panel"
            initial={{ x: '-100%', opacity: 0 }}
            animate={{ x: 0, opacity: 1 }}
            exit={{ x: '-100%', opacity: 0 }}
            transition={{ type: 'spring', damping: 26, stiffness: 240 }}
            className="relative z-10 w-full lg:w-[52%] flex flex-col min-h-screen p-4 lg:p-6 flex-shrink-0"
          >
            {/* Glass overlay — full inset */}
            <div className="absolute inset-4 lg:inset-6 rounded-3xl liquid-glass-strong pointer-events-none" style={{ zIndex: -1 }} />

            {/* ── Internal header: Menu | Logo | X ── */}
            <header className="relative flex items-center justify-between w-full mb-6 pt-4 px-4 lg:pt-6 lg:px-6">
              {/* Menu — LEFT */}
              <div className="relative">
                <button
                  onClick={() => setMenuDropOpen(p => !p)}
                  className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-white/80 text-sm font-display hover:scale-105 active:scale-95 transition-transform"
                >
                  <Menu size={15} /> Menu
                </button>
                <AnimatePresence>
                  {menuDropOpen && (
                    <motion.div
                      initial={{ opacity: 0, y: -8, scale: 0.97 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -8, scale: 0.97 }}
                      transition={{ duration: 0.18 }}
                      className="absolute top-full mt-2 left-0 liquid-glass-strong rounded-2xl p-2 space-y-0.5 min-w-[160px]"
                      style={{ zIndex: 20 }}
                    >
                      {navLinks.map(link => (
                        link.external ? (
                          <a key={link.href} href={link.href} target="_blank" rel="noopener noreferrer"
                            onClick={() => setMenuDropOpen(false)}
                            className="block px-4 py-2.5 rounded-xl font-display text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                            {link.label}
                          </a>
                        ) : link.internal ? (
                          <Link key={link.href} to={link.href} onClick={() => setMenuDropOpen(false)}
                            className="block px-4 py-2.5 rounded-xl font-display text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                            {link.label}
                          </Link>
                        ) : (
                          <button key={link.href} onClick={() => scrollTo(link.href.replace('#', ''))}
                            className="block w-full text-left px-4 py-2.5 rounded-xl font-display text-sm text-white/70 hover:text-white hover:bg-white/5 transition-colors">
                            {link.label}
                          </button>
                        )
                      ))}
                      <div className="pt-1 border-t border-white/8 mt-1">
                        <Link to="/login" onClick={() => setMenuDropOpen(false)}
                          className="flex items-center justify-center gap-1 w-full px-4 py-2.5 bg-white text-black rounded-xl font-display text-sm font-medium hover:bg-white/90 transition-colors">
                          Login <ArrowUpRight size={12} />
                        </Link>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Logo icon — CENTER */}
              <img src="/a2.png" className="w-8 h-8 object-contain" alt="Sapa Tazkia" />

              {/* X — RIGHT */}
              <button
                onClick={() => setPanelOpen(false)}
                className="liquid-glass w-9 h-9 rounded-full flex items-center justify-center text-white/60 hover:text-white hover:scale-105 active:scale-95 transition-all"
              >
                <X size={15} />
              </button>
            </header>

            {/* Hero center */}
            <div className="flex-1 flex flex-col items-center justify-center text-center px-4 py-4">
              {/* Badge */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.25 }}
                className="liquid-glass rounded-full px-4 py-1.5 inline-flex items-center gap-2 mb-6"
              >
                <span className="bg-white text-black font-display text-xs font-semibold px-2.5 py-0.5 rounded-full">Baru</span>
                <span className="font-display text-sm font-light text-white/70">AI Chatbot Akademik Tazkia</span>
              </motion.div>

              {/* Heading */}
              <motion.h1
                initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.7, delay: 0.35 }}
                className="font-display font-medium text-white leading-tight mb-6 max-w-lg"
                style={{ fontSize: 'clamp(2.2rem, 4.5vw, 4rem)', letterSpacing: '-0.05em' }}
              >
                Tanya Nilai, Jadwal,{' '}
                <em className="font-serif not-italic text-white/75">Info Kampus.</em>
                {' '}Langsung Dijawab AI.
              </motion.h1>

              {/* Subtext */}
              <motion.p
                initial={{ opacity: 0, filter: 'blur(8px)' }} animate={{ opacity: 1, filter: 'blur(0px)' }}
                transition={{ duration: 0.7, delay: 0.5 }}
                className="font-display font-light text-white/55 text-sm max-w-sm mx-auto mb-8 leading-relaxed"
              >
                Sapa Tazkia hadir 24/7 untuk menjawab semua pertanyaan akademikmu — nilai, jadwal, beasiswa, hingga transkrip.
              </motion.p>

              {/* CTA */}
              <motion.div
                initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.65 }}
                className="flex flex-col sm:flex-row gap-3 justify-center items-center mb-8"
              >
                <button
                  onClick={() => navigate('/chat')}
                  className="liquid-glass-strong rounded-full px-7 py-3.5 font-display font-medium text-white text-sm flex items-center gap-3 hover:scale-105 active:scale-95 transition-transform"
                >
                  Mulai Sekarang
                  <span className="w-7 h-7 rounded-full bg-white/15 flex items-center justify-center flex-shrink-0">
                    <ArrowRight size={13} style={{ transform: 'rotate(90deg)' }} />
                  </span>
                </button>
                <Link to="/chat?guest=true"
                  className="font-display font-light text-white/55 text-sm flex items-center gap-2 hover:text-white/80 transition-colors px-4 py-3">
                  Coba sebagai Tamu
                </Link>
              </motion.div>

              {/* Pills */}
              <motion.div
                initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: 0.8 }}
                className="flex gap-2 flex-wrap justify-center"
              >
                {['Cek Nilai & IPK', 'Jadwal Kuliah', 'Transkrip Akademik'].map(tag => (
                  <span key={tag} className="liquid-glass rounded-full px-4 py-1.5 font-display text-xs text-white/80">
                    {tag}
                  </span>
                ))}
              </motion.div>
            </div>

            {/* Bottom quote */}
            <motion.div
              initial={{ opacity: 0 }} animate={{ opacity: 1 }}
              transition={{ duration: 0.7, delay: 1.0 }}
              className="text-center pb-2"
            >
              <p className="font-display text-xs tracking-widest uppercase text-white/45 mb-2">AI AKADEMIK TERPERCAYA</p>
              <p className="font-display text-white/55 text-sm mb-2">
                Kami hadirkan jawaban yang{' '}
                <em className="font-serif italic text-white/65">selalu tepat waktu.</em>
              </p>
              <div className="flex items-center justify-center gap-3">
                <span className="flex-1 h-px bg-white/12 max-w-[80px]" />
                <span className="font-display text-xs uppercase tracking-widest text-white/30">UNIVERSITAS TAZKIA</span>
                <span className="flex-1 h-px bg-white/12 max-w-[80px]" />
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Reopen button — appears when panel is closed */}
      <AnimatePresence>
        {!panelOpen && (
          <motion.button
            key="reopen"
            initial={{ opacity: 0, x: -16 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -16 }}
            transition={{ duration: 0.25 }}
            onClick={() => setPanelOpen(true)}
            className="absolute left-6 top-6 z-20 liquid-glass rounded-full px-4 py-2 flex items-center gap-2 text-white/80 text-sm font-display hover:scale-105 active:scale-95 transition-transform"
          >
            <Menu size={15} /> Menu
          </motion.button>
        )}
      </AnimatePresence>

      {/* ── Right Panel (desktop only) ── */}
      <div className="hidden lg:flex relative z-10 flex-1 flex-col items-center justify-center overflow-hidden p-0">

        {/* Top bar absolute positioning to align with left nav */}
        <motion.div
          initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className={`absolute top-6 right-10 flex items-center justify-between z-20 transition-all duration-300 ${panelOpen ? 'left-6' : 'left-[130px]'}`}
        >
          <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2">
            <img src="/a2.png" className="w-5 h-5 object-contain" alt="Sapa Tazkia" />
            <span className="font-display font-semibold text-white text-sm tracking-tighter">Sapa Tazkia</span>
          </div>
          <div className="flex items-center gap-2">
            <Link to="/login"
              className="liquid-glass rounded-full px-5 py-2 font-display text-sm text-white/80 hover:text-white transition-colors flex items-center gap-1.5">
              Masuk <ArrowRight size={13} />
            </Link>
          </div>
        </motion.div>

        <motion.div
          className="flex flex-col w-full px-6 pt-24 pb-6 h-full justify-center mx-auto"
          animate={{ maxWidth: panelOpen ? 2000 : 600 }}
          transition={{ type: 'spring', damping: 30, stiffness: 200 }}
        >

          {/* Community card */}
          <motion.div
            initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}
            transition={{ duration: 0.6, delay: 0.5 }}
            className="mb-5"
          >
            <div className="liquid-glass rounded-2xl p-5 w-56">
              <h3 className="font-display font-medium text-white text-sm mb-1.5">Bergabung dengan ekosistem</h3>
              <p className="font-display text-white/55 text-xs leading-relaxed">Ribuan mahasiswa Tazkia sudah menggunakan Sapa AI</p>
            </div>
          </motion.div>

          {/* Chat preview */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, delay: 0.65 }}
            className="mb-5"
          >
            <TypingPreview />
          </motion.div>

          {/* Bottom feature section */}
          <motion.div
            initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.8 }}
          >
            <div className="liquid-glass rounded-[2.5rem] p-4">
              <div className="grid grid-cols-2 gap-3 mb-3">
                <div className="liquid-glass rounded-3xl p-4 space-y-3">
                  <Wand2 size={18} className="text-white/60" />
                  <div>
                    <p className="font-display font-medium text-white text-sm">Pemrosesan AI</p>
                    <p className="font-display text-white/50 text-xs mt-0.5">Jawaban real-time</p>
                  </div>
                </div>
                <div className="liquid-glass rounded-3xl p-4 space-y-3">
                  <BookOpen size={18} className="text-white/60" />
                  <div>
                    <p className="font-display font-medium text-white text-sm">Riwayat Akademik</p>
                    <p className="font-display text-white/50 text-xs mt-0.5">Semua data tersimpan</p>
                  </div>
                </div>
              </div>
              <div className="liquid-glass rounded-2xl p-4 flex items-center gap-3">
                <div className="w-24 h-16 liquid-glass-strong rounded-xl flex items-center justify-center flex-shrink-0">
                  <MessageCircle size={22} className="text-white/40" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display font-medium text-white text-sm">Chat AI Akademik</p>
                  <p className="font-display text-white/50 text-xs mt-0.5 leading-relaxed">Tanya apa saja tentang kampus</p>
                </div>
                <button
                  onClick={() => navigate('/chat')}
                  className="liquid-glass rounded-full w-8 h-8 flex items-center justify-center text-white flex-shrink-0 hover:scale-105 transition-transform"
                >
                  <ArrowRight size={14} />
                </button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Partners Bar ─────────────────────────────────────────────────────────────

const PartnersSection = () => (
  <section className="py-16 px-4 bg-black text-center">
    <div className="max-w-4xl mx-auto">
      <div className="liquid-glass rounded-full px-4 py-1.5 inline-block mb-8">
        <span className="font-display text-xs font-medium text-white/50">Dirancang untuk mahasiswa STEI Tazkia</span>
      </div>
      <div className="flex flex-wrap justify-center gap-8 md:gap-12 items-center">
        {['Nilai & IPK', 'Jadwal Kuliah', 'Transkrip', 'Beasiswa', 'Pengumuman'].map(name => (
          <span key={name} className="font-display font-medium text-white text-2xl md:text-3xl opacity-60 hover:opacity-100 transition-opacity cursor-default" style={{ letterSpacing: '-0.03em' }}>
            {name}
          </span>
        ))}
      </div>
    </div>
  </section>
);

// ─── How It Works ─────────────────────────────────────────────────────────────

const steps = [
  { num: '01', title: 'Login dengan NIM', desc: 'Masuk pakai NIM kampus Tazkia atau coba sebagai tamu dulu sebelum mendaftar.' },
  { num: '02', title: 'Ketik Pertanyaanmu', desc: 'Tanya apa saja tentang akademikmu — nilai, jadwal, info umum, atau pengumuman kampus.' },
  { num: '03', title: 'Dapat Jawaban Instan', desc: 'AI langsung menjawab dengan data real-time dari sistem kampus Tazkia.' },
];

const HowItWorksSection = () => (
  <section id="how-it-works" className="relative py-16 md:py-28 px-6 md:px-16 overflow-hidden" style={{ background: '#000' }}>
    <div
      className="absolute inset-0 z-0"
      style={{ background: 'radial-gradient(ellipse 70% 60% at 50% 50%, rgba(255,255,255,0.025) 0%, transparent 70%)' }}
    />
    <div className="relative z-10 max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <div className="liquid-glass rounded-full px-3.5 py-1 inline-block mb-4">
          <span className="font-display text-xs font-medium text-white/60">Cara Pakai</span>
        </div>
        <h2 className="font-display font-medium text-white leading-tight tracking-tight mb-4"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
          Kamu tanya.{' '}
          <em className="font-serif italic text-white/75">AI langsung jawab.</em>
        </h2>
        <p className="font-display font-light text-white/50 text-sm max-w-md mx-auto">
          Cukup login, ketik, dan dapatkan informasi akademikmu. Semua dalam hitungan detik.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
        {steps.map((step, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 30 }, visible: { opacity: 1, y: 0 } }}
            initial="hidden"
            whileInView="visible"
            viewport={{ once: true, amount: 0.3 }}
            transition={{ duration: 0.55, delay: i * 0.12, ease: [0.22, 1, 0.36, 1] }}
            className="liquid-glass rounded-2xl p-6"
          >
            <div className="liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center font-display font-medium text-white text-sm mb-5">
              {step.num}
            </div>
            <h3 className="font-display font-medium text-white text-xl leading-tight mb-2">{step.title}</h3>
            <p className="font-display font-light text-white/50 text-sm leading-relaxed">{step.desc}</p>
          </motion.div>
        ))}
      </div>

    </div>
  </section>
);

// ─── Features Chess ───────────────────────────────────────────────────────────

const featuresChess = [
  {
    title: 'Dirancang untuk menjawab. Dibangun untuk membantu.',
    desc: 'Setiap respons akurat dan relevan. AI kami mempelajari data kampus secara real-time sehingga informasi yang kamu terima selalu tepat waktu dan dapat diandalkan.',
    cta: 'Pelajari Fitur',
    href: '/docs?section=fitur',
    visual: (
      <div className="liquid-glass rounded-2xl overflow-hidden flex items-center justify-center" style={{ minHeight: 240, background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-center p-8">
          <div className="font-display font-medium text-white/20 text-6xl mb-3" style={{ letterSpacing: '-0.05em' }}>3.72</div>
          <div className="font-display font-medium text-white text-xl">IPK Semester 5</div>
          <div className="font-display text-xs text-white/40 mt-1">Skala 4.00</div>
        </div>
      </div>
    ),
  },
  {
    title: 'Makin pintar. Otomatis.',
    desc: 'Data akademik kampus diperbarui langsung ke sistem AI kami. Jadwal berubah? Nilai rilis? Sapa Tazkia selalu tahu duluan. Tidak ada informasi basi.',
    cta: 'Lihat Cara Kerjanya',
    href: '/docs?section=cara-kerja',
    reverse: true,
    visual: (
      <div className="liquid-glass rounded-2xl overflow-hidden flex items-center justify-center" style={{ minHeight: 240, background: 'rgba(255,255,255,0.02)' }}>
        <div className="text-center p-8 space-y-3 w-full max-w-xs">
          {[
            { label: 'Fiqh Muamalah', time: '08.00' },
            { label: 'Statistika', time: '10.00' },
            { label: 'Pemrograman Web', time: '13.00' },
          ].map((item, i) => (
            <div key={i} className="flex items-center justify-between px-4 py-2 rounded-xl" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.08)' }}>
              <span className="font-display text-xs text-white/70">{item.label}</span>
              <span className="font-display font-medium text-white text-sm">{item.time}</span>
            </div>
          ))}
        </div>
      </div>
    ),
  },
];

const ChessSection = () => (
  <section id="features" className="py-14 md:py-24 px-6 md:px-16 bg-black">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-16">
        <div className="liquid-glass rounded-full px-3.5 py-1 inline-block mb-4">
          <span className="font-display text-xs font-medium text-white/60">Kemampuan</span>
        </div>
        <h2 className="font-display font-medium text-white leading-tight tracking-tight"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
          Fitur lengkap.{' '}
          <em className="font-serif italic text-white/75">Tanpa ribet.</em>
        </h2>
      </div>

      <div className="space-y-10">
        {featuresChess.map((f, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true, amount: 0.25 }}
            transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
            className={`flex flex-col ${f.reverse ? 'lg:flex-row-reverse' : 'lg:flex-row'} gap-8 items-center`}
          >
            <div className="flex-1 space-y-5">
              <h3 className="font-display font-medium text-white leading-tight text-2xl md:text-3xl" style={{ letterSpacing: '-0.03em' }}>{f.title}</h3>
              <p className="font-display font-light text-white/50 text-sm leading-relaxed">{f.desc}</p>
              <Link to={f.href}
                className="liquid-glass-strong rounded-full px-6 py-2.5 font-display font-medium text-white text-sm inline-flex items-center gap-2 hover:scale-105 active:scale-95 transition-transform">
                {f.cta} <ArrowUpRight size={14} />
              </Link>
            </div>
            <div className="flex-1 w-full">{f.visual}</div>
          </motion.div>
        ))}
      </div>
    </div>
  </section>
);

// ─── Features Grid ────────────────────────────────────────────────────────────

const gridFeatures = [
  { Icon: BarChart3, title: 'Cek Nilai & IPK', desc: 'Nilai UTS, UAS, dan IPK real-time kapan saja dan di mana saja.' },
  { Icon: Calendar, title: 'Jadwal Kuliah', desc: 'Tanya jadwal harian, mingguan, atau per dosen dengan mudah.' },
  { Icon: FileText, title: 'Transkrip Akademik', desc: 'Ringkasan SKS, status kelulusan, dan riwayat perkuliahan lengkap.' },
  { Icon: ShieldCheck, title: 'Data Aman', desc: 'Login dengan NIM kampusmu. Data terenkripsi dan terlindungi.' },
];

const GridSection = () => (
  <section className="py-14 md:py-20 px-6 md:px-16 bg-black">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="liquid-glass rounded-full px-3.5 py-1 inline-block mb-4">
          <span className="font-display text-xs font-medium text-white/60">Kenapa Sapa Tazkia</span>
        </div>
        <h2 className="font-display font-medium text-white leading-tight tracking-tight"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
          Perbedaannya ada di sini.
        </h2>
      </div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5"
        variants={{ visible: { transition: { staggerChildren: 0.1 } } }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {gridFeatures.map(({ Icon, title, desc }, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.5 } } }}
            className="liquid-glass rounded-2xl p-6 space-y-4"
          >
            <div className="liquid-glass-strong rounded-full w-10 h-10 flex items-center justify-center">
              <Icon size={16} className="text-white/80" />
            </div>
            <h3 className="font-display font-medium text-white text-lg leading-tight">{title}</h3>
            <p className="font-display font-light text-white/50 text-sm leading-relaxed">{desc}</p>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ─── Stats Section ────────────────────────────────────────────────────────────

const stats = [
  { value: '24/7', label: 'Selalu tersedia' },
  { value: '98%', label: 'Akurasi jawaban' },
  { value: '< 2s', label: 'Waktu respons' },
  { value: '6+', label: 'Fitur akademik' },
];

const StatsSection = () => (
  <section className="relative py-14 md:py-20 px-6 md:px-16 overflow-hidden" style={{ background: '#000' }}>
    <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse 80% 50% at 50% 50%, rgba(255,255,255,0.03) 0%, transparent 70%)' }} />
    <div className="relative z-10 max-w-4xl mx-auto">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        whileInView={{ opacity: 1, y: 0 }}
        viewport={{ once: true }}
        transition={{ duration: 0.6 }}
        className="liquid-glass rounded-3xl p-6 sm:p-10 md:p-14 grid grid-cols-2 lg:grid-cols-4 gap-6 md:gap-8 text-center"
      >
        {stats.map(({ value, label }, i) => (
          <div key={i}>
            <div className="font-display font-medium text-white leading-none mb-2"
              style={{ fontSize: 'clamp(2.5rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
              {value}
            </div>
            <div className="font-display font-light text-white/50 text-sm">{label}</div>
          </div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ─── Testimonials ─────────────────────────────────────────────────────────────

const testimonials = [
  {
    quote: 'Akhirnya ada solusi yang bisa jawab pertanyaan jadwal dan nilai tanpa harus login ke SIAKAD yang lambat. Sapa Tazkia hemat banyak waktu.',
    name: 'Rizky Maulana',
    role: 'Mahasiswa Teknik Informatika, Semester 6',
  },
  {
    quote: 'Nilai UTS baru rilis, langsung tanya ke Sapa Tazkia. Dalam 2 detik sudah dapat jawabannya. Lebih cepat dari buka portal sendiri.',
    name: 'Fatimah Az-Zahra',
    role: 'Mahasiswa Sistem Informasi, Semester 4',
  },
  {
    quote: 'Info beasiswa dan deadline pendaftaran selalu ketinggalan. Sejak pakai Sapa Tazkia, semua informasi penting langsung tersedia.',
    name: 'Ahmad Fauzan',
    role: 'Mahasiswa Manajemen Bisnis, Semester 5',
  },
];

const TestimonialsSection = () => (
  <section className="py-14 md:py-24 px-6 md:px-16 bg-black">
    <div className="max-w-5xl mx-auto">
      <div className="text-center mb-12">
        <div className="liquid-glass rounded-full px-3.5 py-1 inline-block mb-4">
          <span className="font-display text-xs font-medium text-white/60">Kata Mereka</span>
        </div>
        <h2 className="font-display font-medium text-white leading-tight tracking-tight"
          style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
          Jangan percaya kata kami saja.
        </h2>
      </div>
      <motion.div
        className="grid grid-cols-1 md:grid-cols-3 gap-5"
        variants={{ visible: { transition: { staggerChildren: 0.12 } } }}
        initial="hidden"
        whileInView="visible"
        viewport={{ once: true, amount: 0.2 }}
      >
        {testimonials.map(({ quote, name, role }, i) => (
          <motion.div
            key={i}
            variants={{ hidden: { opacity: 0, y: 24 }, visible: { opacity: 1, y: 0, transition: { duration: 0.55 } } }}
            className="liquid-glass rounded-2xl p-7 space-y-5"
          >
            <p className="font-display font-light text-white/70 text-sm italic leading-relaxed">"{quote}"</p>
            <div>
              <div className="font-display font-medium text-white text-sm">{name}</div>
              <div className="font-display font-light text-white/40 text-xs mt-0.5">{role}</div>
            </div>
          </motion.div>
        ))}
      </motion.div>
    </div>
  </section>
);

// ─── Contact Section ──────────────────────────────────────────────────────────

const ContactSection = () => {
  const [form, setForm] = useState({ name: '', email: '', message: '' });
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch('https://formspree.io/f/xojpareb', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Accept': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSent(true);
        setForm({ name: '', email: '', message: '' });
        setTimeout(() => setSent(false), 5000);
      } else {
        setError('Gagal mengirim pesan. Coba lagi.');
      }
    } catch {
      setError('Gagal mengirim pesan. Periksa koneksimu.');
    } finally {
      setLoading(false);
    }
  };

  const inputStyle = {
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 12,
    color: '#fff',
    width: '100%',
    padding: '12px 16px',
    fontSize: 14,
    fontFamily: "'Poppins', sans-serif",
    fontWeight: 300,
    outline: 'none',
    transition: 'border-color 0.2s',
  };

  return (
    <section id="contact" className="py-14 md:py-24 px-6 md:px-16 bg-black">
      <div className="max-w-5xl mx-auto">
        <div className="text-center mb-12">
          <div className="liquid-glass rounded-full px-3.5 py-1 inline-block mb-4">
            <span className="font-display text-xs font-medium text-white/60">Kontak</span>
          </div>
          <h2 className="font-display font-medium text-white leading-tight tracking-tight mb-3"
            style={{ fontSize: 'clamp(2.2rem, 5vw, 4rem)', letterSpacing: '-0.04em' }}>
            Ada pertanyaan atau masukan?
          </h2>
          <p className="font-display font-light text-white/45 text-sm">Tim pengembang Sapa Tazkia selalu terbuka untuk feedback.</p>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 24 }}
          whileInView={{ opacity: 1, y: 0 }}
          viewport={{ once: true }}
          transition={{ duration: 0.6 }}
          className="grid grid-cols-1 md:grid-cols-2 gap-10"
        >
          {/* Info */}
          <div className="space-y-6">
            <h3 className="font-display font-medium text-white text-xl">Hubungi Kami</h3>
            {[
              { Icon: Mail, label: 'Email', value: 'sapa@stmik.tazkia.ac.id' },
              { Icon: MapPin, label: 'Kampus', value: 'Universitas Tazkia, Bogor, Jawa Barat' },
              { Icon: MessageCircle, label: 'Chatbot', value: 'Atau langsung tanya ke chatbot kami!' },
            ].map((item, i) => (
              <div key={i} className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <item.Icon size={14} className="text-white/50" />
                </div>
                <div>
                  <div className="font-display text-xs font-medium text-white/40 uppercase tracking-widest mb-0.5">{item.label}</div>
                  <div className="font-display font-light text-white/60 text-sm">{item.value}</div>
                </div>
              </div>
            ))}
          </div>

          {/* Form */}
          <div className="liquid-glass rounded-2xl p-6">
            {sent ? (
              <div className="flex flex-col items-center justify-center py-10 gap-3">
                <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
                  <ArrowUpRight size={20} className="text-white/70" />
                </div>
                <p className="font-display font-medium text-white text-xl">Pesan Terkirim!</p>
                <p className="font-display font-light text-white/45 text-sm text-center">Terima kasih, tim kami akan segera menghubungimu.</p>
              </div>
            ) : (
              <form onSubmit={submit} className="space-y-4">
                {[
                  { label: 'Nama', key: 'name', type: 'text', placeholder: 'Nama lengkapmu' },
                  { label: 'Email', key: 'email', type: 'email', placeholder: 'Email kampus atau pribadimu' },
                ].map(f => (
                  <div key={f.key}>
                    <label className="block font-display text-xs font-medium text-white/35 uppercase tracking-widest mb-1.5">{f.label}</label>
                    <input type={f.type} placeholder={f.placeholder} value={form[f.key]}
                      onChange={e => setForm(p => ({ ...p, [f.key]: e.target.value }))}
                      required style={inputStyle}
                      onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                      onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                    />
                  </div>
                ))}
                <div>
                  <label className="block font-display text-xs font-medium text-white/35 uppercase tracking-widest mb-1.5">Pesan</label>
                  <textarea placeholder="Tuliskan pertanyaan atau masukan kamu..." value={form.message}
                    onChange={e => setForm(p => ({ ...p, message: e.target.value }))}
                    required rows={4} style={{ ...inputStyle, resize: 'none' }}
                    onFocus={e => e.target.style.borderColor = 'rgba(255,255,255,0.25)'}
                    onBlur={e => e.target.style.borderColor = 'rgba(255,255,255,0.08)'}
                  />
                </div>
                {error && <p className="text-red-400 text-xs font-display text-center">{error}</p>}
                <button type="submit" disabled={loading}
                  className="w-full py-3 rounded-full font-display font-medium text-sm bg-white text-black hover:bg-white/90 transition-colors hover:scale-[1.02] active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ color: '#000' }}>
                  {loading ? 'Mengirim...' : 'Kirim Pesan'}
                </button>
              </form>
            )}
          </div>
        </motion.div>
      </div>
    </section>
  );
};

// ─── Footer Modal ─────────────────────────────────────────────────────────────

const FooterModal = ({ isOpen, onClose, title, children }) => {
  useEffect(() => {
    if (isOpen) document.body.style.overflow = 'hidden';
    else document.body.style.overflow = '';
    return () => { document.body.style.overflow = ''; };
  }, [isOpen]);

  if (!isOpen) return null;
  return (
    <div className="fixed inset-0 z-[200] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 40 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 40 }}
        transition={{ duration: 0.28, ease: [0.22, 1, 0.36, 1] }}
        className="relative w-full sm:max-w-lg max-h-[85vh] sm:max-h-[80vh] flex flex-col rounded-t-3xl sm:rounded-3xl overflow-hidden"
        style={{ background: '#0a0a0a', border: '1px solid rgba(255,255,255,0.08)' }}
      >
        {/* drag handle mobile */}
        <div className="flex justify-center pt-3 pb-1 sm:hidden">
          <div className="w-10 h-1 rounded-full bg-white/15" />
        </div>
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/8 flex-shrink-0">
          <h2 className="font-display font-medium text-white text-base">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 rounded-full bg-white/6 hover:bg-white/12 flex items-center justify-center text-white/50 hover:text-white transition-all">
            <X size={15} />
          </button>
        </div>
        <div className="overflow-y-auto px-6 py-5 space-y-5 text-sm font-display font-light text-white/60 leading-relaxed">
          {children}
        </div>
      </motion.div>
    </div>
  );
};

const PrivasiContent = () => (
  <>
    <p className="text-white/35 text-xs uppercase tracking-widest">Terakhir diperbarui: 24 Desember 2025</p>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">1. Siapa Kami</h3>
      <p>SAPA TAZKIA AI adalah layanan asisten akademik berbasis kecerdasan buatan yang dikembangkan oleh tim pengembang STMIK Tazkia. Layanan ini dioperasikan di bawah naungan STMIK Tazkia, Bogor, Jawa Barat.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">2. Data yang Kami Kumpulkan</h3>
      <p>Dalam menjalankan layanan, kami mengumpulkan data berikut:</p>
      <ul className="mt-2 space-y-1 pl-4 list-disc text-white/50">
        <li>NIM (Nomor Induk Mahasiswa) dan email institusi</li>
        <li>Riwayat percakapan dengan AI</li>
        <li>Alamat IP dan informasi perangkat dasar</li>
        <li>Data nilai dan transkrip akademik (dari sistem institusi)</li>
      </ul>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">3. Penggunaan Data</h3>
      <p>Data digunakan semata-mata untuk menyediakan layanan, meningkatkan akurasi jawaban AI, dan memastikan keamanan sistem. Kami tidak menjual atau membagikan data pengguna ke pihak ketiga untuk keperluan komersial.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">4. Pengiriman ke Pihak Ketiga</h3>
      <p>Pertanyaan yang kamu kirimkan diproses melalui <span className="text-white/80">OpenAI API</span> untuk menghasilkan jawaban. Data yang dikirim hanya berisi teks pertanyaan dan konteks percakapan — tidak termasuk data identitas lengkap. Penggunaan OpenAI tunduk pada <span className="text-white/80">kebijakan privasi OpenAI</span>.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">5. Retensi Data</h3>
      <p>Riwayat percakapan disimpan selama <span className="text-white/80">7 hari</span> sejak sesi dibuat. Setelah periode tersebut, data percakapan dihapus otomatis dari sistem kami. Data akun dan akademik dikelola sesuai kebijakan institusi.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">6. Keamanan Data</h3>
      <p>Kami menggunakan HTTPS, enkripsi JWT, Redis session management, dan password hashing untuk melindungi datamu. Data sensitif tidak pernah disimpan dalam plaintext.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">7. Hak Pengguna</h3>
      <p>Kamu berhak meminta penghapusan akun dan data percakapanmu kapan saja dengan menghubungi tim kami di <span className="text-white/80">sapa@stmik.tazkia.ac.id</span>.</p>
    </div>

    <div className="p-4 rounded-2xl bg-white/4 border border-white/8 space-y-1">
      <p className="text-white/45 text-xs">Pertanyaan seputar privasi?</p>
      <p className="text-white/80 text-xs font-medium">Muhammad Ichsan Junaedi — sapa@stmik.tazkia.ac.id</p>
    </div>
  </>
);

const SyaratContent = () => (
  <>
    <p className="text-white/35 text-xs uppercase tracking-widest">Berlaku sejak: 24 Desember 2025</p>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">1. Penerimaan Syarat</h3>
      <p>Dengan mengakses atau menggunakan SAPA TAZKIA AI, kamu menyatakan telah membaca, memahami, dan menyetujui seluruh syarat penggunaan ini. Jika tidak setuju, harap hentikan penggunaan layanan.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">2. Pengguna yang Diizinkan</h3>
      <p>Layanan ini diperuntukkan eksklusif bagi <span className="text-white/80">mahasiswa aktif Universitas Tazkia dan STMIK Tazkia</span>. Penggunaan oleh pihak di luar institusi tidak diizinkan kecuali dalam mode tamu yang telah disediakan.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">3. Penggunaan yang Dilarang</h3>
      <p>Dengan menggunakan layanan ini, kamu setuju untuk <span className="text-white/80">tidak</span>:</p>
      <ul className="mt-2 space-y-1.5 pl-4 list-disc text-white/50">
        <li>Menggunakan layanan untuk tujuan kecurangan akademik (plagiarisme, pembuatan tugas atas nama orang lain)</li>
        <li>Mencoba meretas, mengeksploitasi, atau mengganggu sistem</li>
        <li>Menggunakan bot, skrip otomatis, atau alat scraping tanpa izin tertulis</li>
        <li>Menyamar sebagai pengguna lain atau memberikan informasi identitas palsu</li>
        <li>Menyebarkan konten yang melanggar hukum, bersifat SARA, atau merugikan pihak lain</li>
        <li>Mencoba mengakses data akademik milik pengguna lain</li>
        <li>Membebani sistem secara berlebihan melebihi batas kuota yang ditetapkan</li>
      </ul>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">4. Akun dan Keamanan</h3>
      <p>Kamu bertanggung jawab penuh atas keamanan kredensial login dan seluruh aktivitas yang terjadi di bawah akunmu. Segera laporkan jika terdapat akses tidak sah ke akunmu.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">5. Konten Hasil AI</h3>
      <p>Jawaban yang dihasilkan oleh AI bersifat informatif dan bukan merupakan nasihat akademik resmi. Pengguna tetap bertanggung jawab atas cara penggunaan informasi yang diperoleh.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">6. Sanksi Pelanggaran</h3>
      <p>Pelanggaran terhadap syarat ini dapat mengakibatkan <span className="text-white/80">penangguhan atau penghapusan akun</span> tanpa pemberitahuan sebelumnya. Pelanggaran serius dapat dilaporkan kepada pihak akademik institusi.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">7. Batasan Tanggung Jawab</h3>
      <p>Layanan disediakan "sebagaimana adanya". Tim SAPA tidak bertanggung jawab atas kerugian yang timbul dari penggunaan atau ketidakmampuan menggunakan layanan akibat gangguan teknis, ketidakakuratan AI, atau kejadian di luar kendali kami.</p>
    </div>

    <div className="space-y-1">
      <h3 className="font-medium text-white/90 text-sm">8. Perubahan Syarat</h3>
      <p>Kami berhak memperbarui syarat ini kapan saja. Perubahan signifikan akan diumumkan melalui platform. Penggunaan berkelanjutan setelah perubahan dianggap sebagai penerimaan syarat baru.</p>
    </div>
  </>
);

const KontakContent = ({ onClose }) => (
  <>
    <p className="text-white/50">Ada pertanyaan, masukan, atau kendala teknis? Hubungi tim SAPA TAZKIA AI melalui saluran berikut.</p>

    <div className="space-y-3">
      {[
        {
          icon: <Mail size={16} />,
          label: 'Email Resmi',
          value: 'sapa@stmik.tazkia.ac.id',
          sub: 'Respon dalam 1–2 hari kerja',
          href: 'mailto:sapa@stmik.tazkia.ac.id',
        },
        {
          icon: <MessageCircle size={16} />,
          label: 'WhatsApp',
          value: '085890179268',
          sub: 'Muhammad Ichsan Junaedi',
          href: 'https://wa.me/6285890179268',
        },
        {
          icon: <MapPin size={16} />,
          label: 'Kampus',
          value: 'STMIK Tazkia',
          sub: 'Bogor, Jawa Barat',
          href: null,
        },
      ].map((item, i) => (
        <div key={i} className="flex items-start gap-3 p-4 rounded-2xl bg-white/4 border border-white/8">
          <div className="w-8 h-8 rounded-xl bg-white/6 flex items-center justify-center text-white/45 shrink-0 mt-0.5">
            {item.icon}
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white/35 text-xs uppercase tracking-widest mb-0.5">{item.label}</p>
            {item.href ? (
              <a href={item.href} target="_blank" rel="noopener noreferrer"
                className="text-white/85 text-sm font-medium hover:text-white transition-colors block">{item.value}</a>
            ) : (
              <p className="text-white/85 text-sm font-medium">{item.value}</p>
            )}
            <p className="text-white/35 text-xs mt-0.5">{item.sub}</p>
          </div>
        </div>
      ))}
    </div>

    <div className="p-4 rounded-2xl bg-white/4 border border-white/8">
      <p className="text-white/50 text-xs mb-1">Jam Layanan</p>
      <p className="text-white/85 text-sm font-medium">Senin – Jumat, 08.00 – 16.00 WIB</p>
      <p className="text-white/35 text-xs mt-1">Di luar jam layanan, gunakan formulir laporan di bawah.</p>
    </div>

    <Link to="/report-bug" onClick={onClose}
      className="flex items-center justify-center gap-2 w-full py-3 rounded-full bg-white/8 border border-white/10 text-white/70 hover:bg-white/12 hover:text-white transition-all text-sm font-medium">
      <ArrowUpRight size={14} /> Laporkan Bug / Masalah Teknis
    </Link>
  </>
);

// ─── CTA + Footer ─────────────────────────────────────────────────────────────

const CtaFooter = () => {
  const navigate = useNavigate();
  const [modal, setModal] = useState(null); // 'privasi' | 'syarat' | 'kontak'

  return (
    <section className="relative py-20 md:py-32 px-6 overflow-hidden" style={{ background: '#000' }}>
      <div className="absolute inset-0 z-0" style={{ background: 'radial-gradient(ellipse 80% 60% at 50% 60%, rgba(255,255,255,0.04) 0%, transparent 70%)' }} />
      <div className="relative z-10 max-w-3xl mx-auto text-center">
        <h2 className="font-display font-medium text-white tracking-tight leading-tight mb-5"
          style={{ fontSize: 'clamp(2.8rem, 7vw, 5.5rem)', letterSpacing: '-0.05em' }}>
          Mulai perjalanan akademikmu bersama{' '}
          <em className="font-serif italic text-white/75">AI.</em>
        </h2>
        <p className="font-display font-light text-white/45 text-sm md:text-base mb-10">
          Daftar gratis. Login dengan NIM. Dapatkan jawaban akademik dalam hitungan detik.
        </p>
        <div className="flex flex-col sm:flex-row gap-3 justify-center">
          <button onClick={() => navigate('/chat')}
            className="liquid-glass-strong rounded-full px-8 py-3.5 font-display font-medium text-white text-sm flex items-center gap-2 justify-center hover:scale-105 active:scale-95 transition-transform">
            Mulai Sekarang <ArrowUpRight size={15} />
          </button>
          <Link to="/chat?guest=true"
            className="rounded-full px-8 py-3.5 font-display font-medium text-black text-sm flex items-center justify-center bg-white hover:bg-white/90 transition-colors">
            Coba sebagai Tamu
          </Link>
        </div>
      </div>

      {/* Footer */}
      <div className="relative z-10 max-w-5xl mx-auto mt-32 pt-8" style={{ borderTop: '1px solid rgba(255,255,255,0.08)' }}>
        <div className="flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <img src="/a2.png" className="w-6 h-6 object-contain" alt="Sapa Tazkia" />
            <span className="font-display font-semibold text-white text-base tracking-tighter">Sapa Tazkia</span>
            <span className="font-display font-light text-white/30 text-xs ml-2">AI Chatbot Akademik Universitas Tazkia</span>
          </div>
          <p className="font-display font-light text-white/30 text-xs">© 2025 Sapa Tazkia · STMIK Tazkia · Bogor, Indonesia</p>
          <div className="flex gap-5">
            <button onClick={() => setModal('privasi')} className="font-display font-light text-white/30 text-xs hover:text-white/60 transition-colors">Privasi</button>
            <button onClick={() => setModal('syarat')} className="font-display font-light text-white/30 text-xs hover:text-white/60 transition-colors">Syarat</button>
            <button onClick={() => setModal('kontak')} className="font-display font-light text-white/30 text-xs hover:text-white/60 transition-colors">Kontak</button>
          </div>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {modal === 'privasi' && (
          <FooterModal isOpen title="Kebijakan Privasi" onClose={() => setModal(null)}>
            <PrivasiContent />
          </FooterModal>
        )}
        {modal === 'syarat' && (
          <FooterModal isOpen title="Syarat Penggunaan" onClose={() => setModal(null)}>
            <SyaratContent />
          </FooterModal>
        )}
        {modal === 'kontak' && (
          <FooterModal isOpen title="Hubungi Kami" onClose={() => setModal(null)}>
            <KontakContent onClose={() => setModal(null)} />
          </FooterModal>
        )}
      </AnimatePresence>
    </section>
  );
};

// ─── Scroll Spy Hook ──────────────────────────────────────────────────────────

const useActiveSection = (ids) => {
  const [active, setActive] = useState('');
  useEffect(() => {
    const handle = () => {
      for (const id of [...ids].reverse()) {
        const el = document.getElementById(id);
        if (el && el.getBoundingClientRect().top <= 120) { setActive(id); return; }
      }
      setActive('');
    };
    window.addEventListener('scroll', handle, { passive: true });
    return () => window.removeEventListener('scroll', handle);
  }, [ids]);
  return active;
};

// ─── Main Export ──────────────────────────────────────────────────────────────

const MarketingLandingPage = () => {
  const activeSection = useActiveSection(['how-it-works', 'features', 'contact']);
  return (
    <div className="bg-black overflow-x-hidden">
      <Navbar activeSection={activeSection} />
      <HeroSection />
      <PartnersSection />
      <HowItWorksSection />
      <ChessSection />
      <GridSection />
      <StatsSection />
      <TestimonialsSection />
      <ContactSection />
      <CtaFooter />
    </div>
  );
};

export default MarketingLandingPage;
