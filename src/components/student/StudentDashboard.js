import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { studentAPI } from '../../api';
import { useNavigate } from 'react-router-dom';

// ✅ Normalize Prisma (id) and Mongoose (_id) ID shapes
const getId = (v) => (v === null || v === undefined) ? null
  : (typeof v === 'object' ? (v._id ?? v.id ?? null) : v);

const StudentDashboard = () => {
  const navigate = useNavigate();
  const [darkMode, setDarkMode] = useState(false);

  const { data: dashboardData, isLoading, isError, refetch } = useQuery({
    queryKey: ['studentDashboard'],
    queryFn: studentAPI.getDashboard
  });

  // ✅ Error state — failed request shows a retry screen instead of an empty shell
  if (isError) {
    return (
      <div className="sd-root">
        <style>{`.sd-root{--primary:#006633;min-height:100vh;background:#f1f5f9;display:flex;align-items:center;justify-content:center;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;padding:1rem}.sd-error{text-align:center;background:#fff;padding:40px 24px;border-radius:16px;box-shadow:0 4px 24px rgba(0,0,0,0.08);max-width:400px;width:100%}.sd-error-icon{font-size:2.5rem;margin-bottom:16px}.sd-error h2{color:#0f172a;margin:0 0 8px;font-size:1.1rem}.sd-error p{color:#64748b;margin:0 0 24px;font-size:.85rem}.sd-error button{background:linear-gradient(135deg,#006633,#059669);color:#fff;border:none;padding:12px 24px;border-radius:10px;font-weight:700;font-size:.85rem;cursor:pointer;width:100%}`}</style>
        <div className="sd-error">
          <div className="sd-error-icon">⚠️</div>
          <h2>Unable to load your dashboard</h2>
          <p>Please check your connection and try again.</p>
          <button onClick={() => refetch()}>🔄 Retry</button>
        </div>
      </div>
    );
  }

  const { student, availableTests, recentResults, stats } = dashboardData?.data || {};

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  // ✅ ENDPOINT WIRING — navigate to TakeTest (/student/tests/:testId),
  // which loads via GET /student/tests/:id and submits via POST .../submit
  const handleStartTest = (test) => {
    const testId = getId(test);
    if (!testId) return;
    navigate(`/student/tests/${testId}`);
  };

  const isTaken = (test) =>
    test.isTaken === true ||
    test.hasSubmitted === true ||
    test.canTake === false ||
    test.status === 'completed' ||
    (test.submission !== null && test.submission !== undefined) ||
    test.submissionStatus === 'submitted';

  const isExpired = (test) => {
    const now = new Date();
    const endDate = test.endDate || test.expiresAt || test.expiryDate || test.endTime || test.deadline;
    return endDate && new Date(endDate) < now;
  };

  const isUnavailable = (test) => isTaken(test) || isExpired(test);

  const handleUnavailableClick = (test) => {
    if (isTaken(test)) alert("You have already taken this examination.");
    else if (isExpired(test)) alert("This examination has expired and is no longer available.");
  };

  const getScoreColor = (p) => {
    if (p >= 80) return '#10b981';
    if (p >= 60) return '#3b82f6';
    if (p >= 40) return '#f59e0b';
    return '#ef4444';
  };

  const fullName = student ? `${student.firstName || ''} ${student.lastName || ''}`.trim() : 'Student';
  const avg = stats?.averageScore || 0;
  const takenCount = stats?.totalTests || 0;
  const passedCount = (recentResults || []).filter(r => r.passed).length;
  const passRate = takenCount > 0 ? Math.round((passedCount / Math.max(recentResults?.length || takenCount, 1)) * 100) : 0;

  const statCards = [
    { label: 'Available Tests', value: availableTests?.length || 0, icon: '📝', tint: '#eef2ff', ink: '#4f46e5' },
    { label: 'Tests Taken', value: takenCount, icon: '✅', tint: '#ecfdf5', ink: '#059669' },
    { label: 'Average Score', value: `${avg}%`, icon: '📈', tint: '#fffbeb', ink: '#d97706' },
    { label: 'Pass Rate', value: `${passRate}%`, icon: '🏆', tint: '#eff6ff', ink: '#2563eb' },
  ];

  // Score ring helper
  const ScoreRing = ({ value, color }) => {
    const size = 48, stroke = 4, r = (size - stroke) / 2, c = 2 * Math.PI * r;
    return (
      <div className="sd-ring" style={{ width: size, height: size }}>
        <svg width={size} height={size} style={{ transform: 'rotate(-90deg)' }}>
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke="#e2e8f0" strokeWidth={stroke} />
          <circle cx={size/2} cy={size/2} r={r} fill="none" stroke={color} strokeWidth={stroke}
            strokeDasharray={`${(Math.min(value, 100) / 100) * c} ${c}`} strokeLinecap="round" />
        </svg>
        <span style={{ color }}>{value}%</span>
      </div>
    );
  };

  return (
    <div className={`sd-root ${darkMode ? 'sd-dark' : ''}`}>
      <style>{`
        .sd-root{--bg:#f1f5f9;--surface:#ffffff;--surface-2:#f8fafc;--border:#e2e8f0;--text:#0f172a;--text2:#475569;--muted:#94a3b8;--primary:#006633;--primary-h:#004d25;--accent:#059669;--accent-l:#ecfdf5;--danger:#ef4444;--warning:#f59e0b;--info:#3b82f6;--radius:16px;--radius-sm:10px;--shadow-xs:0 1px 2px rgba(0,0,0,.04);--shadow-sm:0 2px 8px rgba(0,0,0,.06);--shadow-md:0 6px 20px rgba(0,0,0,.08);--tr:200ms cubic-bezier(.4,0,.2,1);font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased;background:var(--bg);min-height:100vh}
        .sd-dark{--bg:#0b1220;--surface:#111a2b;--surface-2:#16213a;--border:#243050;--text:#f1f5f9;--text2:#cbd5e1;--muted:#64748b;--accent-l:rgba(5,150,105,.15)}
        .sd-root ::-webkit-scrollbar{width:6px;height:6px}.sd-root ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}

        /* ===== HERO HEADER ===== */
        .sd-hero{position:relative;overflow:hidden;background:linear-gradient(120deg,#00301a 0%,#006633 45%,#0a7a45 100%);color:#fff;padding:28px 32px;border-radius:0 0 24px 24px;box-shadow:0 10px 30px rgba(0,102,51,.35);margin-bottom:28px}
        .sd-hero::before{content:'';position:absolute;top:-60px;right:-60px;width:260px;height:260px;border-radius:50%;background:rgba(255,255,255,.06)}
        .sd-hero::after{content:'';position:absolute;bottom:-80px;left:15%;width:200px;height:200px;border-radius:50%;background:rgba(255,255,255,.04)}
        .sd-hero-inner{position:relative;z-index:1;display:flex;align-items:center;justify-content:space-between;gap:16px;flex-wrap:wrap}
        .sd-brand{display:flex;align-items:center;gap:16px}
        .sd-brand-logo{width:54px;height:54px;border-radius:14px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-weight:900;font-size:1.05rem;letter-spacing:2px;backdrop-filter:blur(6px);flex-shrink:0}
        .sd-brand h1{margin:0;font-size:1.35rem;font-weight:800;letter-spacing:-.02em}
        .sd-brand p{margin:2px 0 0;font-size:.8rem;opacity:.85;display:flex;align-items:center;gap:6px;flex-wrap:wrap}
        .sd-live{display:inline-flex;align-items:center;gap:5px;background:rgba(255,255,255,.14);border:1px solid rgba(255,255,255,.22);padding:2px 10px;border-radius:20px;font-size:.68rem;font-weight:700;letter-spacing:.5px}
        .sd-live-dot{width:7px;height:7px;border-radius:50%;background:#4ade80;animation:sdPulse 1.6s infinite}
        @keyframes sdPulse{0%,100%{opacity:1}50%{opacity:.35}}
        .sd-user{display:flex;align-items:center;gap:14px}
        .sd-user-info{text-align:right}
        .sd-user-name{font-size:1.05rem;font-weight:700}
        .sd-user-reg{font-family:ui-monospace,monospace;font-size:.72rem;background:rgba(0,0,0,.22);padding:3px 10px;border-radius:6px;display:inline-block;margin-top:4px}
        .sd-user-class{font-size:.72rem;opacity:.85;margin-top:4px}
        .sd-avatar{width:56px;height:56px;border-radius:50%;background:linear-gradient(135deg,#f59e0b,#e67e22);display:flex;align-items:center;justify-content:center;font-weight:800;font-size:1.15rem;border:3px solid rgba(255,255,255,.5);box-shadow:0 4px 12px rgba(0,0,0,.25);flex-shrink:0}
        .sd-theme-btn{width:40px;height:40px;border-radius:12px;border:1px solid rgba(255,255,255,.25);background:rgba(255,255,255,.12);color:#fff;font-size:1.05rem;cursor:pointer;transition:all var(--tr);flex-shrink:0}
        .sd-theme-btn:hover{background:rgba(255,255,255,.22)}

        /* ===== LAYOUT ===== */
        .sd-content{padding:0 32px 32px}
        .sd-greeting{margin:0 0 18px;font-size:.95rem;color:var(--text2)}
        .sd-greeting strong{color:var(--text)}

        /* ===== STATS ===== */
        .sd-stats{display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:14px;margin-bottom:24px}
        .sd-stat{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:18px;display:flex;align-items:center;gap:14px;box-shadow:var(--shadow-xs);transition:transform var(--tr),box-shadow var(--tr);position:relative;overflow:hidden}
        .sd-stat::before{content:'';position:absolute;top:0;left:0;right:0;height:3px;background:var(--ink);opacity:0;transition:opacity var(--tr)}
        .sd-stat:hover{transform:translateY(-3px);box-shadow:var(--shadow-md)}
        .sd-stat:hover::before{opacity:1}
        .sd-stat-icon{width:46px;height:46px;border-radius:12px;background:var(--tint);display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0}
        .sd-stat-label{font-size:.68rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:.06em}
        .sd-stat-value{font-size:1.45rem;font-weight:800;color:var(--text);line-height:1.2;margin-top:2px;font-variant-numeric:tabular-nums}

        /* ===== GRID ===== */
        .sd-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(420px,1fr));gap:18px}

        /* ===== PANELS ===== */
        .sd-panel{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);overflow:hidden;box-shadow:var(--shadow-xs)}
        .sd-panel-head{display:flex;align-items:center;justify-content:space-between;gap:10px;padding:16px 20px;border-bottom:1px solid var(--border);background:var(--surface-2)}
        .sd-panel-title{margin:0;font-size:.92rem;font-weight:800;display:flex;align-items:center;gap:8px}
        .sd-panel-title .ico{width:30px;height:30px;border-radius:9px;display:flex;align-items:center;justify-content:center;font-size:.9rem}
        .sd-panel-link{font-size:.76rem;font-weight:700;color:var(--primary);background:none;border:1px solid var(--border);padding:6px 14px;border-radius:20px;cursor:pointer;transition:all var(--tr);white-space:nowrap}
        .sd-panel-link:hover{background:var(--accent-l);border-color:var(--primary)}

        /* ===== EXAM ITEMS ===== */
        .sd-exam{display:flex;align-items:center;justify-content:space-between;gap:14px;padding:15px 20px;border-bottom:1px solid var(--border);transition:background var(--tr);position:relative}
        .sd-exam:last-child{border-bottom:none}
        .sd-exam:hover{background:var(--surface-2)}
        .sd-exam--done{opacity:.6}
        .sd-exam-num{width:38px;height:38px;border-radius:11px;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:.82rem;flex-shrink:0}
        .sd-exam-num--ok{background:var(--accent-l);color:var(--accent)}
        .sd-exam-num--grey{background:var(--surface-2);color:var(--muted);border:1px solid var(--border)}
        .sd-exam-title{font-weight:700;font-size:.92rem;display:flex;align-items:center;gap:8px;flex-wrap:wrap}
        .sd-pill{font-size:.6rem;font-weight:800;letter-spacing:.5px;padding:2px 8px;border-radius:6px}
        .sd-pill--done{background:#f1f5f9;color:#64748b}
        .sd-pill--expired{background:#fef2f2;color:#dc2626}
        .sd-exam-meta{display:flex;gap:12px;margin-top:4px;font-size:.76rem;color:var(--muted);flex-wrap:wrap}
        .sd-chip{display:inline-flex;align-items:center;gap:4px}
        .sd-btn-start{display:inline-flex;align-items:center;justify-content:center;gap:7px;background:linear-gradient(135deg,#059669,#006633);color:#fff;border:none;padding:9px 18px;border-radius:10px;font-weight:700;font-size:.8rem;cursor:pointer;box-shadow:0 3px 10px rgba(5,150,105,.3);transition:all var(--tr);flex-shrink:0}
        .sd-btn-start:hover{transform:translateY(-2px);box-shadow:0 6px 18px rgba(5,150,105,.4)}
        .sd-btn-start:active{transform:scale(.97)}
        .sd-btn-gone{display:inline-flex;align-items:center;justify-content:center;background:var(--surface-2);color:var(--muted);border:1px solid var(--border);padding:9px 18px;border-radius:10px;font-weight:700;font-size:.8rem;cursor:pointer;flex-shrink:0;transition:all var(--tr)}
        .sd-btn-gone:hover{border-color:var(--muted)}

        /* ===== RESULT ITEMS ===== */
        .sd-result{display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 20px;border-bottom:1px solid var(--border);transition:background var(--tr)}
        .sd-result:last-child{border-bottom:none}
        .sd-result:hover{background:var(--surface-2)}
        .sd-ring{position:relative;flex-shrink:0;display:flex;align-items:center;justify-content:center}
        .sd-ring span{position:absolute;font-size:.62rem;font-weight:800}
        .sd-result-title{font-weight:700;font-size:.9rem}
        .sd-result-sub{font-size:.76rem;color:var(--muted);margin-top:2px}
        .sd-badge-pass{padding:4px 12px;border-radius:20px;font-size:.7rem;font-weight:800;background:#ecfdf5;color:#059669;flex-shrink:0}
        .sd-badge-fail{padding:4px 12px;border-radius:20px;font-size:.7rem;font-weight:800;background:#fef2f2;color:#dc2626;flex-shrink:0}

        /* ===== EMPTY ===== */
        .sd-empty{text-align:center;padding:52px 24px;color:var(--muted)}
        .sd-empty-icon{font-size:2.4rem;margin-bottom:10px;display:block;animation:sdFloat 3s ease-in-out infinite}
        @keyframes sdFloat{0%,100%{transform:translateY(0)}50%{transform:translateY(-6px)}}
        .sd-empty p{margin:0;font-size:.85rem}

        /* ===== FOOTER ===== */
        .sd-footer{text-align:center;padding:20px;color:var(--muted);font-size:.74rem;border-top:1px solid var(--border);background:var(--surface);margin-top:28px;font-family:ui-monospace,monospace}

        /* ===== RESPONSIVE: TABLETS ===== */
        @media(max-width:900px){
          .sd-grid{grid-template-columns:1fr}
        }

        /* ===== RESPONSIVE: MOBILE ===== */
        @media(max-width:640px){
          /* Hero Adjustments */
          .sd-hero{padding:20px;border-radius:0 0 18px 18px;margin-bottom:20px}
          .sd-hero-inner{flex-direction:column;align-items:flex-start;gap:20px}
          .sd-brand h1{font-size:1.15rem}
          .sd-brand p{font-size:.75rem}
          .sd-user{align-self:stretch;justify-content:space-between;flex-wrap:wrap;gap:12px}
          .sd-user-info{text-align:left}
          .sd-theme-btn{width:36px;height:36px;font-size:.95rem}
          .sd-avatar{width:48px;height:48px;font-size:1rem}

          /* Content Adjustments */
          .sd-content{padding:0 16px 24px}
          .sd-greeting{font-size:.9rem;margin-bottom:16px}

          /* Stats Grid: 2x2 on Mobile */
          .sd-stats{grid-template-columns:repeat(2,1fr);gap:12px;margin-bottom:20px}
          .sd-stat{padding:14px;gap:10px}
          .sd-stat-icon{width:40px;height:40px;font-size:1.1rem}
          .sd-stat-value{font-size:1.2rem}
          .sd-stat-label{font-size:.65rem}

          /* Panel Adjustments */
          .sd-panel-head{padding:14px 16px}
          .sd-panel-title{font-size:.88rem}
          .sd-panel-link{padding:5px 12px;font-size:.72rem}

          /* Exam Items: Stack Vertically */
          .sd-exam{flex-direction:column;align-items:stretch;padding:14px 16px;gap:12px}
          .sd-exam > div:first-child{width:100%}
          .sd-exam .sd-btn-start, .sd-exam .sd-btn-gone{width:100%;padding:12px 18px}
          .sd-exam-title{font-size:.88rem}

          /* Result Items */
          .sd-result{padding:12px 16px;gap:10px}
          .sd-result-title{font-size:.85rem}
          
          .sd-empty{padding:36px 16px}
          .sd-empty p{font-size:.8rem}
          .sd-footer{padding:16px;font-size:.68rem}
        }

        /* ===== RESPONSIVE: VERY SMALL PHONES ===== */
        @media(max-width:380px){
          .sd-stats{grid-template-columns:1fr}
          .sd-brand-logo{width:46px;height:46px;font-size:.9rem}
          .sd-user{flex-direction:column;align-items:flex-start;gap:10px}
        }
      `}</style>

      {/* ===== HERO HEADER ===== */}
      <div className="sd-hero">
        <div className="sd-hero-inner">
          <div className="sd-brand">
            <div className="sd-brand-logo">CBT</div>
            <div>
              <h1>Examination Portal</h1>
              <p>
                <span className="sd-live"><span className="sd-live-dot" />SYSTEM ACTIVE</span>
                &nbsp;· Computer Based Testing v2.0
              </p>
            </div>
          </div>
          <div className="sd-user">
            <div className="sd-user-info">
              <div className="sd-user-name">{student?.firstName} {student?.lastName}</div>
              <div className="sd-user-reg">REG: {student?.admissionNumber || 'N/A'}</div>
              <div className="sd-user-class">
                {student?.class ? `${student.class.name}${student.class.section ? ` — ${student.class.section}` : ''}` : 'No class assigned'}
              </div>
            </div>
            <button className="sd-theme-btn" onClick={() => setDarkMode(d => !d)} title="Toggle theme">{darkMode ? '☀️' : '🌙'}</button>
            <div className="sd-avatar">{getInitials(student?.firstName, student?.lastName)}</div>
          </div>
        </div>
      </div>

      {/* ===== CONTENT ===== */}
      <div className="sd-content">
        <p className="sd-greeting">
          👋 Welcome back, <strong>{student?.firstName || 'Student'}</strong> — {availableTests?.length > 0 ? <>you have <strong>{availableTests.length}</strong> exam{availableTests.length !== 1 ? 's' : ''} available right now.</> : 'no exams are open at the moment.'}
        </p>

        {/* ===== STATS ===== */}
        <div className="sd-stats">
          {statCards.map((s, i) => (
            <div className="sd-stat" key={i} style={{ '--tint': s.tint, '--ink': s.ink }}>
              <div className="sd-stat-icon">{s.icon}</div>
              <div>
                <div className="sd-stat-label">{s.label}</div>
                <div className="sd-stat-value">{s.value}</div>
              </div>
            </div>
          ))}
        </div>

        <div className="sd-grid">

          {/* ===== ACTIVE EXAMS ===== */}
          <div className="sd-panel">
            <div className="sd-panel-head">
              <h3 className="sd-panel-title"><span className="ico" style={{ background: 'var(--accent-l)' }}>▶</span> Active Examinations</h3>
              <button className="sd-panel-link" onClick={() => navigate('/student/tests')}>VIEW ALL →</button>
            </div>
            {(availableTests?.length || 0) === 0 ? (
              <div className="sd-empty">
                <span className="sd-empty-icon">📭</span>
                <p>No active examinations found.<br />Check back when your teacher schedules one.</p>
              </div>
            ) : (
              availableTests.slice(0, 5).map((test, idx) => {
                const unavailable = isUnavailable(test);
                const taken = isTaken(test);
                const testId = getId(test);
                return (
                  <div className={`sd-exam ${unavailable ? 'sd-exam--done' : ''}`} key={testId || idx}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <div className={`sd-exam-num ${unavailable ? 'sd-exam-num--grey' : 'sd-exam-num--ok'}`}>
                        {unavailable ? '✓' : String(idx + 1).padStart(2, '0')}
                      </div>
                      <div style={{ minWidth: 0 }}>
                        <div className="sd-exam-title">
                          {test.title}
                          {taken && <span className="sd-pill sd-pill--done">COMPLETED</span>}
                          {!taken && isExpired(test) && <span className="sd-pill sd-pill--expired">EXPIRED</span>}
                        </div>
                        <div className="sd-exam-meta">
                          <span className="sd-chip">📘 {test.subjectId?.name || test.subjectName || 'General'}</span>
                          <span className="sd-chip">⏱ {test.duration} min</span>
                          <span className="sd-chip">❓ {test.totalQuestions || test.questions?.length || '—'} Qs</span>
                        </div>
                      </div>
                    </div>
                    {unavailable ? (
                      <button className="sd-btn-gone" onClick={() => handleUnavailableClick(test)} title="Click for details">
                        {taken ? 'TAKEN' : 'EXPIRED'}
                      </button>
                    ) : (
                      <button className="sd-btn-start" onClick={() => handleStartTest(test)} title="Start this examination">
                        START <span>▶</span>
                      </button>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* ===== PERFORMANCE HISTORY ===== */}
          <div className="sd-panel">
            <div className="sd-panel-head">
              <h3 className="sd-panel-title"><span className="ico" style={{ background: '#eff6ff' }}>📋</span> Performance History</h3>
              <button className="sd-panel-link" onClick={() => navigate('/student/results')}>VIEW ALL →</button>
            </div>
            {(recentResults?.length || 0) === 0 ? (
              <div className="sd-empty">
                <span className="sd-empty-icon">📊</span>
                <p>No performance records available.<br />Your published results will appear here.</p>
              </div>
            ) : (
              recentResults.map((result, index) => {
                const color = getScoreColor(result.percentage || 0);
                return (
                  <div className="sd-result" key={index}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
                      <ScoreRing value={result.percentage || 0} color={color} />
                      <div style={{ minWidth: 0 }}>
                        <div className="sd-result-title">{result.testTitle || 'Unknown Test'}</div>
                        <div className="sd-result-sub">{result.subjectName || 'Unknown Subject'}</div>
                      </div>
                    </div>
                    <span className={result.passed ? 'sd-badge-pass' : 'sd-badge-fail'}>
                      {result.passed ? 'PASSED' : 'FAILED'}
                    </span>
                  </div>
                );
              })
            )}
          </div>

        </div>
      </div>

      {/* ===== FOOTER ===== */}
      <div className="sd-footer">
        © {new Date().getFullYear()} SCHOOL MANAGEMENT SYSTEM · STRICTLY CONFIDENTIAL · UNAUTHORIZED ACCESS IS PROHIBITED
      </div>
    </div>
  );
};

export default StudentDashboard;