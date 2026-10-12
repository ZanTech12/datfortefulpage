import React, { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { studentsAPI } from '../../api';

const PromoteStudents = () => {
  const queryClient = useQueryClient();
  const [preview, setPreview] = useState(null);
  const [result, setResult] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isPromoting, setIsPromoting] = useState(false);
  const [error, setError] = useState('');
  const [confirmText, setConfirmText] = useState('');

  const handlePreview = async () => {
    setIsLoading(true); setError(''); setPreview(null); setResult(null);
    try {
      const response = await studentsAPI.promotionPreview();
      setPreview(response.data);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to build the promotion plan.');
    } finally { setIsLoading(false); }
  };

  const handlePromote = async () => {
    setIsPromoting(true); setError('');
    try {
      const response = await studentsAPI.promoteStudents();
      setResult(response);
      setPreview(null); setConfirmText('');
      queryClient.invalidateQueries({ queryKey: ['students'] });
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      queryClient.invalidateQueries({ queryKey: ['classes-list'] });
    } catch (err) {
      setError(err.response?.data?.message || 'Promotion failed.');
    } finally { setIsPromoting(false); }
  };

  const canExecute = confirmText.trim().toUpperCase() === 'PROMOTE';
  const catLabel = (c) => (c === 'primary' ? 'Primary School' : 'Secondary School');

  const regularMoves = preview ? preview.moveSummary.filter(m => !m.transition) : [];
  const transitionMoves = preview ? preview.moveSummary.filter(m => m.transition) : [];

  const renderMoveTable = (title, moves) => {
    if (!moves || moves.length === 0) return null;
    return (
      <div className="pr-section" style={{ marginTop: 12 }}>
        <div className="pr-cat-header">{title}</div>
        <table className="pr-table">
          <thead><tr><th>From</th><th></th><th>To</th><th>Students</th></tr></thead>
          <tbody>
            {moves.map((m, i) => (
              <tr key={i}><td>{m.from}</td><td>→</td><td>{m.to}</td><td><strong>{m.count}</strong></td></tr>
            ))}
          </tbody>
        </table>
      </div>
    );
  };

  return (
    <div className="pr-card">
      <style>{`
        .pr-card { background: #fff; border: 1px solid #e2e8f0; border-radius: 12px; padding: 20px; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: #0f172a; }
        .pr-title { font-size: 1.05rem; font-weight: 700; margin: 0 0 4px; }
        .pr-sub { font-size: 0.8rem; color: #64748b; margin: 0 0 16px; line-height: 1.5; }
        .pr-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: 8px; font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; }
        .pr-btn:disabled { opacity: 0.5; cursor: not-allowed; }
        .pr-btn-primary { background: #4f46e5; color: #fff; }
        .pr-btn-primary:hover:not(:disabled) { background: #4338ca; }
        .pr-btn-danger { background: #dc2626; color: #fff; }
        .pr-btn-danger:hover:not(:disabled) { background: #b91c1c; }
        .pr-input { padding: 9px 12px; border: 1px solid #e2e8f0; border-radius: 8px; font-size: 0.85rem; outline: none; text-transform: uppercase; letter-spacing: 0.05em; width: 180px; }
        .pr-input:focus { border-color: #dc2626; }
        .pr-section { border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden; }
        .pr-cat-header { padding: 8px 12px; background: #f1f5f9; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.05em; color: #475569; border-bottom: 1px solid #e2e8f0; }
        .pr-table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .pr-table th { text-align: left; padding: 8px 12px; background: #f8fafc; color: #64748b; font-size: 0.7rem; text-transform: uppercase; letter-spacing: 0.04em; border-bottom: 1px solid #e2e8f0; }
        .pr-table td { padding: 8px 12px; border-bottom: 1px solid #f1f5f9; }
        .pr-table tr:last-child td { border-bottom: none; }
        .pr-stats { display: grid; grid-template-columns: repeat(5, 1fr); gap: 10px; margin-top: 16px; }
        .pr-stat { background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 12px; text-align: center; }
        .pr-stat-value { font-size: 1.3rem; font-weight: 800; }
        .pr-stat-label { font-size: 0.62rem; text-transform: uppercase; letter-spacing: 0.04em; color: #64748b; margin-top: 2px; }
        .pr-warn { margin-top: 12px; padding: 10px 14px; background: #fffbeb; border: 1px solid #fde68a; color: #92400e; border-radius: 8px; font-size: 0.8rem; line-height: 1.6; }
        .pr-ok { margin-top: 12px; padding: 10px 14px; background: #ecfdf5; border: 1px solid #a7f3d0; color: #065f46; border-radius: 8px; font-size: 0.8rem; line-height: 1.6; }
        .pr-err { margin-top: 12px; padding: 10px 14px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; border-radius: 8px; font-size: 0.8rem; }
        .pr-confirm { margin-top: 16px; padding: 14px; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; }
        .pr-confirm-label { font-size: 0.78rem; font-weight: 600; color: #991b1b; margin-bottom: 8px; }
        .pr-grad { background: #fef2f2; }
        .pr-trans { background: #eff6ff; }
        @media (max-width: 640px) { .pr-stats { grid-template-columns: 1fr 1fr; } }
      `}</style>

      <h3 className="pr-title">🎓 Student Promotion (by Category)</h3>
      <p className="pr-sub">
        Moves students up within their school category. <strong>Primary 5 automatically crosses to JSS 1</strong> (Secondary School);
        SSS 3 graduates to the recycle bin. Entry classes reset for new intakes.
      </p>

      <button className="pr-btn pr-btn-primary" onClick={handlePreview} disabled={isLoading || isPromoting}>
        {isLoading ? 'Building plan...' : '1. Preview Promotion'}
      </button>

      {error && <div className="pr-err">{error}</div>}

      {preview && (
        <>
          <div className="pr-stats">
            <div className="pr-stat">
              <div className="pr-stat-value" style={{ color: '#4f46e5' }}>{preview.moveSummary.reduce((s, m) => s + m.count, 0)}</div>
              <div className="pr-stat-label">Moving Up</div>
            </div>
            <div className="pr-stat">
              <div className="pr-stat-value" style={{ color: '#2563eb' }}>{preview.transitionCount || 0}</div>
              <div className="pr-stat-label">P5 → JSS 1</div>
            </div>
            <div className="pr-stat">
              <div className="pr-stat-value" style={{ color: '#dc2626' }}>{preview.graduateCount}</div>
              <div className="pr-stat-label">Graduating</div>
            </div>
            <div className="pr-stat">
              <div className="pr-stat-value" style={{ color: '#f59e0b' }}>{preview.apexStopCount}</div>
              <div className="pr-stat-label">Can't Move</div>
            </div>
            <div className="pr-stat">
              <div className="pr-stat-value" style={{ color: '#64748b' }}>{preview.totalStudents}</div>
              <div className="pr-stat-label">Active Students</div>
            </div>
          </div>

          {renderMoveTable('Primary School (KG 1 → Primary 4)', regularMoves.filter(m => m.category === 'primary'))}
          {renderMoveTable('Secondary School (JSS 1 → SSS 2)', regularMoves.filter(m => m.category === 'secondary'))}

          {/* ===== Category Transition: Primary 5 → JSS 1 ===== */}
          {transitionMoves.length > 0 && (
            <div className="pr-section" style={{ marginTop: 12, borderColor: '#bfdbfe' }}>
              <div className="pr-cat-header" style={{ background: '#eff6ff', color: '#1e40af' }}>🔄 Category Transition — Primary 5 → JSS 1</div>
              <table className="pr-table">
                <thead><tr><th>From</th><th></th><th>To</th><th>Students</th></tr></thead>
                <tbody>
                  {transitionMoves.map((m, i) => (
                    <tr key={i} className="pr-trans"><td>{m.from}</td><td>→</td><td>{m.to}</td><td><strong>{m.count}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.graduateClasses && preview.graduateClasses.length > 0 && (
            <div className="pr-section" style={{ marginTop: 12, borderColor: '#fecaca' }}>
              <div className="pr-cat-header" style={{ background: '#fef2f2', color: '#991b1b' }}>♻️ Graduating to Recycle Bin (school exit)</div>
              <table className="pr-table">
                <tbody>
                  {preview.graduateClasses.map((g, i) => (
                    <tr key={i} className="pr-grad"><td>{g.className}</td><td>♻️ Recycle Bin</td><td><strong>{g.count}</strong></td></tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {preview.apexStops && preview.apexStops.length > 0 && (
            <div className="pr-warn">
              <strong>⏸️ These students can't move (fix the issue first if you want them included):</strong>
              {preview.apexStops.map((a, i) => (
                <div key={i}>• {a.count} student(s) in <strong>{a.className}</strong> — {a.reason || `apex of ${catLabel(a.category)}`}</div>
              ))}
            </div>
          )}

          {preview.noCategory && preview.noCategory.length > 0 && (
            <div className="pr-warn">
              <strong>⚠️ These classes have no category set (students won't move):</strong>
              {preview.noCategory.map((c, i) => <div key={i}>• {c.className} ({c.count} students) — set the category in Manage Classes.</div>)}
            </div>
          )}

          {preview.noTarget && preview.noTarget.length > 0 && (
            <div className="pr-warn">
              <strong>⚠️ The next class doesn't exist for these (students won't move):</strong>
              {preview.noTarget.map((n, i) => <div key={i}>• {n.count} in {n.className} — create "{n.missing}" first.</div>)}
            </div>
          )}

          {preview.unmatched && preview.unmatched.length > 0 && (
            <div className="pr-warn">
              <strong>⚠️ These class names aren't on the promotion ladder:</strong>
              {preview.unmatched.map((u, i) => <div key={i}>• {u.className} ({u.count} students)</div>)}
            </div>
          )}

          {preview.unassignedCount > 0 && (
            <div className="pr-warn">• {preview.unassignedCount} student(s) have no class assigned — they won't move.</div>
          )}

          {preview.entryClasses && preview.entryClasses.length > 0 && (
            <div className="pr-ok">
              <strong>After promotion:</strong>
              {preview.entryClasses.map((e, i) => (
                <div key={i}>
                  • <strong>{e.label}</strong> — {e.receivesTransition
                    ? `receives the ${e.receivesTransition === 'primary' ? 'Primary School' : 'Secondary School'} transition students (plus any new admissions)`
                    : 'empty — ready for new intakes'}
                </div>
              ))}
            </div>
          )}

          <div className="pr-confirm">
            <div className="pr-confirm-label">2. To execute, type PROMOTE (this cannot be undone):</div>
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
              <input className="pr-input" value={confirmText} onChange={(e) => setConfirmText(e.target.value)} placeholder="PROMOTE" disabled={isPromoting} />
              <button className="pr-btn pr-btn-danger" onClick={handlePromote} disabled={!canExecute || isPromoting}>
                {isPromoting ? 'Promoting...' : 'Promote All Students'}
              </button>
            </div>
          </div>
        </>
      )}

      {result && (
        <div className="pr-ok">
          <strong>✅ {result.message}</strong>
          <div style={{ marginTop: 6 }}>
            Moved: {result.data.movedCount}
            {result.data.transitionCount > 0 ? ` (incl. ${result.data.transitionCount} crossing to JSS 1)` : ''}
            {' '}• Graduated: {result.data.graduateCount} • Couldn't move: {result.data.apexStopCount}
          </div>
        </div>
      )}
    </div>
  );
};

export default PromoteStudents;