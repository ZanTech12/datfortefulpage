import React, { useState, useEffect, useCallback, useRef, useMemo } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import { useParams, useNavigate } from 'react-router-dom';
import { useLayout } from '../../context/LayoutContext';

// ==================== THEME ====================
const T = {
  bg: '#060a13',
  surface: 'rgba(15,23,42,0.82)',
  surfaceLight: 'rgba(30,41,59,0.65)',
  border: 'rgba(148,163,184,0.14)',
  green: '#22c55e', greenDeep: '#006633', greenDark: '#0b3d24',
  gold: '#f59e0b', red: '#ef4444', blue: '#38bdf8',
  text: '#f1f5f9', muted: '#94a3b8', dim: '#64748b',
  font: "'Inter','Segoe UI',system-ui,sans-serif",
  mono: "'JetBrains Mono','Courier New',monospace",
};
const pad = (n) => String(n).padStart(2, '0');
const fmtTime = (s) => {
  const h = Math.floor(s / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
};
const fmtSecs = (s) => (!s ? '0s' : Math.floor(s / 60) > 0 ? `${Math.floor(s / 60)}m ${s % 60}s` : `${s}s`);
const initials = (name = '?') => name.split(' ').map(w => w[0]).slice(0, 2).join('').toUpperCase();

// ==================== LOCAL STORAGE ====================
const STORAGE_KEY = 'cbt_submitted_tests';
const AUTOSAVE_KEY = 'cbt_autosave_';
const getSubmittedTests = () => { try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]'); } catch { return []; } };
const markTestAsSubmitted = (id) => {
  if (!id) return;
  const list = getSubmittedTests();
  if (!list.includes(id)) { list.push(id); localStorage.setItem(STORAGE_KEY, JSON.stringify(list)); }
};
const autoSaveAnswers = (id, answers, flagged, timings, scratch) => {
  if (!id) return;
  try { localStorage.setItem(AUTOSAVE_KEY + id, JSON.stringify({ answers, flagged: [...flagged], timings, scratchContent: scratch, savedAt: Date.now() })); } catch {}
};
const loadAutoSave = (id) => { try { const r = localStorage.getItem(AUTOSAVE_KEY + id); return r ? JSON.parse(r) : null; } catch { return null; } };
const clearAutoSave = (id) => { try { localStorage.removeItem(AUTOSAVE_KEY + id); } catch {} };

// ==================== SOUND ENGINE ====================
const SoundEngine = {
  ctx: null, enabled: true,
  init() { if (!this.ctx) { try { this.ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch { this.enabled = false; } } },
  play(type) {
    if (!this.enabled || !this.ctx) return;
    try {
      const o = this.ctx.createOscillator(), g = this.ctx.createGain();
      o.connect(g); g.connect(this.ctx.destination);
      const n = this.ctx.currentTime;
      const cfg = {
        select:  [600, 800, .12, .12, 'sine'],
        flag:    [500, 900, .10, .20, 'sine'],
        unflag:  [800, 400, .10, .20, 'sine'],
        warning: [440, 440, .08, .45, 'square'],
        submit:  [523, 784, .15, .50, 'sine'],
        error:   [200, 100, .08, .35, 'sawtooth'],
      }[type];
      if (!cfg) return;
      o.type = cfg[4];
      o.frequency.setValueAtTime(cfg[0], n);
      o.frequency.exponentialRampToValueAtTime(cfg[1], n + cfg[3] * 0.5);
      g.gain.setValueAtTime(cfg[2], n);
      g.gain.exponentialRampToValueAtTime(0.001, n + cfg[3]);
      o.start(n); o.stop(n + cfg[3]);
    } catch {}
  },
};

// ==================== MATH FORMATTER (protected) ====================
const formatMathText = (text) => {
  if (!text) return '';

  let f = String(text);

  const protectedParts = [];
  f = f.replace(
    /<(\/?)(b|i|u|strong|em|sub|sup|br\s*\/?|p|span|img)\b[^>]*>/gi,
    (m) => { protectedParts.push(m); return `\u0000${protectedParts.length - 1}\u0000`; }
  );

  f = f.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

  f = f.replace(/sqrt\(([^)]+)\)/gi, '√($1)')
       .replace(/\^(\d+)/g, '<sup>$1</sup>')
       .replace(/\^([a-zA-Z])(?![a-zA-Z])/g, '<sup>$1</sup>')
       .replace(/\^\(([^)]+)\)/g, '<sup>($1)</sup>')
       .replace(/\*/g, ' × ');
  const fractions = {
    '1 ÷ 2': '½', '1 ÷ 3': '⅓', '1 ÷ 4': '¼', '2 ÷ 3': '⅔', '3 ÷ 4': '¾',
    '1 ÷ 5': '⅕', '2 ÷ 5': '⅖', '3 ÷ 5': '⅗', '4 ÷ 5': '⅘',
    '1 ÷ 6': '⅙', '5 ÷ 6': '⅚', '1 ÷ 8': '⅛', '3 ÷ 8': '⅜',
    '5 ÷ 8': '⅝', '7 ÷ 8': '⅞',
  };
  Object.entries(fractions).forEach(([k, v]) => { f = f.replace(new RegExp(k, 'g'), v); });
  f = f.replace(/&lt;=/g, '≤').replace(/&gt;=/g, '≥').replace(/!=/g, '≠')
       .replace(/\bpi\b/gi, 'π').replace(/\btheta\b/gi, 'θ')
       .replace(/\balpha\b/gi, 'α').replace(/\bbeta\b/gi, 'β')
       .replace(/\bgamma\b/gi, 'γ').replace(/\bdelta\b/gi, 'δ')
       .replace(/\bsigma\b/gi, 'σ').replace(/\bomega\b/gi, 'ω')
       .replace(/\blambda\b/gi, 'λ').replace(/\bmu\b/gi, 'μ')
       .replace(/\binfinity\b/gi, '∞')
       .replace(/  +/g, ' ').replace(/\s+×\s+/g, ' × ');

  f = f.replace(/\u0000(\d+)\u0000/g, (_, i) => protectedParts[+i]);

  return f;
};

// ==================== QUESTION IMAGE SPLITTER ====================
const splitImagesFromText = (text) => {
  const str = String(text || '');
  const images = str.match(/<img[^>]*>/gi) || [];
  const clean = str.replace(/<img[^>]*>/gi, '').trim();
  return { images, clean };
};

// ==================== GLOBAL ANIMATION STYLES ====================
const useGlobalStyles = () => {
  useEffect(() => {
    if (document.getElementById('cbt-pro-styles')) return;
    const s = document.createElement('style');
    s.id = 'cbt-pro-styles';
    s.textContent = `
      sup{font-size:.68em;vertical-align:super;line-height:0;color:inherit}
      @keyframes fadeUp{from{opacity:0;transform:translateY(16px)}to{opacity:1;transform:none}}
      @keyframes fadeIn{from{opacity:0}to{opacity:1}}
      @keyframes popIn{0%{transform:scale(.92);opacity:0}100%{transform:scale(1);opacity:1}}
      @keyframes pulseGlow{0%,100%{box-shadow:0 0 0 0 rgba(239,68,68,.45)}50%{box-shadow:0 0 0 9px rgba(239,68,68,0)}}
      @keyframes pulseGreen{0%,100%{box-shadow:0 0 0 0 rgba(34,197,94,.4)}50%{box-shadow:0 0 0 7px rgba(34,197,94,0)}}
      @keyframes shimmer{0%{background-position:-500px 0}100%{background-position:500px 0}}
      @keyframes floatBg{0%,100%{transform:translate(0,0) scale(1)}50%{transform:translate(-30px,24px) scale(1.06)}}
      @keyframes spin{to{transform:rotate(360deg)}}
      @keyframes blink{0%,100%{opacity:1}50%{opacity:.35}}
      @keyframes ringDraw{from{stroke-dashoffset:var(--c)}}
      img[src^="data:image"], img[src^="/uploads/"] {
        display: inline-block;
        max-width: 280px;
        max-height: 220px;
        height: auto;
        vertical-align: middle;
        margin: 8px 6px;
        border-radius: 8px;
        border: 1px solid rgba(148,163,184,0.25);
      }
      .cbt-compact img[src^="data:image"], .cbt-compact img[src^="/uploads/"] {
        max-width: 190px;
        max-height: 150px;
        margin: 4px;
      }
      ::-webkit-scrollbar{width:8px;height:8px}
      ::-webkit-scrollbar-track{background:transparent}
      ::-webkit-scrollbar-thumb{background:rgba(34,197,94,.25);border-radius:8px}
      ::-webkit-scrollbar-thumb:hover{background:rgba(34,197,94,.45)}
      ::selection{background:rgba(34,197,94,.35)}
      
      /* MOBILE RESPONSIVE ADJUSTMENTS */
      @media (max-width: 768px) {
        .cbt-instr-card, .cbt-review-card { max-width: 95% !important; border-radius: 12px !important; }
        .cbt-dock { width: 100% !important; max-width: 320px !important; }
        img[src^="data:image"], img[src^="/uploads/"] { max-width: 140px; max-height: 120px; margin: 4px; }
      }
    `;
    document.head.appendChild(s);
    return () => { const el = document.getElementById('cbt-pro-styles'); if (el) el.remove(); };
  }, []);
};

// ==================== SVG RING ====================
const Ring = ({ pct, size = 92, stroke = 8, color = T.green, children, animate }) => {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div style={{ position: 'relative', width: size, height: size, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
      <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(148,163,184,0.12)" strokeWidth={stroke} fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={color} strokeWidth={stroke} fill="none"
          strokeDasharray={c} strokeDashoffset={c * (1 - Math.min(1, Math.max(0, pct)))}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset .45s ease, stroke .3s', filter: `drop-shadow(0 0 5px ${color}66)` }} />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', animation: animate ? 'pulseGlow 1.2s infinite' : 'none', borderRadius: '50%' }}>
        {children}
      </div>
    </div>
  );
};

// ==================== CALCULATOR ====================
const Calculator = ({ onClose }) => {
  const [display, setDisplay] = useState('0');
  const [expr, setExpr] = useState('');
  const [done, setDone] = useState(false);

  const num = (n) => { SoundEngine.play('select'); if (done) { setDisplay(String(n)); setExpr(''); setDone(false); } else setDisplay(p => p === '0' ? String(n) : p + n); };
  const op = (o) => { SoundEngine.play('select'); setDone(false); const sym = o === '×' ? '*' : o === '÷' ? '/' : o; setExpr(p => (p || display) + sym); setDisplay('0'); };
  const eq = () => {
    SoundEngine.play('submit');
    try { const full = expr + display; const r = Function('"use strict";return(' + full + ')')(); setExpr(full + ' ='); setDisplay(String(Math.round(r * 1e10) / 1e10)); setDone(true); }
    catch { setDisplay('Error'); setDone(true); }
  };
  const clear = () => { SoundEngine.play('select'); setDisplay('0'); setExpr(''); setDone(false); };
  const back = () => { SoundEngine.play('select'); setDisplay(p => p.length > 1 ? p.slice(0, -1) : '0'); };
  const pct = () => { SoundEngine.play('select'); setDisplay(p => String(parseFloat(p) / 100)); };
  const sqrt = () => { SoundEngine.play('select'); setDisplay(p => String(Math.round(Math.sqrt(parseFloat(p)) * 1e10) / 1e10)); setDone(true); };
  const dot = () => { SoundEngine.play('select'); if (!display.includes('.')) setDisplay(p => p + '.'); };
  const sign = () => { SoundEngine.play('select'); setDisplay(p => p.startsWith('-') ? p.slice(1) : '-' + p); };

  const key = (bg, fg = '#fff', extra = {}) => ({
    padding: '0.65rem', border: '1px solid rgba(255,255,255,0.06)', borderRadius: '9px',
    fontSize: '0.95rem', fontWeight: 700, cursor: 'pointer', backgroundColor: bg, color: fg,
    fontFamily: T.font, transition: 'all .12s', ...extra,
  });

  return (
    <div style={popStyles.dock} className="cbt-dock">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.9rem', background: `linear-gradient(135deg,${T.greenDeep},#022c16)`, color: '#fff' }}>
        <span style={{ fontWeight: 800, fontSize: '0.68rem', letterSpacing: '2px' }}>🧮 CALCULATOR</span>
        <button onClick={onClose} style={popStyles.dockClose}>✕</button>
      </div>
      <div style={{ padding: '0.7rem 0.9rem', background: '#0b1220', textAlign: 'right', minHeight: '64px', display: 'flex', flexDirection: 'column', justifyContent: 'flex-end', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontSize: '0.65rem', color: T.dim, minHeight: '13px', wordBreak: 'break-all', fontFamily: T.mono }}>{expr || ' '}</div>
        <div style={{ fontSize: '1.7rem', fontWeight: 700, color: T.text, fontFamily: T.mono, wordBreak: 'break-all', textShadow: `0 0 14px ${T.green}44` }}>{display}</div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: '4px', padding: '7px', background: 'rgba(2,6,23,.6)' }}>
        <button onClick={clear} style={key('#7f1d1d')}>C</button>
        <button onClick={back} style={key('#92400e')}>⌫</button>
        <button onClick={pct} style={key('#92400e')}>%</button>
        <button onClick={() => op('÷')} style={key(T.greenDeep)}>÷</button>
        <button onClick={() => num(7)} style={key('#1e293b', T.text)}>7</button>
        <button onClick={() => num(8)} style={key('#1e293b', T.text)}>8</button>
        <button onClick={() => num(9)} style={key('#1e293b', T.text)}>9</button>
        <button onClick={() => op('×')} style={key(T.greenDeep)}>×</button>
        <button onClick={() => num(4)} style={key('#1e293b', T.text)}>4</button>
        <button onClick={() => num(5)} style={key('#1e293b', T.text)}>5</button>
        <button onClick={() => num(6)} style={key('#1e293b', T.text)}>6</button>
        <button onClick={() => op('-')} style={key(T.greenDeep)}>−</button>
        <button onClick={() => num(1)} style={key('#1e293b', T.text)}>1</button>
        <button onClick={() => num(2)} style={key('#1e293b', T.text)}>2</button>
        <button onClick={() => num(3)} style={key('#1e293b', T.text)}>3</button>
        <button onClick={() => op('+')} style={key(T.greenDeep)}>+</button>
        <button onClick={sign} style={key('#334155', T.text)}>±</button>
        <button onClick={() => num(0)} style={key('#1e293b', T.text)}>0</button>
        <button onClick={dot} style={key('#1e293b', T.text)}>.</button>
        <button onClick={eq} style={{ ...key(T.green), boxShadow: `0 0 14px ${T.green}55` } }>=</button>
        <button onClick={sqrt} style={{ ...key('#0e7490'), gridColumn: 'span 2' }}>√ Square Root</button>
        <button onClick={clear} style={{ ...key('#334155', T.text), gridColumn: 'span 2' }}>CE Clear Entry</button>
      </div>
    </div>
  );
};

// ==================== SCRATCH PAD ====================
const ScratchPad = ({ value, onChange, onClose }) => (
  <div style={popStyles.dock} className="cbt-dock">
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 0.9rem', background: `linear-gradient(135deg,${T.greenDeep},#022c16)`, color: '#fff' }}>
      <span style={{ fontWeight: 800, fontSize: '0.68rem', letterSpacing: '2px' }}>📝 SCRATCH PAD</span>
      <div style={{ display: 'flex', gap: '6px' }}>
        <button onClick={() => onChange('')} title="Clear" style={{ ...popStyles.dockClose, width: 'auto', padding: '0 8px', fontSize: '0.65rem' }}>CLEAR</button>
        <button onClick={onClose} style={popStyles.dockClose}>✕</button>
      </div>
    </div>
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder="Jot down your workings here…"
      style={{
        width: '100%', height: '200px', border: 'none', padding: '0.9rem', fontSize: '0.88rem',
        resize: 'none', outline: 'none', fontFamily: T.font, color: '#fef3c7', lineHeight: '1.9rem',
        background: '#0b1220 repeating-linear-gradient(transparent, transparent 1.85rem, rgba(245,158,11,.14) 1.85rem, rgba(245,158,11,.14) calc(1.85rem + 1px))',
        caretColor: T.gold,
      }}
    />
  </div>
);

// ==================== INSTRUCTIONS SCREEN ====================
const InstructionsScreen = ({ test, onStart, onClose }) => {
  const rules = [
    ['⏱️', `You have ${test.duration} minutes for ${test.questions.length} questions.`],
    ['🚫', 'Do NOT refresh or close this window during the exam.'],
    ['👁️', 'Tab/window switching is detected — the exam will be SUBMITTED automatically.'],
    ['🖱️', 'Right-click, copy, paste & print are disabled.'],
    ['🖥️', 'Full-screen mode is enforced. Exiting is tracked.'],
    ['🏁', 'Click FINISH when done — you cannot retake this test.'],
    ['🚩', 'Flag tricky questions to revisit them later.'],
    ['🧮', 'Built-in calculator & scratch pad are provided.'],
    ['⌨️', 'Shortcuts: A–E select · ←/→ navigate · S submit · F fullscreen'],
    ['💾', 'Answers auto-save every 10 seconds.'],
  ];
  const info = [
    ['📚 SUBJECT', test.subjectId?.name || 'General'],
    ['📄 TITLE', test.title],
    ['❓ QUESTIONS', `${test.questions.length}`],
    ['⏱️ DURATION', `${test.duration} min`],
  ];
  return (
    <div style={{ ...popStyles.overlay, animation: 'fadeIn .25s ease' }}>
      <div style={popStyles.instrCard} className="cbt-instr-card">
        <div style={{
          padding: '1.6rem 2rem 1.2rem', textAlign: 'center',
          background: `linear-gradient(160deg, rgba(0,102,51,0.35), rgba(2,6,23,0.4))`, borderBottom: `1px solid ${T.border}`,
        }}>
          <div style={{ width: '58px', height: '58px', margin: '0 auto 0.7rem', borderRadius: '16px', background: `linear-gradient(135deg,${T.green},#065f46)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.6rem', boxShadow: `0 8px 24px ${T.green}55` }}>🎓</div>
          <div style={{ fontWeight: 900, fontSize: '1.25rem', letterSpacing: '5px', color: T.green, textShadow: `0 0 20px ${T.green}55` }}>BimTech CBT</div>
          <div style={{ fontSize: '0.62rem', color: T.muted, letterSpacing: '3px', marginTop: '2px' }}>EXAMINATION PORTAL · 2025</div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.55rem', padding: '1.1rem 2rem' }}>
          {info.map(([k, v]) => (
            <div key={k} style={{ background: T.surfaceLight, border: `1px solid ${T.border}`, borderRadius: '10px', padding: '0.55rem 0.8rem' }}>
              <div style={{ fontSize: '0.58rem', fontWeight: 800, color: T.dim, letterSpacing: '1.5px' }}>{k}</div>
              <div style={{ fontSize: '0.85rem', fontWeight: 700, color: T.text, marginTop: '2px' }}>{v}</div>
            </div>
          ))}
        </div>
        <div style={{ padding: '0 2rem 1rem' }}>
          <div style={{ fontSize: '0.72rem', fontWeight: 800, color: T.green, letterSpacing: '2px', marginBottom: '0.6rem' }}>📋 EXAMINATION INSTRUCTIONS</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.3rem', maxHeight: '230px', overflowY: 'auto', paddingRight: '4px' }}>
            {rules.map(([icon, text], i) => (
              <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: '0.65rem', padding: '0.45rem 0.65rem', borderRadius: '8px', background: 'rgba(148,163,184,0.05)', animation: `fadeUp .3s ease ${i * 0.04}s backwards` }}>
                <span style={{ fontSize: '0.9rem', flexShrink: 0 }}>{icon}</span>
                <span style={{ fontSize: '0.8rem', color: '#cbd5e1', lineHeight: 1.5 }}>{text}</span>
              </div>
            ))}
          </div>
        </div>
        <div style={{ margin: '0 2rem', padding: '0.75rem 1rem', background: 'rgba(245,158,11,0.1)', color: '#fcd34d', borderRadius: '10px', fontSize: '0.76rem', lineHeight: 1.55, border: '1px solid rgba(245,158,11,0.3)' }}>
          ⚠️ <b>WARNING:</b> Any malpractice (tab switching, copying) is logged and reported. Ensure stable internet before starting.
        </div>
        <div style={{ display: 'flex', gap: '0.8rem', justifyContent: 'center', padding: '1.3rem 2rem 1.6rem' }}>
          <button onClick={onClose} style={popStyles.ghostBtn}>CANCEL</button>
          <button onClick={onStart} style={popStyles.ctaBtn}>🚀 START EXAM</button>
        </div>
      </div>
    </div>
  );
};

// ==================== REVIEW PANEL ====================
const ReviewPanel = ({ test, answers, flagged, timings, onClose, onGoTo, onSubmit }) => {
  const sections = [
    { label: 'Answered', icon: '✅', color: T.green, f: (i) => answers[i] !== null },
    { label: 'Unanswered', icon: '❌', color: T.red, f: (i) => answers[i] === null },
    { label: 'Flagged', icon: '🚩', color: T.gold, f: (i) => flagged.has(i) },
  ];
  return (
    <div style={{ ...popStyles.overlay, animation: 'fadeIn .2s ease' }}>
      <div style={popStyles.reviewCard} className="cbt-review-card">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.4rem', borderBottom: `1px solid ${T.border}`, background: 'rgba(2,6,23,.4)' }}>
          <div>
            <div style={{ fontWeight: 900, fontSize: '0.95rem', color: T.text, letterSpacing: '1px' }}>📝 ANSWER REVIEW</div>
            <div style={{ fontSize: '0.7rem', color: T.muted, marginTop: '2px' }}>Tap any question to jump back to it</div>
          </div>
          <button onClick={onClose} style={popStyles.dockCloseDark}>✕</button>
        </div>
        <div style={{ padding: '0.8rem 1.4rem', overflowY: 'auto', flex: 1 }}>
          {sections.map((sec) => {
            const items = test.questions.map((_, i) => i).filter(sec.f);
            if (!items.length) return null;
            return (
              <div key={sec.label} style={{ marginBottom: '0.9rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.4rem', paddingBottom: '0.3rem', borderBottom: `1px solid ${T.border}` }}>
                  <span style={{ color: sec.color, fontWeight: 800, fontSize: '0.75rem', letterSpacing: '0.5px' }}>{sec.icon} {sec.label.toUpperCase()}</span>
                  <span style={{ fontSize: '0.7rem', color: T.muted, fontWeight: 700 }}>({items.length})</span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '3px' }}>
                  {items.map((qi) => (
                    <div key={qi} onClick={() => { onGoTo(qi); onClose(); }} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.5rem 0.7rem', borderRadius: '8px', cursor: 'pointer', background: 'rgba(148,163,184,0.04)', border: '1px solid transparent', transition: 'all .12s', gap: '0.5rem' }}
                      onMouseEnter={e => { e.currentTarget.style.background = 'rgba(34,197,94,0.1)'; e.currentTarget.style.borderColor = `${T.green}44`; }}
                      onMouseLeave={e => { e.currentTarget.style.background = 'rgba(148,163,184,0.04)'; e.currentTarget.style.borderColor = 'transparent'; }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flex: 1, minWidth: 0 }}>
                        <span style={{ fontWeight: 800, fontSize: '0.68rem', color: sec.color, background: `${sec.color}1c`, padding: '0.15rem 0.5rem', borderRadius: '5px', flexShrink: 0 }}>Q{qi + 1}</span>
                        <span style={{ fontSize: '0.72rem', color: T.muted, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                          dangerouslySetInnerHTML={{ __html: formatMathText(test.questions[qi].questionText?.substring(0, 65) || '') + '…' }} />
                      </div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.55rem', flexShrink: 0 }}>
                        {timings[qi] !== undefined && <span style={{ fontSize: '0.6rem', color: T.dim }}>⏱ {fmtSecs(timings[qi])}</span>}
                        {answers[qi] !== null && <span style={{ fontSize: '0.62rem', color: T.green, fontWeight: 800 }}>{String.fromCharCode(65 + answers[qi])}</span>}
                        {flagged.has(qi) && <span style={{ fontSize: '0.65rem' }}>🚩</span>}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
        <div style={{ display: 'flex', gap: '0.7rem', padding: '1rem 1.4rem', borderTop: `1px solid ${T.border}`, background: 'rgba(2,6,23,.4)' }}>
          <button onClick={onClose} style={{ ...popStyles.ghostBtn, flex: 1 }}>← CONTINUE TEST</button>
          <button onClick={onSubmit} style={{ ...popStyles.dangerBtn, flex: 1 }}>SUBMIT TEST →</button>
        </div>
      </div>
    </div>
  );
};

// ==================== FLOATING PANEL / POPUP STYLES ====================
const popStyles = {
  overlay: { position: 'fixed', inset: 0, background: 'rgba(1,4,10,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 2000, backdropFilter: 'blur(8px)', padding: '1rem' },
  instrCard: { background: T.surface, backdropFilter: 'blur(20px)', maxWidth: '580px', width: '100%', borderRadius: '20px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6), 0 0 0 1px rgba(34,197,94,0.15)', maxHeight: '92vh', overflowY: 'auto', border: `1px solid ${T.border}`, animation: 'popIn .3s ease' },
  reviewCard: { background: T.surface, backdropFilter: 'blur(20px)', maxWidth: '560px', width: '100%', borderRadius: '18px', overflow: 'hidden', boxShadow: '0 30px 80px rgba(0,0,0,0.6)', maxHeight: '84vh', display: 'flex', flexDirection: 'column', border: `1px solid ${T.border}`, animation: 'popIn .25s ease' },
  dock: { width: '288px', background: T.surface, backdropFilter: 'blur(20px)', borderRadius: '14px', boxShadow: '0 20px 50px rgba(0,0,0,0.55)', overflow: 'hidden', border: `1px solid ${T.border}`, animation: 'popIn .2s ease' },
  dockClose: { background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', width: '24px', height: '24px', borderRadius: '50%', cursor: 'pointer', fontSize: '0.72rem', fontWeight: 800, display: 'flex', alignItems: 'center', justifyContent: 'center' },
  dockCloseDark: { background: 'rgba(148,163,184,0.12)', border: `1px solid ${T.border}`, color: T.muted, width: '30px', height: '30px', borderRadius: '8px', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 800 },
  ghostBtn: { padding: '0.7rem 1.6rem', border: `1px solid ${T.border}`, background: 'rgba(148,163,184,0.06)', cursor: 'pointer', borderRadius: '10px', fontWeight: 800, fontSize: '0.8rem', color: T.muted, letterSpacing: '1px', transition: 'all .15s' },
  ctaBtn: { padding: '0.75rem 2.2rem', border: 'none', background: `linear-gradient(135deg,${T.green},#047857)`, color: '#04110a', cursor: 'pointer', borderRadius: '10px', fontWeight: 900, fontSize: '0.88rem', letterSpacing: '1.5px', boxShadow: `0 8px 24px ${T.green}44`, transition: 'all .15s' },
  dangerBtn: { padding: '0.7rem 1.6rem', border: 'none', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', color: '#fff', cursor: 'pointer', borderRadius: '10px', fontWeight: 900, fontSize: '0.8rem', letterSpacing: '1px', boxShadow: '0 6px 20px rgba(239,68,68,0.35)' },
};

// ==================== MAIN COMPONENT ====================
const TakeTest = () => {
  const { testId } = useParams();
  const navigate = useNavigate();
  const { hideLayout, showLayout } = useLayout();
  const containerRef = useRef(null);
  const layoutRestored = useRef(false);
  const submittedRef = useRef(false);
  const timerInit = useRef(false);
  const timerLive = useRef(false);
  const qStart = useRef(null);
  const autosaveInt = useRef(null);
  const simFsRef = useRef(false);
  const tabViolationRef = useRef(false);   // tracks an unresolved tab-switch violation
  const doSubmitRef = useRef(null);        // always-latest submit fn (avoids stale closure)
  const tabSubmitTimer = useRef(null);     // holds auto-submit timeout for cleanup
  useGlobalStyles();

  // ---------- STATE ----------
  const [qIndex, setQIndex] = useState(0);
  const [answers, setAnswers] = useState([]);
  const [flagged, setFlagged] = useState(new Set());
  const [timeLeft, setTimeLeft] = useState(0);
  const [started, setStarted] = useState(false);
  const [showInstructions, setShowInstructions] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [showReview, setShowReview] = useState(false);
  const [showCalc, setShowCalc] = useState(false);
  const [showScratch, setShowScratch] = useState(false);
  const [scratch, setScratch] = useState('');
  const [fontStep, setFontStep] = useState(1);
  const [soundOn, setSoundOn] = useState(true);
  const [isFs, setIsFs] = useState(false);
  const [tabSwitches, setTabSwitches] = useState(0);
  const [showTabWarn, setShowTabWarn] = useState(false);
  const [showCandidate, setShowCandidate] = useState(false);
  const [filter, setFilter] = useState('all');
  const [timings, setTimings] = useState({});
  const [savedAt, setSavedAt] = useState(null);
  const [showHint, setShowHint] = useState(true);
  const [hoveredOpt, setHoveredOpt] = useState(null);
  const [showPassage, setShowPassage] = useState(true);
  
  // VIEWPORT TRACKING (Height + Width)
  const [vh, setVh] = useState(() => (typeof window !== 'undefined' ? window.innerHeight : 800));
  const [vw, setVw] = useState(() => (typeof window !== 'undefined' ? window.innerWidth : 1200));
  const [showPaletteMobile, setShowPaletteMobile] = useState(false);

  useEffect(() => {
    const onResize = () => { setVh(window.innerHeight); setVw(window.innerWidth); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  const isMobile = vw < 768;

  useEffect(() => { SoundEngine.enabled = soundOn; SoundEngine.init(); }, [soundOn]);

  // ---------- DATA ----------
  const { data: testData, isLoading, error } = useQuery({
    queryKey: ['test', testId],
    queryFn: () => studentAPI.getTestById(testId),
    enabled: !!testId,
    refetchOnWindowFocus: false,
  });
  const test = testData?.data;

  const backendSubmitted = test?.submitted === true || test?.isCompleted === true || test?.hasSubmitted === true ||
    (test?.submission !== null && test?.submission !== undefined) || test?.status === 'completed' || test?.status === 'submitted';
  const alreadySubmitted = backendSubmitted || submittedRef.current || getSubmittedTests().includes(testId);

  // ---------- SUBMIT MUTATION ----------
  const submitMutation = useMutation({
    mutationFn: ({ testId, answers }) => studentAPI.submitTest(testId, answers),
    onSuccess: (data) => {
      SoundEngine.play('submit');
      submittedRef.current = true;
      markTestAsSubmitted(testId);
      clearAutoSave(testId);
      jsExitFs();
      restoreLayout();
      navigate('/student/dashboard', { replace: true, state: { testSubmitted: true, submittedTestId: testId, result: data.data } });
    },
    onError: (err) => {
      SoundEngine.play('error');
      submittedRef.current = false;
      setShowTabWarn(false);
      alert(err.response?.data?.message || 'Failed to submit test. Please try again.');
    },
  });

  // ---------- REDIRECT IF SUBMITTED ----------
  useEffect(() => {
    if (alreadySubmitted && !isLoading) {
      submittedRef.current = true;
      restoreLayout();
      navigate('/student/dashboard', { replace: true, state: { testAlreadyTaken: true, submittedTestId: testId } });
    }
  }, [alreadySubmitted, isLoading]); // eslint-disable-line

  // ---------- INIT ANSWERS + RESTORE ----------
  useEffect(() => {
    if (!test?.questions?.length) return;
    setAnswers((prev) => prev.length === test.questions.length ? prev : Array(test.questions.length).fill(null));
    if (!started) {
      const saved = loadAutoSave(testId);
      if (saved?.answers?.length === test.questions.length) {
        if (window.confirm(`A previous session was found (saved ${new Date(saved.savedAt).toLocaleTimeString()}).\n\nRestore your previous answers?`)) {
          setAnswers(saved.answers);
          setFlagged(new Set(saved.flagged || []));
          setTimings(saved.timings || {});
          setScratch(saved.scratchContent || '');
        }
      }
    }
  }, [test?.questions?.length]); // eslint-disable-line

  // ---------- TIMER ----------
  useEffect(() => {
    if (test?.duration && timeLeft === 0 && !alreadySubmitted && started && !timerInit.current) {
      timerInit.current = true;
      setTimeLeft(test.duration * 60);
    }
  }, [test, timeLeft, alreadySubmitted, started]);

  useEffect(() => {
    if (timeLeft <= 0 || alreadySubmitted || !timerInit.current) return;
    const id = setInterval(() => setTimeLeft(p => p - 1), 1000);
    return () => clearInterval(id);
  }, [timeLeft > 0, alreadySubmitted]); // eslint-disable-line

  useEffect(() => {
    if (timeLeft > 0 && timerInit.current) timerLive.current = true;
    if ((timeLeft === 60 || timeLeft === 30) && started) SoundEngine.play('warning');
  }, [timeLeft, started]);

  useEffect(() => {
    if (timeLeft === 0 && test && !alreadySubmitted && timerLive.current) {
      submittedRef.current = true;
      markTestAsSubmitted(testId);
      clearAutoSave(testId);
      submitMutation.mutate({ testId: test._id, answers });
    }
  }, [timeLeft, test, alreadySubmitted, answers]); // eslint-disable-line

  useEffect(() => {
    if (timeLeft === 0 && !submitMutation.isPending && submittedRef.current && timerLive.current) {
      const t = setTimeout(() => {
        jsExitFs(); restoreLayout();
        navigate('/student/dashboard', { replace: true, state: { testSubmitted: true, submittedTestId: testId } });
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [timeLeft, submitMutation.isPending]); // eslint-disable-line

  // ---------- PER-QUESTION TIMING ----------
  useEffect(() => {
    if (!started || alreadySubmitted) return;
    qStart.current = Date.now();
    return () => {
      if (qStart.current) {
        const el = Math.floor((Date.now() - qStart.current) / 1000);
        if (el > 0) setTimings(p => ({ ...p, [qIndex]: (p[qIndex] || 0) + el }));
      }
    };
  }, [qIndex, started, alreadySubmitted]);

  // ---------- AUTOSAVE ----------
  useEffect(() => {
    if (!started || alreadySubmitted) return;
    autosaveInt.current = setInterval(() => {
      autoSaveAnswers(testId, answers, flagged, timings, scratch);
      setSavedAt(new Date());
    }, 10000);
    return () => clearInterval(autosaveInt.current);
  }, [started, alreadySubmitted, testId, answers, flagged, timings, scratch]);

  // ---------- LAYOUT KILL ----------
  const hideFullLayout = useCallback(() => {
    hideLayout();
    ['nav', 'aside', '[role="navigation"]', '[role="complementary"]', '.sidebar', '.side-bar', '.navbar', '.nav-bar', '.topbar', '.top-bar', '[class*="sidebar"]', '[class*="Sidebar"]', '[class*="navbar"]', '[class*="Navbar"]', '[class*="topbar"]', '[class*="Topbar"]', '[id*="sidebar"]', '[id*="navbar"]', '[id*="topbar"]'].forEach(sel => {
      document.querySelectorAll(sel).forEach(el => { if (!el.closest('[data-cbt-root]')) el.setAttribute('data-cbt-hidden', 'true'); });
    });
    document.body.style.overflow = 'hidden'; document.body.style.margin = '0'; document.body.style.padding = '0';
    if (!document.getElementById('cbt-layout-styles')) {
      const s = document.createElement('style'); s.id = 'cbt-layout-styles';
      s.textContent = `[data-cbt-hidden="true"]{display:none!important}`;
      document.head.appendChild(s);
    }
  }, [hideLayout]);

  const restoreLayout = useCallback(() => {
    if (layoutRestored.current) return;
    layoutRestored.current = true;
    showLayout();
    document.querySelectorAll('[data-cbt-hidden]').forEach(el => el.removeAttribute('data-cbt-hidden'));
    document.getElementById('cbt-layout-styles')?.remove();
    document.body.style.overflow = ''; document.body.style.margin = ''; document.body.style.padding = '';
  }, [showLayout]);

  // ---------- FULLSCREEN ----------
  const lockBody = () => { document.body.style.overflow = 'hidden'; document.body.style.margin = '0'; document.body.style.padding = '0'; document.documentElement.style.overflow = 'hidden'; document.documentElement.style.margin = '0'; document.documentElement.style.padding = '0'; };
  const unlockBody = () => { document.body.style.overflow = ''; document.body.style.margin = ''; document.body.style.padding = ''; document.documentElement.style.overflow = ''; document.documentElement.style.margin = ''; document.documentElement.style.padding = ''; };

  const preventScroll = useCallback((e) => { if (simFsRef.current) { e.preventDefault(); e.stopPropagation(); } }, []);
  const preventScrollKeys = useCallback((e) => { if (simFsRef.current && ['Space', 'ArrowUp', 'ArrowDown', 'PageUp', 'PageDown'].includes(e.code)) { if (e.target.tagName !== 'INPUT' && e.target.tagName !== 'TEXTAREA') e.preventDefault(); } }, []);

  const jsEnterFs = useCallback(async () => {
    lockBody();
    try {
      const el = document.documentElement;
      if (el.requestFullscreen) await el.requestFullscreen();
      else if (el.webkitRequestFullscreen) await el.webkitRequestFullscreen();
      else throw new Error('no native fs');
      setIsFs(true);
    } catch {
      simFsRef.current = true;
      if (!document.getElementById('cbt-fs-styles')) {
        const s = document.createElement('style'); s.id = 'cbt-fs-styles';
        s.textContent = `.cbt-simfs{position:fixed!important;inset:0!important;width:100vw!important;height:100vh!important;z-index:999999!important;margin:0!important;padding:0!important;border:none!important;border-radius:0!important;overflow:hidden!important}`;
        document.head.appendChild(s);
      }
      containerRef.current?.classList.add('cbt-simfs');
      window.addEventListener('wheel', preventScroll, { passive: false });
      window.addEventListener('touchmove', preventScroll, { passive: false });
      window.addEventListener('keydown', preventScrollKeys, { passive: false });
      setIsFs(true);
    }
  }, [preventScroll, preventScrollKeys]);

  const jsExitFs = useCallback(async () => {
    try { if (document.fullscreenElement) await document.exitFullscreen(); else if (document.webkitFullscreenElement) await document.webkitExitFullscreen(); } catch {}
    simFsRef.current = false;
    containerRef.current?.classList.remove('cbt-simfs');
    document.getElementById('cbt-fs-styles')?.remove();
    window.removeEventListener('wheel', preventScroll);
    window.removeEventListener('touchmove', preventScroll);
    window.removeEventListener('keydown', preventScrollKeys);
    unlockBody();
    setIsFs(false);
  }, [preventScroll, preventScrollKeys]);

  useEffect(() => {
    const onFsChange = () => setIsFs(!!(document.fullscreenElement || document.webkitFullscreenElement));
    document.addEventListener('fullscreenchange', onFsChange);
    document.addEventListener('webkitfullscreenchange', onFsChange);
    return () => { document.removeEventListener('fullscreenchange', onFsChange); document.removeEventListener('webkitfullscreenchange', onFsChange); };
  }, []);

  // ---------- LIFECYCLE LAYOUT ----------
  useEffect(() => {
    if (alreadySubmitted || isLoading) return;
    hideFullLayout();
    return () => { restoreLayout(); jsExitFs(); };
  }, [alreadySubmitted, isLoading]); // eslint-disable-line

  // ---------- ANTI-CHEAT LISTENERS ----------
  useEffect(() => {
    if (!started || alreadySubmitted) return;
    const noCtx = (e) => e.preventDefault();
    const noCopy = (e) => e.preventDefault();
    const noPaste = (e) => e.preventDefault();
    const noLeave = (e) => { e.preventDefault(); e.returnValue = ''; };
    const onVis = () => {
      if (document.hidden) {
        setTabSwitches(p => p + 1);
        SoundEngine.play('warning');
        tabViolationRef.current = true;
      } else if (tabViolationRef.current) {
        tabViolationRef.current = false;
        SoundEngine.play('warning');
        setShowTabWarn(true);
        tabSubmitTimer.current = setTimeout(() => doSubmitRef.current?.(), 1500);
      }
    };
    document.addEventListener('contextmenu', noCtx);
    document.addEventListener('copy', noCopy);
    document.addEventListener('paste', noPaste);
    window.addEventListener('beforeunload', noLeave);
    document.addEventListener('visibilitychange', onVis);
    return () => {
      document.removeEventListener('contextmenu', noCtx);
      document.removeEventListener('copy', noCopy);
      document.removeEventListener('paste', noPaste);
      window.removeEventListener('beforeunload', noLeave);
      document.removeEventListener('visibilitychange', onVis);
      clearTimeout(tabSubmitTimer.current);
    };
  }, [started, alreadySubmitted]);

  // ---------- KEYBOARD SHORTCUTS ----------
  useEffect(() => {
    if (!started || showInstructions) return;
    const handler = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
      const k = e.key.toLowerCase();
      if (['a', 'b', 'c', 'd', 'e'].includes(k)) {
        const idx = k.charCodeAt(0) - 97;
        if (test?.questions?.[qIndex]?.options?.[idx] !== undefined) choose(idx);
      } else if (e.key === 'ArrowRight') next();
      else if (e.key === 'ArrowLeft') prev();
      else if (k === 'f') { e.preventDefault(); isFs ? jsExitFs() : jsEnterFs(); }
      else if (k === 's') { e.preventDefault(); setShowReview(true); }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [started, showInstructions, qIndex, answers, isFs]); // eslint-disable-line

  useEffect(() => { const t = setTimeout(() => setShowHint(false), 8000); return () => clearTimeout(t); }, [started]);

  // ---------- ACTIONS ----------
  const choose = (oi) => {
    SoundEngine.play('select');
    setAnswers(p => { const n = [...p]; n[qIndex] = n[qIndex] === oi ? null : oi; return n; });
  };
  const goto = (i) => setQIndex(i);
  const next = () => setQIndex(p => Math.min(p + 1, (test?.questions?.length || 1) - 1));
  const prev = () => setQIndex(p => Math.max(p - 1, 0));
  const toggleFlag = () => {
    SoundEngine.play(flagged.has(qIndex) ? 'unflag' : 'flag');
    setFlagged(p => { const n = new Set(p); n.has(qIndex) ? n.delete(qIndex) : n.add(qIndex); return n; });
  };
  const startExam = () => {
    SoundEngine.play('submit');
    setShowInstructions(false);
    setStarted(true);
    jsEnterFs();
  };
  const doSubmit = () => {
    if (!test || submittedRef.current || submitMutation.isPending) return;
    setShowConfirm(false); setShowReview(false);
    submittedRef.current = true;
    markTestAsSubmitted(testId);
    clearAutoSave(testId);
    submitMutation.mutate({ testId: test._id, answers });
  };
  doSubmitRef.current = doSubmit;

  // ---------- DERIVED ----------
  const total = test?.questions?.length || 0;
  const answeredCount = useMemo(() => answers.filter(a => a !== null).length, [answers]);
  const frac = test ? timeLeft / (test.duration * 60 || 1) : 1;
  const urgColor = frac > 0.25 ? T.green : frac > 0.1 ? T.gold : T.red;
  const fontSizes = [0.95, 1.08, 1.25];
  const qFont = fontSizes[fontStep];
  const filteredIdx = useMemo(() => {
    const all = test?.questions?.map((_, i) => i) || [];
    if (filter === 'all') return all;
    return all.filter(i => filter === 'answered' ? answers[i] !== null : filter === 'unanswered' ? answers[i] === null : flagged.has(i));
  }, [filter, answers, flagged, test]);
  const q = test?.questions?.[qIndex];
  const isLast = qIndex === total - 1;

  // ==================== FIT-TO-SCREEN ADAPTIVE SIZING ====================
  const compact = !isMobile && vh < 820;    // small/medium laptops (e.g. 1366×768)
  const tight = !isMobile && vh < 640;      // very short screens
  const headerMinH = isMobile ? 48 : tight ? 46 : compact ? 54 : 60;
  const headerPad = isMobile ? '0.5rem 0.8rem' : tight ? '0.35rem 0.7rem' : compact ? '0.45rem 0.85rem' : '0.55rem 1rem';
  const bodyPad = isMobile ? '0.5rem' : tight ? '0.5rem 0.7rem' : compact ? '0.7rem 0.85rem' : '0.9rem 1rem';
  const cardPad = isMobile ? '0.75rem 1rem' : tight ? '0.6rem 1rem 0.7rem' : compact ? '0.9rem 1.2rem 1rem' : '1.4rem 1.6rem 1.6rem';
  const cardGap = isMobile ? 8 : tight ? 6 : compact ? 8 : 12;
  const optGap = isMobile ? 6 : tight ? 4 : compact ? 6 : 8;
  const optPadY = isMobile ? '0.45rem' : tight ? '0.22rem' : compact ? '0.3rem' : '0.4rem';
  const optFont = qFont * (isMobile ? 0.9 : tight ? 0.76 : compact ? 0.82 : 0.88);
  const letterSize = isMobile ? 26 : tight ? 22 : compact ? 26 : 30;
  const footerPad = isMobile ? '0.6rem 1rem' : tight ? '0.45rem 1rem' : compact ? '0.55rem 1.2rem' : '0.85rem 1.4rem';
  const paletteW = compact ? '218px' : '264px';
  const paletteGap = compact ? 4 : 6;
  
  const qBaseVH = tight ? 20 : compact ? 24 : 28;
  // On mobile, allow it to be natural, otherwise enforce 2.25x original scaled height
  const qBoxMinH = isMobile ? 'auto' : `${Math.round(qBaseVH * 2.25)}vh`;
  const optsMaxH = isMobile ? 'none' : tight ? '24vh' : '28vh';

  // ==================== STATES ====================
  if (isLoading) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.text, gap: '1.2rem' }}>
      <div style={{ width: '64px', height: '64px', borderRadius: '18px', background: `linear-gradient(135deg,${T.green},#065f46)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.8rem', boxShadow: `0 0 40px ${T.green}44`, animation: 'pulseGreen 1.6s infinite' }}>🎓</div>
      <div style={{ width: '180px', height: '4px', borderRadius: '4px', background: 'rgba(148,163,184,0.12)', overflow: 'hidden' }}>
        <div style={{ width: '60px', height: '100%', borderRadius: '4px', background: `linear-gradient(90deg,transparent,${T.green},transparent)`, animation: 'shimmer 1.2s infinite', backgroundSize: '500px 100%' }} />
      </div>
      <div style={{ fontSize: '0.75rem', color: T.muted, letterSpacing: '2px' }}>LOADING EXAMINATION…</div>
    </div>
  );

  if (error || !test || !test.questions?.length) return (
    <div style={{ minHeight: '100vh', background: T.bg, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: T.text, gap: '1rem', padding: '2rem' }}>
      <div style={{ fontSize: '3rem' }}>{error ? '⚠️' : '📭'}</div>
      <div style={{ fontSize: '1.05rem', color: '#cbd5e1', textAlign: 'center' }}>{error ? 'Failed to load this test.' : 'No questions available for this test.'}</div>
      <button onClick={() => { restoreLayout(); navigate('/student/dashboard'); }} style={popStyles.ghostBtn}>← BACK TO DASHBOARD</button>
    </div>
  );

  // ==================== OPTION STYLE HELPER ====================
  const optStyle = (oi) => {
    const sel = answers[qIndex] === oi, hov = hoveredOpt === oi;
    return {
      display: 'flex', alignItems: 'center', gap: compact || isMobile ? '0.6rem' : '0.85rem',
      padding: `${optPadY} ${compact || isMobile ? '0.75rem' : '1rem'}`,
      border: `2px solid ${sel ? T.green : hov ? 'rgba(34,197,94,0.4)' : T.border}`,
      background: sel ? `linear-gradient(135deg, rgba(34,197,94,0.18), rgba(4,120,87,0.12))` : hov ? 'rgba(34,197,94,0.06)' : 'rgba(148,163,184,0.04)',
      borderRadius: compact || isMobile ? '10px' : '12px', cursor: 'pointer', transition: 'all .18s ease', textAlign: 'left', width: '100%',
      color: sel ? T.text : '#cbd5e1',
      boxShadow: sel ? `0 4px 16px rgba(34,197,94,0.2)` : 'none',
      minHeight: 0, maxHeight: tight && !isMobile ? '52px' : '64px', overflowY: 'auto', overflowX: 'hidden',
    };
  };

  const letterStyle = (oi) => {
    const sel = answers[qIndex] === oi;
    return {
      width: `${letterSize}px`, height: `${letterSize}px`, borderRadius: '50%', flexShrink: 0, fontSize: compact || isMobile ? '0.68rem' : '0.78rem',
      display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 900, transition: 'all .18s',
      border: `2px solid ${sel ? T.green : 'rgba(148,163,184,0.3)'}`,
      background: sel ? `linear-gradient(135deg,${T.green},#047857)` : 'rgba(148,163,184,0.08)',
      color: sel ? '#04110a' : T.muted,
      boxShadow: sel ? `0 0 12px ${T.green}66` : 'none',
    };
  };

  // ==================== PALETTE CONTENT REUSABLE ====================
  const PaletteContent = (
    <>
      <div style={{ padding: '0.9rem 1rem', borderBottom: `1px solid ${T.border}` }}>
        <div style={{ fontWeight: 900, fontSize: '0.72rem', letterSpacing: '2px', color: T.green }}>🗺️ QUESTIONS</div>
        <div style={{ fontSize: '0.62rem', color: T.muted, marginTop: '2px' }}>{answeredCount} answered · {total - answeredCount} remaining · {flagged.size} flagged</div>
      </div>
      <div style={{ display: 'flex', gap: '4px', padding: '0.6rem 0.8rem', flexWrap: 'wrap' }}>
        {[['all', 'ALL'], ['answered', '✅ DONE'], ['unanswered', '❌ LEFT'], ['flagged', '🚩 FLAG']].map(([f, label]) => (
          <button key={f} onClick={() => setFilter(f)} style={{ fontSize: '0.56rem', fontWeight: 800, padding: '0.3rem 0.55rem', borderRadius: '20px', cursor: 'pointer', border: `1px solid ${filter === f ? T.green : T.border}`, background: filter === f ? `${T.green}22` : 'transparent', color: filter === f ? T.green : T.muted, letterSpacing: '0.5px' }}>
            {label}
          </button>
        ))}
      </div>
      <div style={{ flex: 1, overflowY: 'auto', padding: '0.3rem 0.8rem 0.8rem', display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: `${paletteGap}px`, alignContent: 'start' }}>
        {filteredIdx.map(i => {
          const cur = i === qIndex, ans = answers[i] !== null, flg = flagged.has(i);
          return (
            <button key={i} onClick={() => { goto(i); if (isMobile) setShowPaletteMobile(false); }} style={{
              position: 'relative', padding: compact || isMobile ? '0.4rem 0' : '0.5rem 0', borderRadius: '9px', cursor: 'pointer', fontWeight: 800, fontSize: '0.72rem',
              border: `1px solid ${cur ? T.green : ans ? `${T.green}55` : flg ? `${T.gold}55` : T.border}`,
              background: cur ? `linear-gradient(135deg,${T.green},#047857)` : ans ? 'rgba(34,197,94,0.14)' : flg ? 'rgba(245,158,11,0.14)' : 'rgba(148,163,184,0.06)',
              color: cur ? '#04110a' : ans ? T.green : flg ? T.gold : T.muted,
              boxShadow: cur ? `0 0 12px ${T.green}66` : 'none', transition: 'all .12s',
            }}>
              {i + 1}
              {flg && <span style={{ position: 'absolute', top: '-5px', right: '-3px', fontSize: '0.55rem' }}>🚩</span>}
            </button>
          );
        })}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '3px', padding: '0 0.9rem 0.7rem', fontSize: '0.56rem', color: T.dim }}>
        <span>🟩 Answered</span><span>⬜ Current</span>
        <span>🟨 Flagged</span><span>▫️ Unanswered</span>
      </div>
      <div style={{ padding: '0.8rem', borderTop: `1px solid ${T.border}` }}>
        <button onClick={() => setShowConfirm(true)} style={{ ...popStyles.dangerBtn, width: '100%' }}>SUBMIT TEST</button>
      </div>
    </>
  );

  // ==================== MAIN RENDER ====================
  return (
    <div ref={containerRef} data-cbt-root className={compact ? 'cbt-compact' : ''}
      style={{ height: isMobile ? '100dvh' : '100vh', maxHeight: isMobile ? '100dvh' : '100vh', background: T.bg, color: T.text, fontFamily: T.font, display: 'flex', flexDirection: 'column', overflow: 'hidden', position: 'relative', paddingBottom: isMobile ? '56px' : 0 }}>
      {/* Ambient background glows */}
      <div style={{ position: 'fixed', width: '480px', height: '480px', top: '-160px', right: '-120px', borderRadius: '50%', background: `radial-gradient(circle, ${T.greenDeep}44, transparent 70%)`, filter: 'blur(60px)', animation: 'floatBg 12s ease-in-out infinite', pointerEvents: 'none' }} />
      <div style={{ position: 'fixed', width: '420px', height: '420px', bottom: '-160px', left: '-120px', borderRadius: '50%', background: 'radial-gradient(circle, rgba(56,189,248,0.1), transparent 70%)', filter: 'blur(60px)', animation: 'floatBg 15s ease-in-out infinite reverse', pointerEvents: 'none' }} />

      {/* ============ TOP BAR ============ */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: headerPad, background: `linear-gradient(135deg, #052e1a, #021208 70%)`, borderBottom: `1px solid ${T.greenDeep}`, boxShadow: `0 4px 24px rgba(0,0,0,0.5)`, flexShrink: 0, zIndex: 20, minHeight: `${headerMinH}px`, gap: '0.6rem' }}>
        {/* Logo + subject */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.7rem', minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexShrink: 0 }}>
            <div style={{ width: compact || isMobile ? '32px' : '38px', height: compact || isMobile ? '32px' : '38px', borderRadius: '11px', background: `linear-gradient(135deg,${T.green},#047857)`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: compact || isMobile ? '1rem' : '1.15rem', boxShadow: `0 4px 14px ${T.green}55` }}>🎓</div>
            {!isMobile && (
              <div style={{ lineHeight: 1.15 }}>
                <div style={{ fontWeight: 900, fontSize: compact ? '0.75rem' : '0.85rem', letterSpacing: '3px', color: T.green }}>BimTech CBT</div>
                <div style={{ fontSize: '0.53rem', color: T.muted, letterSpacing: '2px' }}>EXAMINATION PORTAL</div>
              </div>
            )}
          </div>
          {!isMobile && <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)' }} />}
          {!isMobile && (
            <div style={{ minWidth: 0, animation: 'fadeUp .4s ease' }}>
              <div style={{ fontSize: compact ? '0.74rem' : '0.82rem', fontWeight: 800, color: T.text, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>📚 {test.subjectId?.name || 'General'}</div>
              <div style={{ fontSize: '0.6rem', color: T.muted, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{test.title}</div>
            </div>
          )}
        </div>

        {/* Right cluster */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexShrink: 0 }}>
          {!isMobile && savedAt && (
            <div style={{ fontSize: '0.58rem', color: T.green, background: `${T.green}14`, border: `1px solid ${T.green}33`, padding: '0.25rem 0.55rem', borderRadius: '20px', fontWeight: 700, animation: 'fadeIn .3s ease' }}>
              💾 Saved {savedAt.toLocaleTimeString()}
            </div>
          )}

          {/* Tools hidden on mobile (moved to bottom bar) */}
          {!isMobile && (
            <>
              {[
                { icon: soundOn ? '🔊' : '🔇', fn: () => setSoundOn(s => !s), title: 'Sound' },
                { icon: <span style={{ fontSize: '0.62rem', fontWeight: 900 }}>A{['₋', ' ', '+'][fontStep]}</span>, fn: () => setFontStep(s => (s + 1) % 3), title: 'Font size' },
                { icon: '🧮', fn: () => { setShowCalc(s => !s); setShowScratch(false); }, title: 'Calculator', active: showCalc },
                { icon: '📝', fn: () => { setShowScratch(s => !s); setShowCalc(false); }, title: 'Scratch pad', active: showScratch },
                { icon: isFs ? '🗗' : '⛶', fn: () => (isFs ? jsExitFs() : jsEnterFs()), title: 'Fullscreen (F)' },
              ].map((b, i) => (
                <button key={i} onClick={b.fn} title={b.title} style={{
                  background: b.active ? `${T.greenDeep}88` : 'rgba(255,255,255,0.06)',
                  border: `1px solid ${b.active ? T.green : 'rgba(255,255,255,0.1)'}`,
                  color: '#fff', cursor: 'pointer', padding: compact ? '0.32rem 0.5rem' : '0.42rem 0.58rem', borderRadius: '9px',
                  fontSize: compact ? '0.75rem' : '0.85rem', display: 'flex', alignItems: 'center', transition: 'all .15s',
                }}>{b.icon}</button>
              ))}
            </>
          )}

          {!isMobile && <div style={{ width: '1px', height: '28px', background: 'rgba(255,255,255,0.12)' }} />}

          {/* TIMER RING */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <Ring pct={frac} size={isMobile ? 34 : compact ? 40 : 46} stroke={4} color={urgColor} animate={frac <= 0.1}>
              <span style={{ fontFamily: T.mono, fontSize: isMobile ? '0.5rem' : compact ? '0.53rem' : '0.6rem', fontWeight: 800, color: urgColor }}>{fmtTime(timeLeft)}</span>
            </Ring>
            {!isMobile && (
              <div style={{ lineHeight: 1.2 }}>
                <div style={{ fontSize: '0.55rem', color: T.muted, letterSpacing: '1.5px', fontWeight: 700 }}>TIME LEFT</div>
                <div style={{ fontFamily: T.mono, fontSize: compact ? '0.92rem' : '1.05rem', fontWeight: 800, color: urgColor, textShadow: `0 0 12px ${urgColor}55`, animation: frac <= 0.1 ? 'blink 1s infinite' : 'none' }}>{fmtTime(timeLeft)}</div>
              </div>
            )}
          </div>

          {/* Candidate + Review + Submit */}
          {!isMobile && <button onClick={() => setShowCandidate(true)} title="Candidate details" style={{ background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', cursor: 'pointer', padding: compact ? '0.32rem 0.5rem' : '0.42rem 0.58rem', borderRadius: '9px', fontSize: compact ? '0.75rem' : '0.85rem', display: 'flex', alignItems: 'center' }}>👤</button>}
          
          {isMobile ? (
            <button onClick={() => setShowReview(true)} style={{ background: 'rgba(14,116,144,0.4)', color: '#fff', border: `1px solid ${T.blue}44`, cursor: 'pointer', padding: '0.4rem 0.6rem', borderRadius: '9px', fontSize: '0.8rem' }}>📋</button>
          ) : (
            <button onClick={() => setShowReview(true)} style={{ background: 'linear-gradient(135deg,#0e7490,#155e75)', color: '#fff', border: 'none', cursor: 'pointer', padding: compact ? '0.38rem 0.7rem' : '0.5rem 0.9rem', borderRadius: '9px', fontWeight: 800, fontSize: compact ? '0.62rem' : '0.7rem', letterSpacing: '1px', boxShadow: '0 4px 14px rgba(14,116,144,0.4)', whiteSpace: 'nowrap' }}>
              📋 REVIEW {answeredCount}/{total}
            </button>
          )}
          
          <button onClick={() => setShowConfirm(true)} style={{ ...popStyles.dangerBtn, padding: isMobile ? '0.4rem 0.8rem' : compact ? '0.38rem 0.8rem' : '0.5rem 1rem', fontSize: isMobile ? '0.68rem' : compact ? '0.64rem' : '0.72rem', whiteSpace: 'nowrap' }}>🏁 {isMobile ? '' : 'SUBMIT'}</button>
        </div>
      </header>

      {/* ============ MAIN BODY ============ */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden', padding: bodyPad, gap: isMobile ? 0 : (compact ? '0.7rem' : '1rem'), flexDirection: isMobile ? 'column' : 'row', minHeight: 0 }}>

        {/* ===== QUESTION CARD ===== */}
        <main style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', background: T.surface, backdropFilter: 'blur(20px)', border: `1px solid ${T.border}`, borderRadius: isMobile ? '12px' : '18px', overflow: 'hidden' }}>

          {/* Passage (collapsible) */}
          {q?.passageText && (
            <div style={{ margin: isMobile ? '0.5rem 1rem 0' : compact ? '0.6rem 1rem 0' : '1rem 1.6rem 0', flexShrink: 0 }}>
              <button onClick={() => setShowPassage(s => !s)} style={{ width: '100%', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(56,189,248,0.08)', border: '1px solid rgba(56,189,248,0.3)', borderRadius: '10px', padding: compact || isMobile ? '0.4rem 0.8rem' : '0.55rem 0.9rem', cursor: 'pointer', color: T.blue, fontWeight: 800, fontSize: compact || isMobile ? '0.64rem' : '0.72rem', letterSpacing: '1px' }}>
                <span>📖 PASSAGE</span><span>{showPassage ? '▲' : '▼'}</span>
              </button>
              {showPassage && (
                <div style={{ marginTop: '0.5rem', background: 'rgba(56,189,248,0.05)', border: '1px solid rgba(56,189,248,0.22)', borderRadius: '12px', padding: compact || isMobile ? '0.6rem 0.9rem' : '1rem 1.2rem', fontSize: compact || isMobile ? '0.78rem' : '0.88rem', lineHeight: 1.7, color: '#dbeafe', maxHeight: compact || isMobile ? '110px' : '170px', overflowY: 'auto' }}
                  dangerouslySetInnerHTML={{ __html: formatMathText(q.passageText) }} />
              )}
            </div>
          )}

          {/* Question area (flexible — scrolls internally if content is very long) */}
          <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column', overflowY: 'auto', overflowX: 'hidden', padding: cardPad, gap: `${cardGap}px` }}>

            {/* Question meta row */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap', flexShrink: 0 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem', flexWrap: 'wrap' }}>
                <span style={{ background: `${T.green}1c`, color: T.green, border: `1px solid ${T.green}44`, fontWeight: 900, fontSize: compact || isMobile ? '0.62rem' : '0.7rem', letterSpacing: '1px', padding: compact || isMobile ? '0.28rem 0.65rem' : '0.35rem 0.8rem', borderRadius: '8px' }}>
                  QUESTION {qIndex + 1} OF {total}
                </span>
                {flagged.has(qIndex) && (
                  <span style={{ background: 'rgba(245,158,11,0.14)', color: T.gold, border: `1px solid ${T.gold}55`, fontWeight: 800, fontSize: '0.62rem', padding: '0.3rem 0.6rem', borderRadius: '8px' }}>🚩 FLAGGED</span>
                )}
                {timings[qIndex] !== undefined && <span style={{ fontSize: '0.6rem', color: T.dim }}>⏱ {fmtSecs(timings[qIndex])} here</span>}
              </div>
              <button onClick={toggleFlag} style={{ background: flagged.has(qIndex) ? 'rgba(245,158,11,0.15)' : 'rgba(148,163,184,0.06)', border: `1px solid ${flagged.has(qIndex) ? T.gold : T.border}`, color: flagged.has(qIndex) ? T.gold : T.muted, borderRadius: '9px', padding: compact || isMobile ? '0.3rem 0.7rem' : '0.4rem 0.85rem', cursor: 'pointer', fontWeight: 800, fontSize: compact || isMobile ? '0.6rem' : '0.68rem', letterSpacing: '1px', transition: 'all .15s' }}>
                {flagged.has(qIndex) ? '🚩 UNFLAG' : '🚩 FLAG'}
              </button>
            </div>

            {/* QUESTION CONTAINER */}
            {(() => {
              const { images, clean } = splitImagesFromText(q.questionText);
              const hasImages = images.length > 0;
              return hasImages ? (
                <div style={{
                  minHeight: qBoxMinH,
                  background: 'rgba(2,6,23,0.45)', border: `1px solid ${T.border}`, borderRadius: '14px',
                  padding: compact || isMobile ? '0.6rem' : '0.9rem',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: clean ? (compact || isMobile ? '0.4rem' : '0.6rem') : 0,
                }}>
                  {/* picture(s) on top of the box */}
                  <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', alignItems: 'center', gap: '8px', lineHeight: 0 }}>
                    {images.map((imgHtml, i) => (
                      <div key={i} style={{ lineHeight: 0 }} dangerouslySetInnerHTML={{ __html: formatMathText(imgHtml) }} />
                    ))}
                  </div>
                  {/* text UNDER the picture — same box */}
                  {clean && (
                    <div style={{ width: '100%', textAlign: 'center', fontSize: `${qFont}rem`, color: '#e2e8f0', lineHeight: compact || isMobile ? 1.55 : 1.7, fontWeight: 500 }}
                      dangerouslySetInnerHTML={{ __html: formatMathText(clean) }} />
                  )}
                </div>
              ) : (
                clean && (
                  <div style={{ minHeight: qBoxMinH, display: 'flex', alignItems: 'flex-start', fontSize: `${qFont}rem`, color: '#e2e8f0', lineHeight: compact || isMobile ? 1.55 : 1.75, fontWeight: 500, animation: 'fadeUp .3s ease' }}
                    dangerouslySetInnerHTML={{ __html: formatMathText(clean) }} />
                )
              );
            })()}
          </div>

          {/* COMPACT OPTIONS — 1 per line on mobile, 2 per line on desktop */}
          <div style={{ flexShrink: 0, maxHeight: optsMaxH, overflowY: 'auto', padding: isMobile ? '0.4rem 1rem 0.8rem' : compact ? '0.4rem 1.2rem 0.8rem' : '0.3rem 1.6rem 1.2rem' }}>
            <div style={{ display: 'grid', gridTemplateColumns: isMobile ? '1fr' : 'repeat(2, 1fr)', gap: `${optGap}px` }}>
              {(q.options || []).map((opt, oi) => {
                const count = (q.options || []).length;
                const oddLast = count % 2 === 1 && oi === count - 1 && !isMobile; // lone option takes full row on desktop
                return (
                  <button key={oi} onClick={() => choose(oi)}
                    style={{ ...optStyle(oi), gridColumn: oddLast ? 'span 2' : undefined }}
                    onMouseEnter={() => setHoveredOpt(oi)} onMouseLeave={() => setHoveredOpt(null)}>
                    <span style={letterStyle(oi)}>{String.fromCharCode(65 + oi)}</span>
                    <span style={{ flex: 1, fontSize: `${optFont}rem`, lineHeight: 1.45 }}
                      dangerouslySetInnerHTML={{ __html: formatMathText(opt) }} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Question nav footer */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '0.7rem', padding: footerPad, borderTop: `1px solid ${T.border}`, background: 'rgba(2,6,23,0.45)', flexShrink: 0 }}>
            <button onClick={prev} disabled={qIndex === 0} style={{ padding: isMobile ? '0.45rem 0.8rem' : compact ? '0.45rem 0.9rem' : '0.6rem 1.2rem', borderRadius: '10px', cursor: qIndex === 0 ? 'not-allowed' : 'pointer', fontWeight: 800, fontSize: isMobile ? '0.66rem' : compact ? '0.66rem' : '0.75rem', letterSpacing: '1px', border: `1px solid ${T.border}`, background: 'rgba(148,163,184,0.06)', color: qIndex === 0 ? T.dim : '#cbd5e1', opacity: qIndex === 0 ? 0.5 : 1 }}>
              ← PREV
            </button>
            <div style={{ fontSize: '0.68rem', color: T.muted, fontWeight: 700, textAlign: 'center', letterSpacing: '1px' }}>
              <span style={{ color: T.green }}>{answeredCount}</span>/{total} ANSWERED
            </div>
            {isLast ? (
              <button onClick={() => setShowConfirm(true)} style={{ ...popStyles.dangerBtn, padding: isMobile ? '0.45rem 0.9rem' : compact ? '0.45rem 1rem' : '0.6rem 1.3rem' }}>🏁 FINISH →</button>
            ) : (
              <button onClick={next} style={{ padding: isMobile ? '0.45rem 0.9rem' : compact ? '0.45rem 1rem' : '0.6rem 1.3rem', borderRadius: '10px', cursor: 'pointer', fontWeight: 900, fontSize: isMobile ? '0.66rem' : compact ? '0.66rem' : '0.75rem', letterSpacing: '1px', border: 'none', background: `linear-gradient(135deg,${T.green},#047857)`, color: '#04110a', boxShadow: `0 5px 16px ${T.green}44` }}>
                NEXT →
              </button>
            )}
          </div>
        </main>

        {/* ===== QUESTION PALETTE (Desktop Only) ===== */}
        {!isMobile && (
          <aside style={{ width: paletteW, flexShrink: 0, display: 'flex', flexDirection: 'column', background: T.surface, backdropFilter: 'blur(20px)', border: `1px solid ${T.border}`, borderRadius: '18px', overflow: 'hidden' }}>
            {PaletteContent}
          </aside>
        )}
      </div>

      {/* ===== MOBILE BOTTOM TOOLBAR ===== */}
      {isMobile && (
        <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '56px', display: 'flex', justifyContent: 'space-around', alignItems: 'center', background: 'rgba(2,6,23,0.98)', backdropFilter: 'blur(12px)', borderTop: `1px solid ${T.border}`, zIndex: 200, boxShadow: '0 -4px 20px rgba(0,0,0,0.5)' }}>
          <button onClick={() => setSoundOn(s => !s)} style={mBtnStyle}>{soundOn ? '🔊' : '🔇'}</button>
          <button onClick={() => setFontStep(s => (s + 1) % 3)} style={{...mBtnStyle, fontSize: '0.75rem'}}>A{['₋', ' ', '+'][fontStep]}</button>
          <button onClick={() => { setShowCalc(s => !s); setShowScratch(false); }} style={{...mBtnStyle, color: showCalc ? T.green : '#fff'}}>🧮</button>
          <button onClick={() => { setShowScratch(s => !s); setShowCalc(false); }} style={{...mBtnStyle, color: showScratch ? T.green : '#fff'}}>📝</button>
          <button onClick={() => setShowPaletteMobile(true)} style={mBtnStyle}>🗺️</button>
          <button onClick={() => (isFs ? jsExitFs() : jsEnterFs())} style={mBtnStyle}>{isFs ? '🗗' : '⛶'}</button>
        </div>
      )}

      {/* ===== MOBILE PALETTE DRAWER ===== */}
      {isMobile && showPaletteMobile && (
        <div style={{ ...popStyles.overlay, alignItems: 'flex-end', padding: 0, background: 'rgba(0,0,0,0.6)' }} onClick={() => setShowPaletteMobile(false)}>
          <div style={{ background: T.surface, width: '100%', maxHeight: '75vh', borderRadius: '18px 18px 0 0', overflow: 'hidden', display: 'flex', flexDirection: 'column', border: `1px solid ${T.border}`, animation: 'fadeUp .25s ease' }} onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', padding: '1rem 1.2rem', borderBottom: `1px solid ${T.border}` }}>
              <span style={{ fontWeight: 900, color: T.green, letterSpacing: '1px' }}>QUESTIONS MAP</span>
              <button onClick={() => setShowPaletteMobile(false)} style={popStyles.dockCloseDark}>✕</button>
            </div>
            <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column' }}>
              {PaletteContent}
            </div>
          </div>
        </div>
      )}

      {/* Shortcut hint */}
      {showHint && started && !showTabWarn && !isMobile && (
        <div style={{ position: 'fixed', bottom: '14px', left: '50%', transform: 'translateX(-50%)', background: 'rgba(2,6,23,0.92)', border: `1px solid ${T.green}44`, borderRadius: '30px', padding: '0.45rem 1.1rem', fontSize: '0.63rem', color: T.muted, zIndex: 900, animation: 'fadeUp .4s ease', whiteSpace: 'nowrap', boxShadow: '0 8px 24px rgba(0,0,0,0.5)' }}>
          💡 <b style={{ color: T.green }}>A–E</b> select · <b style={{ color: T.green }}>←/→</b> navigate · <b style={{ color: T.green }}>S</b> review · <b style={{ color: T.green }}>F</b> fullscreen
        </div>
      )}

      {/* Floating docks */}
      {(showCalc || showScratch) && (
        <div style={{ position: 'fixed', bottom: isMobile ? '64px' : '60px', right: isMobile ? '0' : '14px', left: isMobile ? '0' : 'auto', display: 'flex', justifyContent: 'center', padding: isMobile ? '0 1rem' : 0, zIndex: 1500 }}>
          {showCalc && <Calculator onClose={() => setShowCalc(false)} />}
          {showScratch && <ScratchPad value={scratch} onChange={setScratch} onClose={() => setShowScratch(false)} />}
        </div>
      )}

      {/* ============ INSTRUCTIONS ============ */}
      {showInstructions && <InstructionsScreen test={test} onStart={startExam} onClose={() => navigate('/student/dashboard')} />}

      {/* ============ REVIEW PANEL ============ */}
      {showReview && (
        <ReviewPanel test={test} answers={answers} flagged={flagged} timings={timings}
          onClose={() => setShowReview(false)} onGoTo={goto}
          onSubmit={() => { setShowReview(false); setShowConfirm(true); }} />
      )}

      {/* ============ CONFIRM SUBMIT ============ */}
      {showConfirm && (
        <div style={{ ...popStyles.overlay, animation: 'fadeIn .2s ease' }}>
          <div style={{ ...popStyles.reviewCard, maxWidth: '430px', textAlign: 'center', padding: isMobile ? '1.5rem 1.2rem' : '2rem 1.8rem' }} className="cbt-review-card">
            <div style={{ fontSize: '2.6rem', marginBottom: '0.5rem' }}>🏁</div>
            <div style={{ fontWeight: 900, fontSize: '1.05rem', letterSpacing: '2px', color: T.text, marginBottom: '0.7rem' }}>SUBMIT YOUR TEST?</div>
            <div style={{ fontSize: '0.82rem', color: T.muted, lineHeight: 1.75, marginBottom: '1.3rem' }}>
              You answered <b style={{ color: T.green }}>{answeredCount}</b> of <b style={{ color: T.text }}>{total}</b> questions.
              {total - answeredCount > 0 && (<><br /><span style={{ color: T.gold }}>{total - answeredCount} unanswered will be marked wrong.</span></>)}
              <br />You <b style={{ color: T.red }}>cannot</b> retake this test.
            </div>
            <div style={{ display: 'flex', gap: '0.7rem', justifyContent: 'center', flexWrap: 'wrap' }}>
              <button onClick={() => setShowConfirm(false)} disabled={submitMutation.isPending} style={popStyles.ghostBtn}>← KEEP WORKING</button>
              <button onClick={doSubmit} disabled={submitMutation.isPending} style={{ ...popStyles.ctaBtn, background: submitMutation.isPending ? 'rgba(148,163,184,0.3)' : `linear-gradient(135deg,${T.green},#047857)`, boxShadow: submitMutation.isPending ? 'none' : `0 8px 24px ${T.green}44` }}>
                {submitMutation.isPending ? '⏳ SUBMITTING…' : '✓ SUBMIT NOW'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============ TAB SWITCH WARNING + AUTO-SUBMIT ============ */}
      {showTabWarn && (
        <div style={{ ...popStyles.overlay, animation: 'fadeIn .2s ease', zIndex: 3000 }}>
          <div style={{ ...popStyles.reviewCard, maxWidth: '450px', textAlign: 'center', padding: isMobile ? '1.5rem 1.2rem' : '2rem 1.8rem', borderColor: 'rgba(239,68,68,0.4)', animation: 'popIn .25s ease' }} className="cbt-review-card">
            <div style={{ width: '66px', height: '66px', margin: '0 auto 1rem', borderRadius: '18px', background: 'linear-gradient(135deg,#ef4444,#b91c1c)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.9rem', boxShadow: '0 8px 26px rgba(239,68,68,0.5)', animation: 'pulseGlow 1.2s infinite' }}>⚠️</div>
            <div style={{ fontWeight: 900, fontSize: '1.02rem', letterSpacing: '2px', color: T.red, marginBottom: '0.7rem' }}>TAB SWITCH DETECTED!</div>
            <div style={{ fontSize: '0.84rem', color: '#cbd5e1', lineHeight: 1.75, marginBottom: '1.2rem' }}>
              You left the examination screen <b style={{ color: T.red }}>({tabSwitches}×)</b>.<br />
              This has been recorded as malpractice.<br /><br />
              <b style={{ color: T.gold, fontSize: '0.92rem' }}>⏳ Your test is being submitted automatically…</b>
            </div>
            {submitMutation.isPending && <div style={{ fontSize: '0.7rem', color: T.muted }}>Submitting your answers, please wait…</div>}
          </div>
        </div>
      )}

      {/* ============ CANDIDATE POPUP ============ */}
      {showCandidate && (
        <div style={{ ...popStyles.overlay, animation: 'fadeIn .2s ease' }} onClick={() => setShowCandidate(false)}>
          <div style={{ ...popStyles.reviewCard, maxWidth: '400px' }} className="cbt-review-card" onClick={e => e.stopPropagation()}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1.1rem 1.4rem', borderBottom: `1px solid ${T.border}`, background: 'rgba(2,6,23,.4)' }}>
              <div style={{ fontWeight: 900, fontSize: '0.95rem', color: T.text, letterSpacing: '1px' }}>👤 CANDIDATE DETAILS</div>
              <button onClick={() => setShowCandidate(false)} style={popStyles.dockCloseDark}>✕</button>
            </div>
            <div style={{ padding: '1.2rem 1.4rem', display: 'flex', flexDirection: 'column', gap: '0.55rem' }}>
              {[['📚 SUBJECT', test.subjectId?.name || 'General'], ['📄 TEST', test.title], ['❓ QUESTIONS', `${total}`], ['⏱️ DURATION', `${test.duration} min`], ['👁️ TAB SWITCHES', `${tabSwitches}`], ['✅ ANSWERED', `${answeredCount} / ${total}`]].map(([k, v]) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(148,163,184,0.05)', border: `1px solid ${T.border}`, borderRadius: '9px', padding: '0.55rem 0.85rem' }}>
                  <span style={{ fontSize: '0.62rem', fontWeight: 800, color: T.dim, letterSpacing: '1px' }}>{k}</span>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: T.text }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

const mBtnStyle = {
  background: 'rgba(255,255,255,0.06)',
  border: 'none',
  color: '#fff',
  width: '40px',
  height: '40px',
  borderRadius: '10px',
  fontSize: '1.15rem',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
};

export default TakeTest;