import React, { useState, useEffect, useMemo, useCallback } from 'react';
import axios from 'axios';
import schoolLogo from '../../pages/logo.png';
import principalSignature from './principal_signature.png';
import './StudentReportCard.css';

// ──────────────────────────────────────────────────────────────
// LOGIN SCREEN STYLES (report card styles live in StudentReportCard.css)
// ──────────────────────────────────────────────────────────────
const S = {
  loginScreen: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'linear-gradient(160deg, #0A3D2E 0%, #0D4F3C 40%, #14654A 100%)',
    position: 'relative',
    overflow: 'hidden',
  },
  loginScreenDots: {
    position: 'absolute',
    inset: 0,
    backgroundImage: 'radial-gradient(circle at 1px 1px, rgba(255,255,255,0.03) 1px, transparent 0)',
    backgroundSize: '40px 40px',
    pointerEvents: 'none',
  },
  loginCard: {
    background: 'rgba(255,255,255,0.97)',
    borderRadius: 16,
    padding: '48px 40px',
    width: '100%',
    maxWidth: 440,
    boxShadow: '0 25px 60px rgba(0,0,0,0.3), 0 0 0 1px rgba(255,255,255,0.1)',
    position: 'relative',
    zIndex: 2,
    animation: 'srpSlideUp 0.6s cubic-bezier(0.16,1,0.3,1) both',
    margin: 16,
  },
  logoWrap: { width: 68, height: 78, margin: '0 auto 16px' },
  logoImg: { width: '100%', height: '100%', objectFit: 'contain' },
  schoolTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontWeight: 800,
    fontSize: '1.2rem',
    textAlign: 'center',
    color: '#0A3D2E',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    lineHeight: 1.3,
    marginBottom: 2,
  },
  portalSub: {
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '0.78rem',
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 3.5,
    color: '#C8963E',
    textAlign: 'center',
    marginBottom: 28,
  },
  goldLine: {
    height: 2,
    border: 'none',
    background: 'linear-gradient(90deg, transparent 0%, #C8963E 30%, #C8963E 70%, transparent 100%)',
    marginBottom: 24,
  },
  errBox: {
    background: '#FDF2F2',
    border: '1px solid #F5C6CB',
    color: '#C0392B',
    padding: '10px 14px',
    borderRadius: 6,
    fontSize: '0.84rem',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    gap: 8,
  },
  fg: { marginBottom: 16, position: 'relative' },
  fl: {
    display: 'block',
    fontSize: '0.82rem',
    fontWeight: 600,
    color: '#4A4A4A',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  fiw: { position: 'relative' },
  fiIcon: {
    position: 'absolute',
    left: 14,
    top: '50%',
    transform: 'translateY(-50%)',
    color: '#999',
    fontSize: '0.88rem',
    transition: 'color 0.2s',
    pointerEvents: 'none',
  },
  fi: {
    width: '100%',
    padding: '12px 14px 12px 42px',
    border: '1.5px solid #D5D0C8',
    borderRadius: 8,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '0.95rem',
    color: '#1A1A1A',
    background: '#FAF8F4',
    transition: 'all 0.25s',
    outline: 'none',
    boxSizing: 'border-box',
  },
  fiFocus: { borderColor: '#14654A', boxShadow: '0 0 0 3px rgba(20,101,74,0.1)', background: '#fff' },
  loginBtn: {
    width: '100%',
    padding: '14px',
    background: 'linear-gradient(135deg, #0A3D2E, #14654A)',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '1rem',
    fontWeight: 600,
    letterSpacing: 0.5,
    cursor: 'pointer',
    transition: 'all 0.3s',
    marginTop: 4,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  loginBtnHover: { background: 'linear-gradient(135deg, #14654A, #1E8C64)', transform: 'translateY(-1px)', boxShadow: '0 6px 20px rgba(10,61,46,0.3)' },
  loginBtnDis: { opacity: 0.6, cursor: 'not-allowed' },
  spinInline: {
    display: 'inline-block',
    width: 18,
    height: 18,
    border: '2px solid rgba(255,255,255,0.3)',
    borderTopColor: '#fff',
    borderRadius: '50%',
    animation: 'srpSpin 0.7s linear infinite',
    marginRight: 8,
  },
  loginFoot: {
    textAlign: 'center',
    marginTop: 24,
    fontSize: '0.74rem',
    color: '#999',
    lineHeight: 1.5,
  },
  // Full-screen states
  fullScreen: {
    minHeight: '100vh',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 16,
    textAlign: 'center',
    padding: 24,
  },
  spinLg: {
    width: 48,
    height: 48,
    border: '4px solid #E0DBD3',
    borderTopColor: '#0A3D2E',
    borderRadius: '50%',
    animation: 'srpSpin 0.8s linear infinite',
  },
  errIcon: {
    width: 64,
    height: 64,
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: '1.6rem',
    marginBottom: 4,
  },
  errTitle: {
    fontFamily: "'Playfair Display', Georgia, serif",
    fontSize: '1.3rem',
    fontWeight: 700,
  },
  errMsg: { fontSize: '0.92rem', color: '#4A4A4A', maxWidth: 400, lineHeight: 1.5 },
  retryBtn: {
    marginTop: 8,
    padding: '10px 28px',
    borderRadius: 6,
    fontSize: '0.9rem',
    fontWeight: 600,
    cursor: 'pointer',
    border: '1.5px solid #D5D0C8',
    background: 'transparent',
    color: '#4A4A4A',
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    transition: 'all 0.2s',
  },
  // Top bar
  topBar: {
    background: '#fff',
    borderBottom: '1px solid #E0DBD3',
    padding: '10px 24px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    position: 'sticky',
    top: 0,
    zIndex: 50,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
    flexWrap: 'wrap',
    gap: 8,
  },
  topLeft: { display: 'flex', alignItems: 'center', gap: 14 },
  backBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 14px',
    background: 'none',
    border: '1.5px solid #D5D0C8',
    borderRadius: 6,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '0.84rem',
    fontWeight: 600,
    color: '#4A4A4A',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  badge: { display: 'flex', alignItems: 'center', gap: 10 },
  avatar: {
    width: 32,
    height: 32,
    borderRadius: '50%',
    background: '#0A3D2E',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 700,
    fontSize: '0.8rem',
    fontFamily: "'Source Sans 3', sans-serif",
    flexShrink: 0,
  },
  badgeTxt: { fontSize: '0.84rem', color: '#4A4A4A' },
  badgeTxtStrong: { color: '#1A1A1A', fontWeight: 600 },
  badgeSmall: { fontSize: '0.73rem' },
  termSelect: {
    padding: '7px 12px',
    border: '1.5px solid #D5D0C8',
    borderRadius: 6,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '0.84rem',
    color: '#1A1A1A',
    background: '#fff',
    cursor: 'pointer',
    outline: 'none',
    minWidth: 180,
  },
  printBtn: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    padding: '7px 18px',
    background: 'linear-gradient(135deg, #0A3D2E, #14654A)',
    color: '#fff',
    border: 'none',
    borderRadius: 6,
    fontFamily: "'Source Sans 3', 'Segoe UI', sans-serif",
    fontSize: '0.84rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'all 0.25s',
  },
  reportWrap: { padding: 24, display: 'flex', justifyContent: 'center' },
  // Loading overlay inside report
  overlay: {
    position: 'absolute',
    inset: 0,
    background: 'rgba(255,255,255,0.85)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    zIndex: 2000,
    borderRadius: 0,
  },
  overlayText: {
    fontWeight: 600,
    color: '#0A3D2E',
    fontFamily: "'Source Sans 3', sans-serif",
    fontSize: '0.92rem',
  },
};

// Keyframe injection (only once)
if (typeof document !== 'undefined' && !document.getElementById('srp-keyframes')) {
  const kf = document.createElement('style');
  kf.id = 'srp-keyframes';
  kf.textContent = `
    @keyframes srpSlideUp { from { opacity:0; transform:translateY(30px) scale(0.97); } to { opacity:1; transform:translateY(0) scale(1); } }
    @keyframes srpSpin { to { transform:rotate(360deg); } }
  `;
  document.head.appendChild(kf);
}

// ──────────────────────────────────────────────────────────────
// COMPONENT
// ──────────────────────────────────────────────────────────────
const StudentResultPortal = () => {
  // ── View State ──
  const [view, setView] = useState('login'); // login | loading | result | error | fees

  // ── Login State ──
  const [admNo, setAdmNo] = useState('');
  const [fname, setFname] = useState('');
  const [loginErr, setLoginErr] = useState('');
  const [loggingIn, setLoggingIn] = useState(false);

  // ── Auth State (persisted in sessionStorage) ──
  const [token, setToken] = useState(() => sessionStorage.getItem('srp_token') || null);
  const [student, setStudent] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('srp_user') || 'null'); } catch { return null; }
  });

  // ── Data State ──
  const [terms, setTerms] = useState([]);
  const [selTermId, setSelTermId] = useState('');
  const [report, setReport] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);

  // ── Error State ──
  const [errInfo, setErrInfo] = useState({ title: '', msg: '' });

  // ── Input focus states ──
  const [admFocus, setAdmFocus] = useState(false);
  const [fnFocus, setFnFocus] = useState(false);

  // ── Helpers ──
  const defaultPsychomotor = useMemo(() => [
    { skill: 'Handwriting', rating: 'A' },
    { skill: 'Sports', rating: 'B' },
    { skill: 'Drawing & Painting', rating: 'A' },
    { skill: 'Music & Drama', rating: 'B' },
    { skill: 'Crafts', rating: 'C' },
    { skill: 'Cleanliness', rating: 'A' },
    { skill: 'Punctuality', rating: 'B' },
    { skill: 'Politeness', rating: 'A' },
  ], []);

  const normalizePsychomotorRating = (rating) => {
    if (!rating) return '';
    const u = rating.toString().toUpperCase().trim();
    return ['A', 'B', 'C'].includes(u) ? u : 'C';
  };

  const formatDate = (date) =>
    date ? new Date(date).toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }) : 'N/A';

  // ── Authenticated API caller ──
  const api = useCallback(async (method, path, data = null) => {
    const cfg = {
      method,
      url: path,
      headers: { 'Content-Type': 'application/json' },
      data: data || undefined,
    };
    if (token) cfg.headers.Authorization = `Bearer ${token}`;
    const res = await axios(cfg);
    return res.data;
  }, [token]);

  // ── Persist helpers ──
  const saveAuth = useCallback((t, u) => {
    setToken(t);
    setStudent(u);
    sessionStorage.setItem('srp_token', t);
    sessionStorage.setItem('srp_user', JSON.stringify(u));
  }, []);

  const clearAuth = useCallback(() => {
    setToken(null);
    setStudent(null);
    setReport(null);
    setTerms([]);
    setSelTermId('');
    setAdmNo('');
    setFname('');
    setLoginErr('');
    sessionStorage.removeItem('srp_token');
    sessionStorage.removeItem('srp_user');
  }, []);

  // ── Auto-login if token exists ──
  useEffect(() => {
    if (token && student) {
      setView('loading');
      fetchTerms();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── LOGIN ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginErr('');
    const a = admNo.trim();
    const f = fname.trim();
    if (!a || !f) { setLoginErr('Please enter both your admission number and first name.'); return; }

    setLoggingIn(true);
    try {
      const res = await api('POST', '/login/student', { admissionNumber: a, firstName: f });
      if (!res.success) {
        if (res.code === 'FEES_BLOCKED') { setView('fees'); return; }
        setLoginErr(res.message || 'Invalid credentials.'); return;
      }
      saveAuth(res.token, res.user);
      setView('loading');
      await fetchTerms();
    } catch (err) {
      setLoginErr(err.response?.data?.message || err.message || 'Connection error. Check your internet and try again.');
    } finally {
      setLoggingIn(false);
    }
  };

  // ── FETCH TERMS ──
  const fetchTerms = async () => {
    try {
      const res = await api('GET', '/terms');
      const list = res.success ? res.data : [];
      setTerms(list);
      const active = list.find(t => t.status === 'active');
      const pick = active || list[0];
      if (pick) { setSelTermId(pick._id); await fetchReport(pick._id); }
      else { setView('error'); setErrInfo({ title: 'No Terms Available', msg: 'No academic terms have been set up yet. Please try again later.' }); }
    } catch (err) {
      setView('error');
      setErrInfo({ title: 'Failed to Load', msg: err.response?.data?.message || err.message });
    }
  };

  // ── FETCH REPORT ──
  const fetchReport = async (termId) => {
    setReportLoading(true);
    try {
      const params = new URLSearchParams();
      if (termId) params.set('termId', termId);
      const res = await api('GET', `/report-cards/student/${student._id}?${params.toString()}`);
      if (!res.success) {
        setView('error');
        setErrInfo({ title: 'Result Not Found', msg: res.message || 'No report card found for the selected term.' });
        return;
      }
      setReport(res.data);
      setView('result');
    } catch (err) {
      setView('error');
      setErrInfo({ title: 'Failed to Load Result', msg: err.response?.data?.message || err.message });
    } finally {
      setReportLoading(false);
    }
  };

  // ── TERM CHANGE ──
  const handleTermChange = (e) => {
    const tid = e.target.value;
    setSelTermId(tid);
    if (tid) fetchReport(tid);
  };

  // ── LOGOUT ──
  const handleLogout = () => { clearAuth(); setView('login'); };

  // ── PRINT (same robust logic as original) ──
  const handlePrint = () => {
    const el = document.querySelector('.a4-document');
    if (!el) return;
    const clone = el.cloneNode(true);

    const headStyles = Array.from(document.head.querySelectorAll('style, link[rel="stylesheet"]'))
      .map(e => e.outerHTML).join('\n');

    const a4CSS = `
      @page { size: A4 portrait; margin: 0; }
      * { -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important; }
      body { margin: 0; padding: 0; background: #fff !important; }
      .a4-document {
        width: 210mm; min-height: 297mm; padding: 14mm 16mm !important;
        background-color: #ffffff !important; position: relative;
        box-sizing: border-box !important; margin: 0 !important;
        box-shadow: none !important;
      }
      .a4-document::before, .a4-document::after {
        content: "" !important; position: absolute !important;
        pointer-events: none !important; z-index: 1000 !important;
        border: 3px solid #111 !important; border-radius: 0 !important;
        -webkit-print-color-adjust: exact !important; print-color-adjust: exact !important;
      }
      .a4-document::before { inset: 0 !important; }
      .a4-document::after { inset: 7px !important; border-width: 1.5px !important; }
    `;

    const pw = window.open('', '_blank', 'width=900,height=700');
    if (!pw) { alert('Please allow pop-ups to print.'); return; }
    pw.document.write(`<!DOCTYPE html><html lang="en"><head>
      <title>Report Card - ${report?.student?.firstName || ''} ${report?.student?.lastName || ''}</title>
      ${headStyles}<style>${a4CSS}</style>
    </head><body>${clone.outerHTML}
      <script>window.onafterprint=()=>window.close();
      document.fonts.ready.then(()=>setTimeout(()=>window.print(),300));<\/script>
    </body></html>`);
    pw.document.close();
  };

  // ── Psychomotor data ──
  const psychomotorSkills = useMemo(() => {
    const src = report?.psychomotor?.length ? report.psychomotor : defaultPsychomotor;
    return src.map(s => ({ ...s, rating: normalizePsychomotorRating(s.rating) }));
  }, [report?.psychomotor, defaultPsychomotor]);

  // ════════════════════════════════════════════════════════════
  // RENDER: LOGIN SCREEN
  // ════════════════════════════════════════════════════════════
  if (view === 'login') {
    return (
      <div style={S.loginScreen}>
        <div style={S.loginScreenDots} />
        <div style={S.loginCard}>
          <div style={S.logoWrap}>
            <img src={schoolLogo} alt="BimTech SaaS Solutions Logo" style={S.logoImg} />
          </div>
          <h1 style={S.schoolTitle}>DATFORTE INTERNATIONAL<br />SCHOOLS LIMITED</h1>
          <p style={S.portalSub}>Student Result Portal</p>
          <hr style={S.goldLine} />

          {loginErr && (
            <div style={S.errBox}>
              <i className="fas fa-exclamation-circle" /> {loginErr}
            </div>
          )}

          <form onSubmit={handleLogin}>
            <div style={S.fg}>
              <label style={S.fl}>Admission Number</label>
              <div style={S.fiw}>
                <input
                  type="text" value={admNo}
                  onChange={e => setAdmNo(e.target.value)}
                  onFocus={() => setAdmFocus(true)} onBlur={() => setAdmFocus(false)}
                  placeholder="e.g. SCH/2025/001"
                  style={{ ...S.fi, ...(admFocus ? S.fiFocus : {}) }}
                  autoFocus
                />
                <i className="fas fa-id-card" style={{ ...S.fiIcon, color: admFocus ? '#14654A' : '#999' }} />
              </div>
            </div>
            <div style={S.fg}>
              <label style={S.fl}>First Name (Password)</label>
              <div style={S.fiw}>
                <input
                  type="text" value={fname}
                  onChange={e => setFname(e.target.value)}
                  onFocus={() => setFnFocus(true)} onBlur={() => setFnFocus(false)}
                  placeholder="Enter your first name"
                  style={{ ...S.fi, ...(fnFocus ? S.fiFocus : {}) }}
                />
                <i className="fas fa-user" style={{ ...S.fiIcon, color: fnFocus ? '#14654A' : '#999' }} />
              </div>
            </div>
            <button type="submit" disabled={loggingIn} style={{ ...S.loginBtn, ...(loggingIn ? S.loginBtnDis : {}) }}>
              {loggingIn ? <><span style={S.spinInline} /> Verifying...</> : 'Check My Result'}
            </button>
          </form>
          <p style={S.loginFoot}>Enter your admission number and first name to view your report card.</p>
        </div>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: LOADING SCREEN
  // ════════════════════════════════════════════════════════════
  if (view === 'loading') {
    return (
      <div style={{ ...S.fullScreen, background: '#F5F1EB' }}>
        <div style={S.spinLg} />
        <p style={{ fontWeight: 600, color: '#0A3D2E' }}>Fetching your result...</p>
        <p style={{ fontSize: '0.82rem', color: '#888' }}>Please wait while we retrieve your report card.</p>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: ERROR SCREEN
  // ════════════════════════════════════════════════════════════
  if (view === 'error') {
    return (
      <div style={{ ...S.fullScreen, background: '#FDF2F2' }}>
        <div style={{ ...S.errIcon, background: '#F5C6CB', color: '#C0392B' }}>
          <i className="fas fa-times" />
        </div>
        <div style={S.errTitle}>{errInfo.title}</div>
        <p style={S.errMsg}>{errInfo.msg}</p>
        <button style={S.retryBtn} onClick={handleLogout}>Try Again</button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: FEES BLOCKED SCREEN
  // ════════════════════════════════════════════════════════════
  if (view === 'fees') {
    return (
      <div style={{ ...S.fullScreen, background: '#FFF8E1' }}>
        <div style={{ ...S.errIcon, background: '#FFE082', color: '#F57F17' }}>
          <i className="fas fa-exclamation-triangle" />
        </div>
        <div style={{ ...S.errTitle, color: '#F57F17' }}>Fees Access Restricted</div>
        <p style={S.errMsg}>
          Your result is currently unavailable due to outstanding fees.
          Please contact the school administration to resolve this matter.
        </p>
        <button style={S.retryBtn} onClick={handleLogout}>Go Back</button>
      </div>
    );
  }

  // ════════════════════════════════════════════════════════════
  // RENDER: RESULT SCREEN
  // ════════════════════════════════════════════════════════════
  const r = report;
  const s = r?.student || {};
  const totalObtainable = (r?.subjects || []).length * 100;
  const initials = ((s.firstName || '')[0] || '') + ((s.lastName || '')[0] || '');

  // Psychomotor rows (two-column)
  const half = Math.ceil(psychomotorSkills.length / 2);
  const pLeft = psychomotorSkills.slice(0, half);
  const pRight = psychomotorSkills.slice(half);
  const maxRows = Math.max(pLeft.length, pRight.length);

  const selectedTerm = terms.find(t => t._id === selTermId);

  return (
    <div>
      {/* ── Top Bar ── */}
      <div style={S.topBar}>
        <div style={S.topLeft}>
          <button style={S.backBtn} onClick={handleLogout}>
            <i className="fas fa-arrow-left" /> Logout
          </button>
          <div style={S.badge}>
            <div style={S.avatar}>{initials.toUpperCase()}</div>
            <div style={S.badgeTxt}>
              <span style={S.badgeTxtStrong}>{s.firstName} {s.lastName}</span>
              <br />
              <span style={S.badgeSmall}>{s.admissionNumber}</span>
            </div>
          </div>
        </div>

        <select
          value={selTermId}
          onChange={handleTermChange}
          disabled={reportLoading}
          style={S.termSelect}
        >
          {terms.length === 0 && <option value="">No terms</option>}
          {terms.map(t => (
            <option key={t._id} value={t._id}>
              {t.name} — {t.session?.name || ''}{t.status === 'active' ? '  ★' : ''}
            </option>
          ))}
        </select>

        <button style={S.printBtn} onClick={handlePrint} disabled={reportLoading}>
          <i className="fas fa-print" /> Print
        </button>
      </div>

      {/* ── Report Wrapper ── */}
      <div style={S.reportWrap}>
        <div className="a4-document" style={{ position: 'relative' }}>

          {/* Loading overlay when switching terms */}
          {reportLoading && (
            <div style={S.overlay}>
              <div style={S.spinLg} />
              <span style={S.overlayText}>Loading report...</span>
            </div>
          )}

          <header className="school-header-elegant">
            <div className="header-ornament top" />
            <div className="header-logo-wrap">
              <img src={schoolLogo} alt="BimTech SaaS Solutions Logo" className="header-logo" />
            </div>
            <h1 className="school-name">BimTech SaaS SolutionsS LIMITED</h1>
            <h2 className="doc-title">STUDENT ACADEMIC REPORT CARD</h2>
            <div className="header-meta-box">
              <span className="meta-text">Term <strong>{r?.term?.name}</strong></span>
              <span className="meta-divider" />
              <span className="meta-text">Session <strong>{r?.session?.name}</strong></span>
            </div>
            <div className="header-ornament bottom" />
          </header>

          {/* Bio Data */}
          <div className="bio-data-section">
            <div className="bio-grid">
              <div className="bio-item">
                <span className="bio-label">Name of Student</span>
                <span className="bio-value name-highlight">{s.lastName} {s.firstName}</span>
              </div>
              <div className="bio-item">
                <span className="bio-label">Admission No.</span>
                <span className="bio-value">{s.admissionNumber}</span>
              </div>
              <div className="bio-item">
                <span className="bio-label">Class</span>
                <span className="bio-value">{s.class?.name || '—'} {s.class?.section || ''}</span>
              </div>
              <div className="bio-item">
                <span className="bio-label">Gender</span>
                <span className="bio-value">{s.gender || '—'}</span>
              </div>
            </div>
          </div>

          {/* Grades Table */}
          <div className="grades-container">
            <table className="grades-table-elegant">
              <thead>
                <tr>
                  <th rowSpan="2" className="th-sn">S/N</th>
                  <th rowSpan="2" className="th-subject">SUBJECTS</th>
                  <th colSpan="4" className="th-ca-header">CONTINUOUS ASSESSMENT (40)</th>
                  <th rowSpan="2" className="th-score">EXAM<br />(60)</th>
                  <th rowSpan="2" className="th-score">TOTAL<br />(100)</th>
                  <th rowSpan="2" className="th-grade">GRADE</th>
                  <th rowSpan="2" className="th-remark">REMARK</th>
                </tr>
                <tr>
                  <th className="th-sub-ca">Test<br />(20)</th>
                  <th className="th-sub-ca">Notes<br />(10)</th>
                  <th className="th-sub-ca">Assign<br />(10)</th>
                  <th className="th-sub-ca">Total<br />(40)</th>
                </tr>
              </thead>
              <tbody>
                {(r?.subjects || []).length === 0 ? (
                  <tr><td colSpan="10" className="td-empty">No grades recorded for this term.</td></tr>
                ) : (
                  (r?.subjects || []).map((sub, i) => (
                    <tr key={sub._id || i}>
                      <td className="td-center">{i + 1}</td>
                      <td className="td-subject">{sub.subject?.name}</td>
                      <td className="td-center">{sub.testScore}</td>
                      <td className="td-center">{sub.noteTakingScore}</td>
                      <td className="td-center">{sub.assignmentScore}</td>
                      <td className="td-center td-bold">{sub.totalCA}</td>
                      <td className="td-center td-bold">{sub.examScore}</td>
                      <td className="td-center td-bold td-total">{sub.totalScore}</td>
                      <td className="td-center td-bold">{sub.grade}</td>
                      <td className="td-remark">{sub.remark}</td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="summary-row">
                  <td colSpan="7" className="td-right summary-label">TOTAL SCORE OBTAINABLE:</td>
                  <td className="td-center td-total">{totalObtainable}</td>
                  <td colSpan="2" />
                </tr>
                <tr className="summary-row">
                  <td colSpan="7" className="td-right summary-label">TOTAL SCORE OBTAINED:</td>
                  <td className="td-center td-total">{r?.statistics?.totalScore}</td>
                  <td colSpan="2" />
                </tr>
                <tr className="summary-row">
                  <td colSpan="7" className="td-right summary-label">STUDENT AVERAGE:</td>
                  <td className="td-center td-total">{r?.statistics?.averageScore}%</td>
                  <td colSpan="2" />
                </tr>
                {r?.statistics?.position > 0 && (
                  <tr className="summary-row">
                    <td colSpan="7" className="td-right summary-label">POSITION IN CLASS:</td>
                    <td className="td-center td-total">{r?.statistics?.position} out of {r?.statistics?.totalInClass}</td>
                    <td colSpan="2" />
                  </tr>
                )}
              </tfoot>
            </table>
          </div>

          {/* Grading Key */}
          <div className="grading-key-elegant">
            <span className="key-label">GRADING SCALE:</span>
            <span className="key-text">A (Excellent) | B (Very Good) | C (Good) | D (Fair) | E (Poor) | F (Fail)</span>
          </div>

          {/* Attendance */}
          <div className="attendance-section">
            <div className="attendance-title">ATTENDANCE RECORD</div>
            <div className="attendance-grid">
              <div className="attendance-card">
                <span className="attendance-label">No. of Times School Opened</span>
                <span className="attendance-value">{'\u2014\u2014\u2014'}</span>
              </div>
              <div className="attendance-card">
                <span className="attendance-label">No. of Times Present</span>
                <span className="attendance-value present">{'\u2014\u2014\u2014'}</span>
              </div>
              <div className="attendance-card">
                <span className="attendance-label">No. of Times Absent</span>
                <span className="attendance-value absent">{'\u2014\u2014\u2014'}</span>
              </div>
            </div>
          </div>

          {/* Psychomotor */}
          <div className="psychomotor-section-compact">
            <div className="psychomotor-title-compact">
              PSYCHOMOTOR / AFFECTIVE DOMAIN
              <span className="psychomotor-key-inline">&nbsp; (A – Excellent | B – Very Good | C – Good)</span>
            </div>
            <table className="psychomotor-table-compact">
              <thead>
                <tr>
                  <th className="pmc-th-sn">S/N</th>
                  <th className="pmc-th-skill">Skill / Trait</th>
                  <th className="pmc-th-rating">Rating</th>
                  <th className="pmc-th-sn">S/N</th>
                  <th className="pmc-th-skill">Skill / Trait</th>
                  <th className="pmc-th-rating">Rating</th>
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: maxRows }, (_, idx) => (
                  <tr key={idx}>
                    <td className="pmc-td-sn">{idx + 1}</td>
                    <td className="pmc-td-skill">{pLeft[idx]?.skill || ''}</td>
                    <td className="pmc-td-rating">
                      <span className={`pmc-rating-letter ${pLeft[idx]?.rating || ''}`}>{pLeft[idx]?.rating || '–'}</span>
                    </td>
                    <td className="pmc-td-sn">{half + idx + 1}</td>
                    <td className="pmc-td-skill">{pRight[idx]?.skill || ''}</td>
                    <td className="pmc-td-rating">
                      <span className={`pmc-rating-letter ${pRight[idx]?.rating || ''}`}>{pRight[idx]?.rating || '–'}</span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Comments */}
          <div className="comments-container">
            <div className="comment-box-elegant">
              <div className="comment-title" style={{ textAlign: 'center' }}>CLASS TEACHER'S COMMENT</div>
              <div className="comment-text-area">
                {r?.classTeacherComment
                  ? <><strong>{s.firstName} {s.lastName}</strong> — {r.classTeacherComment}</>
                  : <span className="blank-line">................................................................................</span>}
              </div>
              <div className="signature-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <div className="sig-line" />
                <span className="sig-text">Class Teacher</span>
              </div>
            </div>

            <div className="comment-box-elegant">
              <div className="comment-title" style={{ textAlign: 'center' }}>PRINCIPAL/HEADTEACHER'S COMMENT</div>
              <div className="comment-text-area">
                {r?.principalComment
                  ? <>{r.principalComment}</>
                  : <span className="blank-line">................................................................................</span>}
              </div>
              <div className="signature-section" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                <img src={principalSignature} alt="Principal's Signature" className="principal-sig-img" />
                <div className="sig-line" />
                <span className="sig-text">Principal / Headteacher</span>
              </div>
            </div>
          </div>

          {/* Footer */}
          <footer className="sheet-footer-elegant">
            <div className="footer-dates-grid">
              <div className="footer-date-item">
                <span className="fd-label">Term Begins:</span>
                <span className="fd-value">{formatDate(r?.term?.startDate)}</span>
              </div>
              <div className="footer-date-item">
                <span className="fd-label">Term Ends:</span>
                <span className="fd-value">{formatDate(r?.term?.endDate)}</span>
              </div>
            </div>
            {r?.term?.nextTermBegins && (
              <div className="next-term-highlight">
                <span className="nt-label">NEXT TERM BEGINS:</span>
                <span className="nt-date">{formatDate(r.term.nextTermBegins)}</span>
              </div>
            )}
          </footer>
        </div>
      </div>
    </div>
  );
};

export default StudentResultPortal;