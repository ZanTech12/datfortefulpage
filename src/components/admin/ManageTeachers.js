import React, { useState, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { teachersAPI } from '../../api';
import Loading from '../common/Loading';

// ── Time Utilities ──
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Never';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  if (diffMs < 0) return 'Just now';
  const s = Math.floor(diffMs / 1000);
  const m = Math.floor(s / 60);
  const h = Math.floor(m / 60);
  const d = Math.floor(h / 24);
  const w = Math.floor(d / 7);
  const mo = Math.floor(d / 30);
  if (s < 10) return 'Just now';
  if (s < 60) return `${s}s ago`;
  if (m < 60) return `${m}m ago`;
  if (h < 24) return `${h}h ago`;
  if (d === 1) return 'Yesterday';
  if (d < 7) return `${d}d ago`;
  if (w < 5) return `${w}w ago`;
  if (mo < 12) return `${mo}mo ago`;
  return date.toLocaleDateString('en-US', {
    month: 'short', day: 'numeric',
    year: date.getFullYear() !== now.getFullYear() ? 'numeric' : undefined,
  });
};

const isOnline = (dateString, thresholdMin = 10) => {
  if (!dateString) return false;
  return (Date.now() - new Date(dateString).getTime()) < thresholdMin * 60 * 1000;
};

const parseDevice = (ua) => {
  if (!ua) return '';
  const u = ua.toLowerCase();
  if (u.includes('edg')) return 'Edge';
  if (u.includes('chrome')) return 'Chrome';
  if (u.includes('firefox')) return 'Firefox';
  if (u.includes('safari') && !u.includes('chrome')) return 'Safari';
  if (u.includes('opera') || u.includes('opr')) return 'Opera';
  if (u.includes('android')) return 'Android';
  if (u.includes('iphone') || u.includes('ipad')) return 'iOS';
  return 'Browser';
};

const formatFullDate = (dateString) => {
  if (!dateString) return '';
  return new Date(dateString).toLocaleString('en-US', {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
};

// ── CSV Parser ──
// Required: firstName, lastName, email, username ONLY.
// Optional: password (blank = default below), phone, address,
// qualification, experience.
const DEFAULT_CSV_PASSWORD = 'Teacher@123'; // keep in sync with backend POST /teachers

const parseCSV = (text) => {
  const lines = text.split(/\r\n|\n/).filter((l) => l.trim());
  if (lines.length < 2) return { headers: [], rows: [], error: 'CSV must have a header row and at least one data row' };
  const parseLine = (line) => {
    const result = []; let current = ''; let inQ = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') { if (inQ && line[i + 1] === '"') { current += '"'; i++; } else inQ = !inQ; }
      else if (c === ',' && !inQ) { result.push(current.trim()); current = ''; }
      else current += c;
    }
    result.push(current.trim());
    return result;
  };
  const headers = parseLine(lines[0]).map((h) => h.toLowerCase().replace(/\s+/g, ''));
  const rows = []; const errors = [];
  for (let i = 1; i < lines.length; i++) {
    const values = parseLine(lines[i]);
    if (values.every((v) => !v)) continue;
    const row = {};
    headers.forEach((h, idx) => { row[h] = values[idx] || ''; });
    const re = [];
    if (!row.firstname) re.push('First name required');
    if (!row.lastname) re.push('Last name required');
    if (!row.email) re.push('Email required');
    if (!row.username) re.push('Username required');
    // password, phone, address, qualification, experience — all optional
    if (re.length) { errors.push({ row: i + 1, errors: re, data: row }); continue; }
    rows.push({
      firstName: row.firstname || '', lastName: row.lastname || '', email: row.email || '',
      username: row.username || '',
      password: row.password || DEFAULT_CSV_PASSWORD, // blank -> default password
      phone: row.phone || '',
      address: row.address || '',
      qualification: row.qualification || '',
      experience: parseInt(row.experience) || 0,
    });
  }
  return { headers, rows, errors, error: null };
};

const generateCSVTemplate = () =>
  ['firstName,lastName,email,username,password,phone,address,qualification,experience',
    'John,Doe,john.doe@example.com,johndoe,password123,1234567890,123 Main St,PhD,5'].join('\n');

const downloadTemplate = () => {
  const blob = new Blob([generateCSVTemplate()], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'teachers_template.csv';
  link.click();
  URL.revokeObjectURL(link.href);
};

const getInitials = (f, l) => `${(f || '')[0] || ''}${(l || '')[0] || ''}`.toUpperCase();
const avatarColor = (name) => {
  const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#3b82f6'];
  let h = 0;
  for (let i = 0; i < (name || '').length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return colors[Math.abs(h) % colors.length];
};

// ── ONLINE THRESHOLD (minutes) ──
const ONLINE_THRESHOLD_MIN = 10;
const REFRESH_INTERVAL_MS = 30000;

// ════════════════════════════════════════════════════════════════
const ManageTeachers = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [editingTeacher, setEditingTeacher] = useState(null);
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [showOnlineOnly, setShowOnlineOnly] = useState(false);
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', email: '', username: '', password: '',
    phone: '', address: '', qualification: '', experience: 0,
  });
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [csvFile, setCsvFile] = useState(null);
  const [csvData, setCsvData] = useState(null);
  const [csvErrors, setCsvErrors] = useState([]);
  const [csvParseError, setCsvParseError] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [csvUploadProgress, setCsvUploadProgress] = useState({ current: 0, total: 0 });

  const { data: teachers, isLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAll,
    refetchInterval: REFRESH_INTERVAL_MS,
  });

  const createMutation = useMutation({
    mutationFn: teachersAPI.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create teacher'),
  });
  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => teachersAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teachers'] }); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update teacher'),
  });
  const deleteMutation = useMutation({
    mutationFn: teachersAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['teachers'] }),
  });
  const bulkUploadMutation = useMutation({
    mutationFn: async (list) => {
      const results = { success: [], failed: [] };
      for (let i = 0; i < list.length; i++) {
        setCsvUploadProgress({ current: i + 1, total: list.length });
        try { await teachersAPI.create(list[i]); results.success.push(list[i]); }
        catch (err) { results.failed.push({ teacher: list[i], error: err.response?.data?.message || 'Upload failed' }); }
      }
      return results;
    },
    onSuccess: (results) => {
      queryClient.invalidateQueries({ queryKey: ['teachers'] });
      if (results.failed.length === 0) handleCloseCSVModal();
    },
  });

  // ── Filtered list ──
  const filteredTeachers = (() => {
    if (!teachers?.data) return [];
    let list = teachers.data;
    if (showOnlineOnly) list = list.filter((t) => isOnline(t.lastLogin, ONLINE_THRESHOLD_MIN));
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter((t) => {
        const full = `${t.firstName} ${t.lastName}`.toLowerCase();
        return full.includes(q) || t.email?.toLowerCase().includes(q) || t.username?.toLowerCase().includes(q);
      });
    }
    return list;
  })();

  const onlineCount = teachers?.data?.filter((t) => isOnline(t.lastLogin, ONLINE_THRESHOLD_MIN)).length || 0;

  // ── Handlers ──
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, [name]: value }));
    setError(''); setSuccessMessage('');
  };
  const handleOpenCreate = () => {
    setEditingTeacher(null);
    setFormData({ firstName: '', lastName: '', email: '', username: '', password: '', phone: '', address: '', qualification: '', experience: 0 });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };
  const handleOpenEdit = (t) => {
    setEditingTeacher(t);
    setFormData({ firstName: t.firstName || '', lastName: t.lastName || '', email: t.email || '', username: t.username || '', password: '', phone: t.phone || '', address: t.address || '', qualification: t.qualification || '', experience: t.experience || 0 });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };
  const handleCloseModal = () => { setShowModal(false); setEditingTeacher(null); setError(''); setSuccessMessage(''); };
  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingTeacher) updateMutation.mutate({ id: editingTeacher._id, data: formData });
    else { if (!formData.password) { setError('Password is required for new teachers'); return; } createMutation.mutate(formData); }
  };
  const handleDelete = (id) => { if (window.confirm('Are you sure you want to delete this teacher?')) deleteMutation.mutate(id); };
  const toggleActionMenu = (id, e) => { e.stopPropagation(); setOpenActionMenu(openActionMenu === id ? null : id); };

  // ── CSV handlers ──
  const handleOpenCSVModal = () => {
    setCsvFile(null); setCsvData(null); setCsvErrors([]); setCsvParseError(''); setIsDragging(false);
    setCsvUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowCSVModal(true);
  };
  const handleCloseCSVModal = () => {
    setShowCSVModal(false); setCsvFile(null); setCsvData(null); setCsvErrors([]); setCsvParseError(''); setIsDragging(false);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };
  const handleCSVFileSelect = (file) => {
    if (!file) return;
    if (!file.name.endsWith('.csv')) { setCsvParseError('Please select a .csv file'); setCsvData(null); return; }
    setCsvFile(file); setCsvData(null); setCsvErrors([]); setCsvParseError('');
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const result = parseCSV(e.target.result);
        if (result.error) { setCsvParseError(result.error); return; }
        setCsvData(result.rows); setCsvErrors(result.errors);
      } catch { setCsvParseError('Failed to parse CSV'); }
    };
    reader.readAsText(file);
  };
  const handleFileInputChange = (e) => handleCSVFileSelect(e.target.files[0]);
  const handleDragEnter = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(true); };
  const handleDragLeave = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); };
  const handleDragOver = (e) => { e.preventDefault(); e.stopPropagation(); };
  const handleDrop = (e) => { e.preventDefault(); e.stopPropagation(); setIsDragging(false); if (e.dataTransfer.files?.length) handleCSVFileSelect(e.dataTransfer.files[0]); };
  const handleBulkUpload = () => { if (csvData?.length) bulkUploadMutation.mutate(csvData); };

  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') { if (showCSVModal) handleCloseCSVModal(); else if (showModal) handleCloseModal(); } };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [showModal, showCSVModal]);
  useEffect(() => {
    document.body.style.overflow = showModal || showCSVModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showModal, showCSVModal]);
  useEffect(() => {
    const handler = () => setOpenActionMenu(null);
    document.addEventListener('click', handler);
    return () => document.removeEventListener('click', handler);
  }, []);

  if (isLoading) return <Loading message="Loading teachers..." />;
  const isSaving = createMutation.isPending || updateMutation.isPending;
  const isUploading = bulkUploadMutation.isPending;
  const uploadResults = bulkUploadMutation.data;

  // ── Shared styles (injected once) ──
  const cssVars = {
    '--bg': '#f1f5f9', '--surface': '#ffffff', '--border': '#e2e8f0',
    '--text': '#0f172a', '--text2': '#475569', '--muted': '#94a3b8',
    '--primary': '#4f46e5', '--primary-h': '#4338ca', '--primary-l': '#eef2ff',
    '--danger': '#ef4444', '--danger-h': '#dc2626', '--success': '#10b981',
    '--success-l': '#ecfdf5', '--warning': '#f59e0b', '--warning-l': '#fffbeb',
    '--radius': '12px', '--radius-sm': '8px',
    '--shadow-sm': '0 1px 2px rgba(0,0,0,0.05)',
    '--shadow': '0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06)',
    '--shadow-lg': '0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1)',
    '--tr': '150ms cubic-bezier(0.4,0,0.2,1)',
  };

  return (
    <div className="mt-root" style={cssVars}>
      <style>{`
        .mt-root{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;color:var(--text);-webkit-font-smoothing:antialiased}
        .mt-header{background:var(--surface);border-bottom:1px solid var(--border);padding:20px 24px;position:sticky;top:0;z-index:30}
        .mt-header-top{display:flex;align-items:center;justify-content:space-between;gap:12px;flex-wrap:wrap}
        .mt-title{font-size:1.35rem;font-weight:700;margin:0;letter-spacing:-0.02em}
        .mt-sub{font-size:.82rem;color:var(--muted);margin:2px 0 0;display:flex;align-items:center;gap:8px}
        .mt-header-actions{display:flex;gap:8px;flex-wrap:wrap}
        .mt-btn{display:inline-flex;align-items:center;gap:6px;padding:9px 16px;border-radius:var(--radius-sm);font-size:.82rem;font-weight:600;border:none;cursor:pointer;transition:all var(--tr);white-space:nowrap;line-height:1.4}
        .mt-btn:active{transform:scale(.97)}
        .mt-btn-primary{background:var(--primary);color:#fff}.mt-btn-primary:hover{background:var(--primary-h)}
        .mt-btn-success{background:var(--success);color:#fff}.mt-btn-success:hover{background:#059669}
        .mt-btn-ghost{background:var(--surface);color:var(--text2);border:1px solid var(--border)}.mt-btn-ghost:hover{background:#f8fafc;border-color:#cbd5e1}
        .mt-btn-danger{background:var(--danger);color:#fff}.mt-btn-danger:hover{background:var(--danger-h)}
        .mt-btn-sm{padding:6px 12px;font-size:.78rem}
        .mt-btn:disabled{opacity:.5;cursor:not-allowed;transform:none!important}
        .mt-btn svg{width:15px;height:15px;flex-shrink:0}
        .mt-search-bar{padding:12px 24px;background:var(--bg);border-bottom:1px solid var(--border);display:flex;align-items:center;gap:12px;flex-wrap:wrap}
        .mt-search-wrap{flex:1;min-width:200px;max-width:420px;position:relative}
        .mt-search-wrap svg{position:absolute;left:12px;top:50%;transform:translateY(-50%);color:var(--muted);width:16px;height:16px;pointer-events:none}
        .mt-search-input{width:100%;padding:10px 36px 10px 38px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);font-size:.88rem;color:var(--text);outline:none;transition:border-color var(--tr),box-shadow var(--tr);box-sizing:border-box;-webkit-appearance:none}
        .mt-search-input::placeholder{color:var(--muted)}
        .mt-search-input:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,.12)}
        .mt-search-clear{position:absolute;right:8px;top:50%;transform:translateY(-50%);background:#e2e8f0;border:none;border-radius:50%;width:22px;height:22px;display:flex;align-items:center;justify-content:center;cursor:pointer;color:var(--muted);font-size:14px;line-height:1}
        .mt-filters{display:flex;align-items:center;gap:10px}
        .mt-filter-chip{display:inline-flex;align-items:center;gap:5px;padding:6px 12px;border-radius:20px;font-size:.78rem;font-weight:600;border:1px solid var(--border);background:var(--surface);cursor:pointer;transition:all var(--tr);color:var(--text2)}
        .mt-filter-chip:hover{border-color:#cbd5e1;background:#f8fafc}
        .mt-filter-chip.active{border-color:var(--success);background:var(--success-l);color:#065f46}
        .mt-filter-chip .dot{width:7px;height:7px;border-radius:50%;background:var(--muted);transition:background .2s}
        .mt-filter-chip.active .dot{background:var(--success);animation:mtPulse 2s infinite}
        @keyframes mtPulse{0%,100%{opacity:1}50%{opacity:.4}}
        .mt-result-count{font-size:.8rem;color:var(--muted);font-weight:500;white-space:nowrap}
        .mt-alert{padding:12px 16px;border-radius:var(--radius-sm);font-size:.84rem;font-weight:500;display:flex;align-items:center;gap:8px;margin:12px 24px 0;animation:mtSlide .25s ease}
        .mt-alert-success{background:var(--success-l);color:#065f46;border:1px solid #a7f3d0}
        .mt-alert-danger{background:#fef2f2;color:#991b1b;border:1px solid #fecaca}
        .mt-alert-close{margin-left:auto;background:none;border:none;cursor:pointer;font-size:1.2rem;line-height:1;opacity:.6;color:inherit;padding:0 2px}
        @keyframes mtSlide{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}

        /* ── Online Badge ── */
        .mt-online-badge{display:inline-flex;align-items:center;gap:6px;font-size:.72rem;font-weight:600;padding:3px 10px;border-radius:20px}
        .mt-online-badge.online{background:#dcfce7;color:#166534}
        .mt-online-badge.offline{background:#f1f5f9;color:#64748b}
        .mt-online-dot{width:7px;height:7px;border-radius:50%;flex-shrink:0}
        .mt-online-dot.online{background:#22c55e;box-shadow:0 0 0 2px rgba(34,197,94,.3);animation:mtPulse 2s infinite}
        .mt-online-dot.offline{background:#cbd5e1}
        .mt-last-seen{font-size:.75rem;color:var(--muted);font-weight:500;margin-top:2px;display:flex;align-items:center;gap:4px}
        .mt-last-seen svg{width:12px;height:12px;flex-shrink:0}

        /* ── Avatar ── */
        .mt-avatar{width:40px;height:40px;border-radius:50%;display:flex;align-items:center;justify-content:center;color:#fff;font-weight:700;font-size:.8rem;flex-shrink:0;position:relative;letter-spacing:.02em}
        .mt-avatar .status-ring{position:absolute;bottom:-1px;right:-1px;width:12px;height:12px;border-radius:50%;border:2px solid var(--surface)}
        .mt-avatar .status-ring.online{background:#22c55e;box-shadow:0 0 0 1px rgba(34,197,94,.3)}
        .mt-avatar .status-ring.offline{background:#cbd5e1}

        /* ── Desktop Table ── */
        .mt-table-section{display:none;background:var(--surface);min-height:200px}
        .mt-table-wrap{overflow-x:auto;-webkit-overflow-scrolling:touch}
        .mt-table{width:100%;border-collapse:collapse;font-size:.88rem;min-width:820px}
        .mt-table thead{background:#f8fafc;position:sticky;top:0;z-index:5}
        .mt-table th{padding:12px 16px;text-align:left;font-weight:600;font-size:.76rem;text-transform:uppercase;letter-spacing:.04em;color:var(--muted);border-bottom:1px solid var(--border);white-space:nowrap}
        .mt-table td{padding:14px 16px;border-bottom:1px solid var(--border);vertical-align:middle}
        .mt-table tbody tr{transition:background var(--tr)}
        .mt-table tbody tr:hover{background:#f8fafc}
        .mt-table tbody tr:last-child td{border-bottom:none}
        .mt-empty{text-align:center;padding:48px 24px;color:var(--muted)}

        /* ── Mobile Cards ── */
        .mt-cards{display:flex;flex-direction:column;gap:10px;padding:12px 16px}
        .mt-card{background:var(--surface);border:1px solid var(--border);border-radius:var(--radius);padding:16px;transition:box-shadow var(--tr)}
        .mt-card-top{display:flex;align-items:center;gap:12px;margin-bottom:10px}
        .mt-card-name{font-weight:600;font-size:.95rem;color:var(--text);line-height:1.3}
        .mt-card-sub{font-size:.78rem;color:var(--muted);font-weight:500;margin-top:1px}
        .mt-card-badges{display:flex;gap:6px;flex-wrap:wrap;margin-left:auto;align-items:center}
        .mt-card-grid{display:grid;grid-template-columns:1fr 1fr;gap:8px;margin-bottom:12px}
        .mt-card-field-label{font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
        .mt-card-field-value{font-size:.85rem;color:var(--text);font-weight:500;margin-top:2px}
        .mt-card-actions{display:flex;gap:6px;flex-wrap:wrap;padding-top:12px;border-top:1px solid var(--border)}

        /* ── Action Menu ── */
        .mt-action-wrap{position:relative}
        .mt-action-trigger{width:32px;height:32px;border-radius:8px;border:1px solid var(--border);background:var(--surface);cursor:pointer;display:flex;align-items:center;justify-content:center;transition:all var(--tr)}
        .mt-action-trigger:hover{background:#f8fafc;border-color:#cbd5e1}
        .mt-action-trigger svg{width:16px;height:16px;color:var(--muted)}
        .mt-action-menu{position:absolute;right:0;top:calc(100% + 4px);background:var(--surface);border:1px solid var(--border);border-radius:var(--radius-sm);box-shadow:var(--shadow-lg);min-width:200px;z-index:50;overflow:hidden;animation:mtMenuIn .15s ease}
        @keyframes mtMenuIn{from{opacity:0;transform:translateY(-4px) scale(.97)}to{opacity:1;transform:translateY(0) scale(1)}}
        .mt-action-item{display:flex;align-items:center;gap:8px;width:100%;padding:10px 14px;border:none;background:none;font-size:.82rem;font-weight:500;color:var(--text2);cursor:pointer;transition:background var(--tr);text-align:left}
        .mt-action-item:hover{background:#f8fafc}
        .mt-action-item svg{width:15px;height:15px;flex-shrink:0}
        .mt-action-item.danger{color:var(--danger)}
        .mt-action-item.danger:hover{background:#fef2f2}
        .mt-action-sep{height:1px;background:var(--border);margin:2px 0}
        .mt-action-label{padding:6px 14px 4px;font-size:.7rem;font-weight:600;text-transform:uppercase;letter-spacing:.04em;color:var(--muted)}
        .mt-click-outside{position:fixed;inset:0;z-index:40}

        /* ── Modal ── */
        .mt-modal-overlay{position:fixed;inset:0;background:rgba(15,23,42,.5);backdrop-filter:blur(4px);z-index:100;display:flex;align-items:flex-end;justify-content:center;animation:mtFade .2s ease}
        @keyframes mtFade{from{opacity:0}to{opacity:1}}
        .mt-modal{background:var(--surface);border-radius:20px 20px 0 0;width:100%;max-width:560px;max-height:90vh;overflow-y:auto;-webkit-overflow-scrolling:touch;animation:mtSlideUp .3s cubic-bezier(.16,1,.3,1)}
        @keyframes mtSlideUp{from{transform:translateY(100%)}to{transform:translateY(0)}}
        .mt-modal-handle{width:36px;height:4px;border-radius:2px;background:#cbd5e1;margin:10px auto 0}
        .mt-modal-header{display:flex;align-items:center;justify-content:space-between;padding:16px 20px 0}
        .mt-modal-title{font-size:1.1rem;font-weight:700;margin:0}
        .mt-modal-close{width:32px;height:32px;border-radius:50%;border:none;background:#f1f5f9;cursor:pointer;display:flex;align-items:center;justify-content:center;color:var(--muted);font-size:1.2rem;transition:all var(--tr)}
        .mt-modal-close:hover{background:#e2e8f0;color:var(--text)}
        .mt-modal-body{padding:20px}
        .mt-modal-footer{display:flex;gap:10px;padding:0 20px 24px;justify-content:flex-end;flex-wrap:wrap}

        /* ── Form ── */
        .mt-form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;margin-bottom:14px}
        .mt-form-group{display:flex;flex-direction:column;gap:5px}
        .mt-form-group.full{grid-column:1/-1}
        .mt-form-label{font-size:.78rem;font-weight:600;color:var(--text2)}
        .mt-form-input,.mt-form-select{width:100%;padding:10px 14px;border-radius:var(--radius-sm);border:1px solid var(--border);background:var(--surface);font-size:.88rem;color:var(--text);outline:none;transition:border-color var(--tr),box-shadow var(--tr);box-sizing:border-box;-webkit-appearance:none;appearance:none}
        .mt-form-input::placeholder{color:var(--muted)}
        .mt-form-input:focus,.mt-form-select:focus{border-color:var(--primary);box-shadow:0 0 0 3px rgba(79,70,229,.12)}
        .mt-form-input:disabled,.mt-form-select:disabled{background:#f8fafc;color:var(--muted);cursor:not-allowed}
        .mt-form-select{background-image:url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E");background-repeat:no-repeat;background-position:right 12px center;padding-right:36px}
        .mt-form-select option{color:var(--text);background:var(--surface)}

        /* ── CSV Upload ── */
        .mt-drop-zone{border:2px dashed var(--border);border-radius:var(--radius);padding:32px 20px;text-align:center;cursor:pointer;transition:all var(--tr)}
        .mt-drop-zone:hover,.mt-drop-zone.dragging{border-color:var(--primary);background:var(--primary-l)}
        .mt-drop-zone.has-file{border-color:var(--success);background:var(--success-l)}
        .mt-progress-bar{height:6px;background:#e2e8f0;border-radius:3px;overflow:hidden}
        .mt-progress-fill{height:100%;background:var(--primary);border-radius:3px;transition:width .3s ease}
        .mt-upload-log{max-height:160px;overflow-y:auto;background:#f8fafc;padding:12px;border-radius:var(--radius-sm);font-family:'SF Mono','Fira Code',monospace;font-size:.76rem;line-height:1.6;color:var(--text2)}
        .mt-upload-preview{max-height:200px;overflow-y:auto;border:1px solid var(--border);border-radius:var(--radius-sm)}
        .mt-upload-preview table{width:100%;border-collapse:collapse;font-size:.8rem}
        .mt-upload-preview th{padding:8px 10px;text-align:left;font-weight:600;font-size:.72rem;text-transform:uppercase;color:var(--muted);background:#f8fafc;position:sticky;top:0}
        .mt-upload-preview td{padding:7px 10px;border-top:1px solid var(--border)}

        /* ── Badge ── */
        .mt-badge{display:inline-flex;align-items:center;gap:4px;padding:3px 10px;border-radius:20px;font-size:.72rem;font-weight:600;white-space:nowrap}
        .mt-badge-blue{background:#dbeafe;color:#1e40af}
        .mt-badge-purple{background:#f3e8ff;color:#6b21a8}
        .mt-badge-gray{background:#f1f5f9;color:#64748b}

        /* ── Responsive ── */
        @media(min-width:768px){
          .mt-modal-overlay{align-items:center}
          .mt-modal{border-radius:20px;max-width:560px}
          .mt-modal-handle{display:none}
          .mt-cards{display:none!important}
          .mt-table-section{display:block!important}
          .mt-header{padding:24px 32px}
          .mt-search-bar{padding:12px 32px}
          .mt-alert{margin-left:32px;margin-right:32px}
          .mt-form-row{gap:16px}
        }
        @media(max-width:767px){
          .mt-header{padding:16px}
          .mt-title{font-size:1.15rem}
          .mt-header-actions{width:100%}
          .mt-header-actions .mt-btn{flex:1;justify-content:center;padding:10px;font-size:.78rem}
          .mt-search-bar{padding:10px 16px}
          .mt-search-wrap{max-width:100%}
          .mt-alert{margin-left:16px;margin-right:16px}
          .mt-table-section{display:none!important}
          .mt-form-row{grid-template-columns:1fr}
          .mt-modal{max-height:95vh;border-radius:16px 16px 0 0}
          .mt-card-actions .mt-btn{flex:1;justify-content:center;font-size:.72rem;padding:8px}
        }
        @media(max-width:380px){
          .mt-header-actions{flex-direction:column}
          .mt-card-grid{grid-template-columns:1fr}
        }
        .mt-root ::-webkit-scrollbar{width:6px;height:6px}
        .mt-root ::-webkit-scrollbar-track{background:transparent}
        .mt-root ::-webkit-scrollbar-thumb{background:#cbd5e1;border-radius:3px}
        @keyframes mtSpin{to{transform:rotate(360deg)}}
      `}</style>

      {/* ═══ HEADER ═══ */}
      <div className="mt-header">
        <div className="mt-header-top">
          <div>
            <h1 className="mt-title">Teachers</h1>
            <p className="mt-sub">
              Manage teacher accounts
              {onlineCount > 0 && (
                <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#22c55e', fontWeight: 600 }}>
                  <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#22c55e', display: 'inline-block' }} />
                  {onlineCount} online
                </span>
              )}
            </p>
          </div>
          <div className="mt-header-actions">
            <button className="mt-btn mt-btn-ghost" onClick={handleOpenCSVModal} title="Upload CSV">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className="mt-btn mt-btn-primary" onClick={handleOpenCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Teacher</span>
            </button>
          </div>
        </div>
      </div>

      {/* ═══ ALERTS ═══ */}
      {error && (
        <div className="mt-alert mt-alert-danger">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
          {error}
          <button className="mt-alert-close" onClick={() => setError('')}>×</button>
        </div>
      )}
      {successMessage && (
        <div className="mt-alert mt-alert-success">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 16, height: 16, flexShrink: 0 }}><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
          {successMessage}
          <button className="mt-alert-close" onClick={() => setSuccessMessage('')}>×</button>
        </div>
      )}

      {/* ═══ SEARCH & FILTERS ═══ */}
      <div className="mt-search-bar">
        <div className="mt-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="mt-search-input" placeholder="Search by name, email, or username..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="mt-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>
        <div className="mt-filters">
          <button className={`mt-filter-chip ${showOnlineOnly ? 'active' : ''}`} onClick={() => setShowOnlineOnly((p) => !p)}>
            <span className="dot" />
            Online only
          </button>
          <span className="mt-result-count">
            {filteredTeachers.length === teachers?.data?.length
              ? `${teachers?.data?.length || 0} teachers`
              : `${filteredTeachers.length} of ${teachers?.data?.length || 0}`}
          </span>
        </div>
      </div>

      {/* ═══ DESKTOP TABLE ═══ */}
      <div className="mt-table-section">
        <div className="mt-table-wrap">
          <table className="mt-table">
            <thead>
              <tr>
                <th>Teacher</th>
                <th>Status</th>
                <th>Last Seen</th>
                <th>Email</th>
                <th>Phone</th>
                <th>Qualification</th>
                <th style={{ width: 50 }}></th>
              </tr>
            </thead>
            <tbody>
              {filteredTeachers.length === 0 ? (
                <tr><td colSpan="7" className="mt-empty"><span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>👨‍🏫</span>{searchTerm || showOnlineOnly ? 'No teachers match your filters' : 'No teachers yet'}</td></tr>
              ) : filteredTeachers.map((t) => {
                const online = isOnline(t.lastLogin, ONLINE_THRESHOLD_MIN);
                return (
                  <tr key={t._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="mt-avatar" style={{ background: avatarColor(`${t.firstName}${t.lastName}`) }}>
                          {getInitials(t.firstName, t.lastName)}
                          <span className={`status-ring ${online ? 'online' : 'offline'}`} />
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '.9rem', lineHeight: 1.3 }}>{t.firstName} {t.lastName}</div>
                          <div style={{ fontSize: '.78rem', color: 'var(--muted)', fontWeight: 500 }}>@{t.username}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className={`mt-online-badge ${online ? 'online' : 'offline'}`}>
                        <span className={`mt-online-dot ${online ? 'online' : 'offline'}`} />
                        {online ? 'Online' : 'Offline'}
                      </span>
                    </td>
                    <td>
                      {t.lastLogin ? (
                        <div className="mt-last-seen" title={formatFullDate(t.lastLogin)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                          {formatRelativeTime(t.lastLogin)}
                          {t.lastLoginDevice && (
                            <span style={{ fontSize: '.68rem', color: 'var(--muted)', opacity: .7 }}> · {parseDevice(t.lastLoginDevice)}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '.78rem', color: 'var(--muted)' }}>Never logged in</span>
                      )}
                    </td>
                    <td style={{ fontSize: '.85rem', color: 'var(--text2)' }}>{t.email}</td>
                    <td style={{ fontSize: '.85rem', color: 'var(--text2)' }}>{t.phone || '—'}</td>
                    <td style={{ fontSize: '.85rem', color: 'var(--text2)' }}>{t.qualification || '—'}</td>
                    <td>
                      <div className="mt-action-wrap">
                        <button className="mt-action-trigger" onClick={(e) => toggleActionMenu(t._id, e)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openActionMenu === t._id && (
                          <>
                            <div className="mt-click-outside" />
                            <div className="mt-action-menu">
                              <div className="mt-action-label">Last Login Info</div>
                              {t.lastLogin ? (
                                <>
                                  <div style={{ padding: '4px 14px 8px', fontSize: '.76rem', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
                                    <div style={{ fontWeight: 600, color: 'var(--text)', marginBottom: 4 }}>{formatFullDate(t.lastLogin)}</div>
                                    {t.lastLoginDevice && <div style={{ opacity: .7 }}>Device: {parseDevice(t.lastLoginDevice)}</div>}
                                    {t.lastLoginIP && <div style={{ opacity: .7 }}>IP: {t.lastLoginIP}</div>}
                                  </div>
                                </>
                              ) : (
                                <div style={{ padding: '4px 14px 8px', fontSize: '.78rem', color: 'var(--muted)' }}>No login recorded</div>
                              )}
                              <div className="mt-action-sep" />
                              <button className="mt-action-item" onClick={() => { setOpenActionMenu(null); handleOpenEdit(t); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Teacher
                              </button>
                              <div className="mt-action-sep" />
                              <button className="mt-action-item danger" onClick={() => { setOpenActionMenu(null); handleDelete(t._id); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete Teacher
                              </button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ MOBILE CARDS ═══ */}
      <div className="mt-cards">
        {filteredTeachers.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>👨‍🏫</span>
            {searchTerm || showOnlineOnly ? 'No teachers match your filters' : 'No teachers yet'}
          </div>
        ) : filteredTeachers.map((t) => {
          const online = isOnline(t.lastLogin, ONLINE_THRESHOLD_MIN);
          return (
            <div className="mt-card" key={t._id}>
              <div className="mt-card-top">
                <div className="mt-avatar" style={{ background: avatarColor(`${t.firstName}${t.lastName}`), width: 46, height: 46, fontSize: '.85rem' }}>
                  {getInitials(t.firstName, t.lastName)}
                  <span className={`status-ring ${online ? 'online' : 'offline'}`} />
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mt-card-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.firstName} {t.lastName}</div>
                  <div className="mt-card-sub">@{t.username} · {t.email}</div>
                </div>
                <div className="mt-card-badges">
                  <span className={`mt-online-badge ${online ? 'online' : 'offline'}`}>
                    <span className={`mt-online-dot ${online ? 'online' : 'offline'}`} />
                    {online ? 'Online' : 'Offline'}
                  </span>
                </div>
              </div>
              <div className="mt-card-grid">
                <div>
                  <div className="mt-card-field-label">Last Seen</div>
                  <div className="mt-card-field-value" style={{ fontSize: '.8rem', color: t.lastLogin ? 'var(--text)' : 'var(--muted)' }}>
                    {t.lastLogin ? formatRelativeTime(t.lastLogin) : 'Never'}
                  </div>
                </div>
                <div>
                  <div className="mt-card-field-label">Phone</div>
                  <div className="mt-card-field-value">{t.phone || '—'}</div>
                </div>
                <div>
                  <div className="mt-card-field-label">Qualification</div>
                  <div className="mt-card-field-value">{t.qualification || '—'}</div>
                </div>
                <div>
                  <div className="mt-card-field-label">Experience</div>
                  <div className="mt-card-field-value">{t.experience ? `${t.experience} yr${t.experience !== 1 ? 's' : ''}` : '—'}</div>
                </div>
              </div>
              {t.lastLoginDevice && (
                <div style={{ fontSize: '.72rem', color: 'var(--muted)', marginBottom: 10, opacity: .7 }}>
                  Device: {parseDevice(t.lastLoginDevice)} · IP: {t.lastLoginIP || '—'}
                </div>
              )}
              <div className="mt-card-actions">
                <button className="mt-btn mt-btn-ghost mt-btn-sm" onClick={() => handleOpenEdit(t)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="mt-btn mt-btn-danger mt-btn-sm" onClick={() => handleDelete(t._id)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ width: 14, height: 14 }}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ═══ MODAL: ADD/EDIT ═══ */}
      {showModal && (
        <div className="mt-modal-overlay" onClick={handleCloseModal}>
          <div className="mt-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-handle" />
            <div className="mt-modal-header">
              <h3 className="mt-modal-title">{editingTeacher ? 'Edit Teacher' : 'Add New Teacher'}</h3>
              <button className="mt-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="mt-modal-body">
              {error && <div className="mt-alert mt-alert-danger" style={{ margin: 0 }}>{error}</div>}
              {successMessage && <div className="mt-alert mt-alert-success" style={{ margin: 0 }}>{successMessage}</div>}
              <form onSubmit={handleSubmit}>
                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">First Name *</label>
                    <input type="text" name="firstName" className="mt-form-input" value={formData.firstName} onChange={handleChange} required placeholder="e.g. John" disabled={!!successMessage} />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Last Name *</label>
                    <input type="text" name="lastName" className="mt-form-input" value={formData.lastName} onChange={handleChange} required placeholder="e.g. Doe" disabled={!!successMessage} />
                  </div>
                </div>
                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">Email *</label>
                    <input type="email" name="email" className="mt-form-input" value={formData.email} onChange={handleChange} required placeholder="email@example.com" disabled={!!successMessage} />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Username *</label>
                    <input type="text" name="username" className="mt-form-input" value={formData.username} onChange={handleChange} required placeholder="johndoe" disabled={!!successMessage} />
                  </div>
                </div>
                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">Password {editingTeacher ? '(leave blank to keep)' : '*'}</label>
                    <input type="password" name="password" className="mt-form-input" value={formData.password} onChange={handleChange} {...(!editingTeacher ? { required: true } : {})} placeholder={editingTeacher ? 'Leave blank to keep current' : 'Enter password'} disabled={!!successMessage} />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Phone</label>
                    <input type="text" name="phone" className="mt-form-input" value={formData.phone} onChange={handleChange} placeholder="1234567890" disabled={!!successMessage} />
                  </div>
                </div>
                <div className="mt-form-row">
                  <div className="mt-form-group">
                    <label className="mt-form-label">Qualification</label>
                    <input type="text" name="qualification" className="mt-form-input" value={formData.qualification} onChange={handleChange} placeholder="e.g. PhD, M.Ed" disabled={!!successMessage} />
                  </div>
                  <div className="mt-form-group">
                    <label className="mt-form-label">Experience (years)</label>
                    <input type="number" name="experience" className="mt-form-input" value={formData.experience} onChange={handleChange} min="0" placeholder="0" disabled={!!successMessage} />
                  </div>
                </div>
                <div className="mt-form-row">
                  <div className="mt-form-group full">
                    <label className="mt-form-label">Address</label>
                    <input type="text" name="address" className="mt-form-input" value={formData.address} onChange={handleChange} placeholder="Enter full address" disabled={!!successMessage} />
                  </div>
                </div>
              </form>
            </div>
            <div className="mt-modal-footer">
              <button type="button" className="mt-btn mt-btn-ghost" onClick={handleCloseModal} disabled={isSaving}>{successMessage ? 'Close' : 'Cancel'}</button>
              {!successMessage && (
                <button type="button" className="mt-btn mt-btn-primary" onClick={handleSubmit} disabled={isSaving}>
                  {isSaving ? (
                    <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'mtSpin .6s linear infinite' }}></span> Saving...</>
                  ) : editingTeacher ? 'Update Teacher' : 'Create Teacher'}
                </button>
              )}
              {successMessage && <button type="button" className="mt-btn mt-btn-primary" onClick={handleOpenCreate}>+ Add Another</button>}
            </div>
          </div>
        </div>
      )}

      {/* ═══ MODAL: CSV UPLOAD ═══ */}
      {showCSVModal && (
        <div className="mt-modal-overlay" onClick={() => !isUploading && handleCloseCSVModal()}>
          <div className="mt-modal" style={{ maxWidth: 700, width: '95%' }} onClick={(e) => e.stopPropagation()}>
            <div className="mt-modal-handle" />
            <div className="mt-modal-header">
              <h3 className="mt-modal-title">Upload Teachers (CSV)</h3>
              <button className="mt-modal-close" onClick={handleCloseCSVModal} disabled={isUploading}>×</button>
            </div>
            <div className="mt-modal-body">
              <div className="mt-alert mt-alert-danger" style={{ margin: 0, background: '#eff6ff', color: '#1e40af', border: '1px solid #bfdbfe' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10, flexWrap: 'wrap', gap: 8 }}>
                  <strong style={{ fontSize: '.84rem' }}>CSV Format Requirements:</strong>
                  <button type="button" className="mt-btn mt-btn-success mt-btn-sm" onClick={downloadTemplate} style={{ flexShrink: 0 }}>
                    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ width: 13, height: 13 }}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
                    Download Template
                  </button>
                </div>
                <ul style={{ paddingLeft: 20, margin: 0, fontSize: '.82rem', color: '#334155' }}>
                  <li>Required: <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontSize: '.78rem' }}>firstName, lastName, email, username, password</code></li>
                  <li>Optional: <code style={{ background: '#e2e8f0', padding: '1px 6px', borderRadius: 4, fontSize: '.78rem' }}>phone, address, qualification, experience</code></li>
                </ul>
              </div>
              <div style={{ marginTop: 16 }}>
                <label className="mt-form-label">Select CSV File</label>
                <div
                  className={`mt-drop-zone ${isDragging ? 'dragging' : ''} ${csvFile ? 'has-file' : ''}`}
                  onDragEnter={handleDragEnter} onDragLeave={handleDragLeave} onDragOver={handleDragOver}
                  onDrop={handleDrop} onClick={() => !csvFile && fileInputRef.current?.click()}
                >
                  <input ref={fileInputRef} type="file" accept=".csv" onChange={handleFileInputChange} style={{ display: 'none' }} />
                  {csvFile ? (
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
                      <span style={{ fontSize: '1.5rem' }}>📄</span>
                      <span style={{ fontWeight: 600, fontSize: '.9rem' }}>{csvFile.name}</span>
                      <button type="button" className="mt-btn mt-btn-ghost mt-btn-sm" onClick={(e) => { e.stopPropagation(); setCsvFile(null); setCsvData(null); if (fileInputRef.current) fileInputRef.current.value = ''; }}>Remove</button>
                    </div>
                  ) : (
                    <div>
                      <span style={{ fontSize: '2rem', display: 'block', marginBottom: 8 }}>📤</span>
                      <p style={{ margin: 0, fontWeight: 600, color: 'var(--text2)' }}>Drag & drop your CSV file here</p>
                      <p style={{ margin: '4px 0 0', fontSize: '.82rem', color: 'var(--muted)' }}>or click to browse</p>
                    </div>
                  )}
                </div>
              </div>
              {csvParseError && <div className="mt-alert mt-alert-danger" style={{ marginTop: 10, margin: '10px 0 0' }}>{csvParseError}</div>}
              {csvErrors.length > 0 && (
                <div style={{ marginTop: 10, fontSize: '.84rem' }}>
                  <div className="mt-alert mt-alert-danger" style={{ marginBottom: '.5rem', background: 'var(--warning-l)', color: '#92400e', border: '1px solid #fde68a' }}>
                    <span>⚠️</span> {csvErrors.length} row(s) skipped:
                  </div>
                  <div style={{ maxHeight: 80, overflowY: 'auto', fontSize: '.78rem', color: '#92400e' }}>
                    {csvErrors.map((err, i) => <div key={i}><strong>Row {err.row}:</strong> {err.errors.join(', ')}</div>)}
                  </div>
                </div>
              )}
              {csvData?.length > 0 && (
                <>
                  <div style={{ marginTop: 16, fontSize: '.88rem', fontWeight: 600 }}>Preview ({csvData.length} teachers)</div>
                  <div className="mt-upload-preview" style={{ marginTop: 8 }}>
                    <table>
                      <thead><tr><th>#</th><th>Name</th><th>Email</th><th>Username</th></tr></thead>
                      <tbody>{csvData.slice(0, 10).map((t, i) => (
                        <tr key={i}><td>{i + 1}</td><td style={{ fontWeight: 500 }}>{t.firstName} {t.lastName}</td><td>{t.email}</td><td>{t.username}</td></tr>
                      ))}</tbody>
                    </table>
                    {csvData.length > 10 && <p style={{ padding: '8px', fontSize: '.8rem', color: 'var(--muted)', textAlign: 'center' }}>... and {csvData.length - 10} more rows</p>}
                  </div>
                </>
              )}
              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <div className="mt-progress-bar"><div className="mt-progress-fill" style={{ width: `${(csvUploadProgress.current / csvUploadProgress.total) * 100}%` }} /></div>
                  <div style={{ fontSize: '.78rem', color: 'var(--muted)', marginTop: 6, fontWeight: 500 }}>Uploading {csvUploadProgress.current} of {csvUploadProgress.total}...</div>
                </div>
              )}
              {uploadResults && (
                <div style={{ marginTop: 16 }}>
                  {uploadResults.failed.length === 0 ? (
                    <div className="mt-alert mt-alert-success" style={{ margin: 0 }}>✅ Successfully uploaded all {uploadResults.success.length} teachers!</div>
                  ) : (
                    <>
                      <div className="mt-alert mt-alert-danger" style={{ margin: 0, background: 'var(--warning-l)', color: '#92400e', border: '1px solid #fde68a' }}>⚠️ {uploadResults.success.length} succeeded, {uploadResults.failed.length} failed</div>
                      <div className="mt-upload-log" style={{ marginTop: 8 }}>
                        {uploadResults.failed.map((f, i) => <div key={i}>❌ {f.teacher.firstName} {f.teacher.lastName}: {f.error}</div>)}
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
            <div className="mt-modal-footer">
              <button type="button" className="mt-btn mt-btn-ghost" onClick={handleCloseCSVModal} disabled={isUploading}>{uploadResults ? 'Close' : 'Cancel'}</button>
              {csvData?.length > 0 && !uploadResults && (
                <button type="button" className="mt-btn mt-btn-success" onClick={handleBulkUpload} disabled={isUploading}>
                  {isUploading ? (
                    <><span style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid rgba(255,255,255,.3)', borderTopColor: '#fff', borderRadius: '50%', animation: 'mtSpin .6s linear infinite' }}></span> Uploading...</>
                  ) : `Upload ${csvData.length} Teachers`}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageTeachers;