import React, { useState, useMemo, useEffect, useRef } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { subjectsAPI } from '../../api';
import Loading from '../common/Loading';

const ManageSubjects = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null); // NEW: CSV file input

  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false); // NEW
  const [editingSubject, setEditingSubject] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [formData, setFormData] = useState({
    name: '',
    code: '',
    classLevel: '',
    description: '',
  });
  const [error, setError] = useState('');

  // NEW: CSV import state
  const [parsedSubjects, setParsedSubjects] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadLog, setUploadLog] = useState([]);
  const [csvError, setCsvError] = useState('');

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    if (openActionMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionMenu]);

  const { data: subjects, isLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  const createMutation = useMutation({
    mutationFn: subjectsAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create subject'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => subjectsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['subjects'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update subject'),
  });

  const deleteMutation = useMutation({
    mutationFn: subjectsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['subjects'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete subject'),
  });

  // =====================================================
  // NEW: CSV IMPORT
  // =====================================================

  // Proper CSV line parser — respects quoted fields, so descriptions
  // containing commas (e.g. "waves, electricity") don't break columns
  const parseCSVLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else {
          current += ch;
        }
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { fields.push(current); current = ''; }
        else current += ch;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  };

  const downloadSampleCSV = () => {
    const csvContent = [
      'Name,Code,Class Level,Description',
      'Mathematics,MATH,All,Core subject covering algebra and geometry',
      'English Language,ENG,All,"Language arts, comprehension and composition"',
      'Basic Science,BSC,JSS,Introductory science for junior secondary classes',
      'Physics,PHY,SSS,"Mechanics, waves, electricity and magnetism"',
      'Yoruba,YOR,All,Nigerian indigenous language studies'
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'subject_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenUploadModal = () => {
    setParsedSubjects([]);
    setUploadLog([]);
    setCsvError('');
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowUploadModal(true);
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a .csv file.');
      setParsedSubjects([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target.result).replace(/^\ufeff/, ''); // strip BOM
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { setCsvError('CSV file is empty or missing data rows.'); return; }
        const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
        const getVal = (row, possibleKeys) => {
          const foundKey = possibleKeys.find(k => rawHeaders.includes(k));
          return foundKey ? (row[rawHeaders.indexOf(foundKey)] || '').trim() : '';
        };
        const existingCodes = new Set((subjects?.data || []).map(s => (s.code || '').toUpperCase()));
        const seenCodes = new Set();
        const mappedData = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2 || !values[0]) continue;

          const name = getVal(values, ['name', 'subject name', 'subjectname', 'subject']);
          const code = getVal(values, ['code', 'subject code', 'subjectcode']);
          const classLevel = getVal(values, ['classlevel', 'class_level', 'class level', 'level']);
          const description = getVal(values, ['description', 'desc']);

          if (!name) { errors.push(`Row ${i + 1}: Missing Subject Name.`); continue; }
          if (!code) { errors.push(`Row ${i + 1}: Missing Subject Code.`); continue; }

          // Normalize code to uppercase (matches the Add form convention)
          const normalizedCode = code.toUpperCase();

          // Duplicate checks — code is the unique field in the schema
          if (existingCodes.has(normalizedCode)) {
            errors.push(`Row ${i + 1}: Code "${normalizedCode}" already exists in the system.`);
          } else if (seenCodes.has(normalizedCode)) {
            errors.push(`Row ${i + 1}: Duplicate code "${normalizedCode}" within this file.`);
          }
          seenCodes.add(normalizedCode);

          mappedData.push({
            name,
            code: normalizedCode,
            classLevel,
            description,
            _rowNumber: i + 1
          });
        }
        setCsvError(errors.join(' | '));
        setParsedSubjects(mappedData);
      } catch (err) {
        console.error(err);
        setCsvError('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedSubjects.length === 0) return;
    setIsUploading(true);
    setUploadLog([]);
    setUploadProgress({ current: 0, total: parsedSubjects.length });
    let successCount = 0;
    let failCount = 0;
    for (const subject of parsedSubjects) {
      const { _rowNumber, ...payload } = subject;
      try {
        await subjectsAPI.create(payload);
        successCount++;
        setUploadLog(prev => [...prev, `✅ Row ${_rowNumber}: ${subject.name} (${subject.code}) added`]);
      } catch (err) {
        failCount++;
        setUploadLog(prev => [...prev, `❌ Row ${_rowNumber}: Failed (${err.response?.data?.message || 'Unknown error'})`]);
      }
      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ['subjects'] });
    setUploadLog(prev => [...prev, `--- Import Complete: ${successCount} succeeded, ${failCount} failed ---`]);
  };

  // ===== END NEW: CSV IMPORT =====

  const filteredSubjects = useMemo(() => {
    if (!subjects?.data) return [];
    if (!searchTerm.trim()) return subjects.data;
    const term = searchTerm.toLowerCase();
    return subjects.data.filter((sub) => {
      return (
        sub.name?.toLowerCase().includes(term) ||
        sub.code?.toLowerCase().includes(term) ||
        sub.classLevel?.toLowerCase().includes(term) ||
        sub.description?.toLowerCase().includes(term)
      );
    });
  }, [subjects?.data, searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleOpenCreate = () => {
    setEditingSubject(null);
    setFormData({ name: '', code: '', classLevel: '', description: '' });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (subject) => {
    setEditingSubject(subject);
    setFormData({
      name: subject.name || '',
      code: subject.code || '',
      classLevel: subject.classLevel || '',
      description: subject.description || '',
    });
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingSubject(null);
    setError('');
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (editingSubject) {
      updateMutation.mutate({ id: editingSubject._id, data: formData });
    } else {
      createMutation.mutate(formData);
    }
  };

  const handleDelete = (subject) => {
    if (window.confirm(`Delete subject "${subject.name}"?`)) {
      deleteMutation.mutate(subject._id);
    }
  };

  const toggleActionMenu = (id, e) => {
    e.stopPropagation();
    setOpenActionMenu(openActionMenu === id ? null : id);
  };

  const getLevelBadge = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('all') || l.includes('general')) return 'gray';
    if (l.includes('primary') || l.includes('nursery') || l.includes('pre')) return 'purple';
    if (l.includes('jss') || l.includes('junior') || l.includes('middle')) return 'blue';
    if (l.includes('sss') || l.includes('senior') || l.includes('secondary')) return 'green';
    if (l.includes('a-level') || l.includes('advanced')) return 'amber';
    return 'gray';
  };

  const getCodeColor = (code) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (code || '').length; i++) hash = code.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getSubjectIcon = (name) => {
    const n = (name || '').toLowerCase();
    if (n.includes('math')) return '📐';
    if (n.includes('eng')) return '📖';
    if (n.includes('phy')) return '⚛️';
    if (n.includes('chem')) return '🧪';
    if (n.includes('bio')) return '🧬';
    if (n.includes('comp') || n.includes('ict')) return '💻';
    if (n.includes('art') || n.includes('fine') || n.includes('creative')) return '🎨';
    if (n.includes('music')) return '🎵';
    if (n.includes('geo')) return '🌍';
    if (n.includes('hist')) return '📜';
    if (n.includes('civic') || n.includes('social')) return '🏛️';
    if (n.includes('eco') || n.includes('commerce') || n.includes('account')) return '📊';
    if (n.includes('french') || n.includes('lang')) return '🗣️';
    if (n.includes('yoruba') || n.includes('hausa') || n.includes('igbo')) return '🇳🇬';
    if (n.includes('agric') || n.includes('farm')) return '🌾';
    if (n.includes('tech') || n.includes('workshop') || n.includes('basic tech')) return '🔧';
    if (n.includes('pe') || n.includes('sport')) return '⚽';
    if (n.includes('crk') || n.includes('irk') || n.includes('relig')) return '✝️';
    if (n.includes('food') || n.includes('nutr') || n.includes('home ec')) return '🍳';
    if (n.includes('literature') || n.includes('lit')) return '📚';
    if (n.includes('further math') || n.includes('add math')) return '🧮';
    if (n.includes('business')) return '💼';
    return '📝';
  };

  const getResultText = () => {
    if (searchTerm.trim() && filteredSubjects.length !== subjects?.data?.length) return `Showing ${filteredSubjects.length} of ${subjects?.data?.length}`;
    return `${subjects?.data?.length || 0} subjects`;
  };

  if (isLoading) return <Loading message="Loading subjects..." />;

  return (
    <div className="su-root">
      <style>{`
        /* ===== BASE RESET & TOKENS ===== */
        .su-root { --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8; --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5; --warning: #f59e0b; --warning-light: #fffbeb; --radius: 12px; --radius-sm: 8px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }

        /* ===== PAGE HEADER ===== */
        .su-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .su-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .su-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .su-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
        .su-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .su-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; text-decoration: none; line-height: 1.4; }
        .su-btn:active { transform: scale(0.97); }
        .su-btn-primary { background: var(--primary); color: #fff; }
        .su-btn-primary:hover { background: var(--primary-hover); }
        .su-btn-success { background: var(--success); color: #fff; }
        .su-btn-success:hover { background: #059669; }
        .su-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .su-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
        .su-btn-danger { background: var(--danger); color: #fff; }
        .su-btn-danger:hover { background: var(--danger-hover); }
        .su-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
        .su-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }

        /* ===== SEARCH BAR ===== */
        .su-search-bar { padding: 12px 24px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .su-search-wrap { flex: 1; max-width: 420px; position: relative; }
        .su-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; pointer-events: none; }
        .su-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; }
        .su-search-input::placeholder { color: var(--text-muted); }
        .su-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .su-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #e2e8f0; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; }
        .su-result-count { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; }
        .su-result-count svg { width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; }

        /* ===== DESKTOP TABLE ===== */
        .su-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .su-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 680px; }
        .su-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .su-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .su-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .su-table tbody tr { transition: background var(--transition); }
        .su-table tbody tr:hover { background: #f8fafc; }
        .su-table tbody tr:last-child td { border-bottom: none; }
        .su-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .su-empty-icon { font-size: 2.5rem; margin-bottom: 8px; display: block; }
        .su-empty strong { color: var(--text-secondary); }

        /* ===== BADGES ===== */
        .su-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .su-badge-green { background: #dcfce7; color: #166534; }
        .su-badge-amber { background: #fef3c7; color: #92400e; }
        .su-badge-red { background: #fee2e2; color: #991b1b; }
        .su-badge-blue { background: #dbeafe; color: #1e40af; }
        .su-badge-purple { background: #f3e8ff; color: #6b21a8; }
        .su-badge-gray { background: #f1f5f9; color: #64748b; }

        /* ===== CODE BADGE ===== */
        .su-code-badge { display: inline-flex; align-items: center; justify-content: center; padding: 5px 12px; border-radius: 6px; font-size: 0.78rem; font-weight: 700; color: #fff; letter-spacing: 0.03em; font-family: 'SF Mono', 'Fira Code', 'Cascadia Code', monospace; min-width: 56px; text-align: center; }

        /* ===== SUBJECT ICON ===== */
        .su-subject-icon { width: 40px; height: 40px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-size: 1.2rem; flex-shrink: 0; background: #f8fafc; border: 1px solid var(--border); }

        /* ===== DESCRIPTION TEXT ===== */
        .su-desc { font-size: 0.84rem; color: var(--text-muted); max-width: 260px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .su-desc-empty { font-size: 0.82rem; color: var(--text-muted); font-style: italic; }

        /* ===== MOBILE CARDS ===== */
        .su-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .su-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: box-shadow var(--transition); }
        .su-card:active { box-shadow: var(--shadow); }
        .su-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .su-card-name { font-weight: 600; font-size: 0.95rem; color: var(--text); line-height: 1.3; }
        .su-card-code { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-top: 1px; font-family: 'SF Mono', 'Fira Code', monospace; }
        .su-card-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .su-card-grid { display: grid; grid-template-columns: 1fr; gap: 8px; margin-bottom: 14px; }
        .su-card-field { display: flex; flex-direction: column; gap: 2px; }
        .su-card-field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .su-card-field-value { font-size: 0.85rem; color: var(--text); font-weight: 500; }
        .su-card-desc { font-size: 0.82rem; color: var(--text-muted); margin-bottom: 14px; line-height: 1.5; }
        .su-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }
        .su-card-actions .su-btn { flex: 1; justify-content: center; font-size: 0.78rem; padding: 8px; }

        /* ===== TABLE ACTION MENU ===== */
        .su-action-menu-wrap { position: relative; }
        .su-action-trigger { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .su-action-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
        .su-action-trigger svg { width: 16px; height: 16px; color: var(--text-muted); }
        .su-action-menu { position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); min-width: 180px; z-index: 50; overflow: hidden; animation: suMenuIn 0.15s ease; }
        @keyframes suMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .su-action-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: background var(--transition); text-align: left; }
        .su-action-menu-item:hover { background: #f8fafc; }
        .su-action-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
        .su-action-menu-item.danger { color: var(--danger); }
        .su-action-menu-item.danger:hover { background: #fef2f2; }
        .su-action-menu-sep { height: 1px; background: var(--border); margin: 2px 0; }
        .su-click-outside { position: fixed; inset: 0; z-index: 40; }

        /* ===== MODAL ===== */
        .su-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: suFadeIn 0.2s ease; }
        @keyframes suFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .su-modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; animation: suSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--border); border-bottom: none; }
        @keyframes suSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .su-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; flex-shrink: 0; }
        .su-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; flex-shrink: 0; }
        .su-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
        .su-modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all var(--transition); }
        .su-modal-close:hover { background: #e2e8f0; color: var(--text); }
        .su-modal-body { padding: 20px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .su-modal-footer { display: flex; gap: 10px; padding: 0 20px 24px; justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0; }

        /* ===== FORM ===== */
        .su-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .su-form-group { display: flex; flex-direction: column; gap: 5px; }
        .su-form-group.full { grid-column: 1 / -1; }
        .su-form-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
        .su-form-input, .su-form-select, .su-form-textarea { width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit; }
        .su-form-input::placeholder, .su-form-textarea::placeholder { color: var(--text-muted); }
        .su-form-input:focus, .su-form-select:focus, .su-form-textarea:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .su-form-textarea { resize: vertical; min-height: 80px; line-height: 1.5; }
        .su-form-hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }

        /* ===== ALERT ===== */
        .su-alert { padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 500; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .su-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }

        /* ===== CSV IMPORT STYLES (NEW) ===== */
        .su-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .su-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }
        .su-upload-log { max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.76rem; line-height: 1.6; color: var(--text-secondary); }
        .su-upload-preview { max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .su-upload-preview table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .su-upload-preview th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); background: #f8fafc; position: sticky; top: 0; }
        .su-upload-preview td { padding: 7px 10px; border-top: 1px solid var(--border); }
        .su-file-input { width: 100%; padding: 10px; border: 1px dashed #cbd5e1; border-radius: var(--radius-sm); font-size: 0.85rem; box-sizing: border-box; background: var(--surface); cursor: pointer; }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .su-modal-overlay { align-items: center; }
          .su-modal { border-radius: 20px; border-bottom: 1px solid var(--border); max-height: 90vh; }
          .su-modal-handle { display: none; }
          .su-cards { display: none !important; }
          .su-table-section { display: block !important; }
          .su-header { padding: 24px 32px; }
          .su-search-bar { padding: 12px 32px; }
          .su-form-row { gap: 16px; }
        }

        @media (max-width: 767px) {
          .su-header { padding: 16px; }
          .su-header-title { font-size: 1.15rem; }
          .su-header-sub { font-size: 0.78rem; }
          .su-header-actions { width: 100%; }
          .su-header-actions .su-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
          .su-search-bar { padding: 10px 16px; }
          .su-search-wrap { max-width: 100%; }
          .su-table-section { display: none !important; }
          .su-cards { display: flex !important; } /* 👈 FIX: SHOW CARDS ON MOBILE */
          .su-form-row { grid-template-columns: 1fr; }
          .su-modal { max-height: 95vh; border-radius: 16px 16px 0 0; }
        }

        @media (max-width: 380px) {
          .su-header-actions { flex-direction: column; }
        }

        /* ===== SCROLLBAR ===== */
        .su-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .su-root ::-webkit-scrollbar-track { background: transparent; }
        .su-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .su-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* ===== SPINNER ===== */
        @keyframes suSpin { to { transform: rotate(360deg); } }
        .su-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: suSpin 0.6s linear infinite; }
      `}</style>

      {/* ===== PAGE HEADER ===== */}
      <div className="su-header">
        <div className="su-header-top">
          <div>
            <h1 className="su-header-title">Subjects</h1>
            <p className="su-header-sub">Manage subjects &amp; curriculum</p>
          </div>
          <div className="su-header-actions">
            <button className="su-btn su-btn-success" onClick={handleOpenUploadModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className="su-btn su-btn-primary" onClick={handleOpenCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Subject</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== SEARCH BAR ===== */}
      <div className="su-search-bar">
        <div className="su-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="su-search-input" placeholder="Search by name, code, or level..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="su-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>
        <span className="su-result-count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
          {getResultText()}
        </span>
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="su-table-section" style={{ background: 'var(--surface)', minHeight: '200px' }}>
        <div className="su-table-wrap">
          <table className="su-table">
            <thead>
              <tr>
                <th>Subject</th>
                <th>Code</th>
                <th>Class Level</th>
                <th>Description</th>
                <th style={{width: 50}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredSubjects.length === 0 ? (
                <tr><td colSpan="5" className="su-empty">
                  <span className="su-empty-icon">📚</span>
                  {searchTerm.trim() ? <>No subjects found for "<strong>{searchTerm}</strong>"</> : 'No subjects yet. Add your first subject to get started.'}
                </td></tr>
              ) : filteredSubjects.map((subject) => {
                const levelBadge = getLevelBadge(subject.classLevel);
                return (
                  <tr key={subject._id}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="su-subject-icon">
                          {getSubjectIcon(subject.name)}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{subject.name}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="su-code-badge" style={{ background: getCodeColor(subject.code) }}>
                        {subject.code}
                      </span>
                    </td>
                    <td>
                      {subject.classLevel ? (
                        <span className={`su-badge su-badge-${levelBadge}`}>{subject.classLevel}</span>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Not set</span>
                      )}
                    </td>
                    <td>
                      {subject.description ? (
                        <span className="su-desc">{subject.description}</span>
                      ) : (
                        <span className="su-desc-empty">—</span>
                      )}
                    </td>
                    <td>
                      <div className="su-action-menu-wrap">
                        <button className="su-action-trigger" onClick={(e) => toggleActionMenu(subject._id, e)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openActionMenu === subject._id && (
                          <>
                            <div className="su-click-outside" onClick={() => setOpenActionMenu(null)} />
                            <div className="su-action-menu">
                              <button className="su-action-menu-item" onClick={() => { setOpenActionMenu(null); handleOpenEdit(subject); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Subject
                              </button>
                              <div className="su-action-menu-sep" />
                              <button className="su-action-menu-item danger" onClick={() => { setOpenActionMenu(null); handleDelete(subject); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete Subject
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

      {/* ===== MOBILE CARDS ===== */}
      <div className="su-cards">
        {filteredSubjects.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📚</span>
            {searchTerm.trim() ? <>No subjects found for "<strong>{searchTerm}</strong>"</> : 'No subjects yet. Add your first subject.'}
          </div>
        ) : filteredSubjects.map((subject) => {
          const levelBadge = getLevelBadge(subject.classLevel);
          return (
            <div className="su-card" key={subject._id}>
              <div className="su-card-top">
                <div className="su-subject-icon">
                  {getSubjectIcon(subject.name)}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="su-card-name">{subject.name}</div>
                  <div className="su-card-code">{subject.code}</div>
                </div>
                <div className="su-card-badges">
                  {subject.classLevel && (
                    <span className={`su-badge su-badge-${levelBadge}`}>{subject.classLevel}</span>
                  )}
                </div>
              </div>
              {subject.description && (
                <div className="su-card-desc">{subject.description}</div>
              )}
              <div className="su-card-actions">
                <button className="su-btn su-btn-ghost su-btn-sm" onClick={() => handleOpenEdit(subject)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="su-btn su-btn-danger su-btn-sm" onClick={() => handleDelete(subject)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODAL: ADD/EDIT SUBJECT ===== */}
      {showModal && (
        <div className="su-modal-overlay" onClick={handleCloseModal}>
          <div className="su-modal" onClick={(e) => e.stopPropagation()}>
            <div className="su-modal-handle" />
            <div className="su-modal-header">
              <h3 className="su-modal-title">{editingSubject ? 'Edit Subject' : 'Add New Subject'}</h3>
              <button className="su-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="su-modal-body">
              {error && (
                <div className="su-alert su-alert-danger">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="su-form-row">
                  <div className="su-form-group">
                    <label className="su-form-label">Subject Name *</label>
                    <input type="text" name="name" className="su-form-input" value={formData.name} onChange={handleChange} placeholder="e.g., Mathematics" required />
                  </div>
                  <div className="su-form-group">
                    <label className="su-form-label">Subject Code *</label>
                    <input type="text" name="code" className="su-form-input" value={formData.code} onChange={handleChange} placeholder="e.g., MATH" required style={{ fontFamily: "'SF Mono', 'Fira Code', 'Cascadia Code', monospace", textTransform: 'uppercase', letterSpacing: '0.05em' }} />
                    <span className="su-form-hint">Short uppercase code, e.g. MATH, ENG, PHY</span>
                  </div>
                </div>
                <div className="su-form-group" style={{ marginBottom: 14 }}>
                  <label className="su-form-label">Class Level</label>
                  <input type="text" name="classLevel" className="su-form-input" value={formData.classLevel} onChange={handleChange} placeholder="e.g., All, Secondary, Primary, JSS, SSS" />
                  <span className="su-form-hint">Leave empty or use "All" if applicable to every level</span>
                </div>
                <div className="su-form-group" style={{ marginBottom: 0 }}>
                  <label className="su-form-label">Description</label>
                  <textarea
                    name="description"
                    className="su-form-textarea"
                    value={formData.description}
                    onChange={handleChange}
                    placeholder="Brief description of the subject (optional)"
                    rows="3"
                  />
                </div>
              </form>
            </div>
            <div className="su-modal-footer">
              <button type="button" className="su-btn su-btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button
                type="button"
                className="su-btn su-btn-primary"
                disabled={createMutation.isPending || updateMutation.isPending}
                onClick={handleSubmit}
              >
                {createMutation.isPending || updateMutation.isPending ? (
                  <><span className="su-spinner"></span> Saving...</>
                ) : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CSV UPLOAD (NEW) ===== */}
      {showUploadModal && (
        <div className="su-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="su-modal" onClick={(e) => e.stopPropagation()}>
            <div className="su-modal-handle" />
            <div className="su-modal-header">
              <h3 className="su-modal-title">Bulk Upload Subjects</h3>
              <button className="su-modal-close" onClick={() => !isUploading && setShowUploadModal(false)} disabled={isUploading}>×</button>
            </div>
            <div className="su-modal-body">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="su-form-hint">Codes are auto-uppercased and must be unique. Quote descriptions containing commas.</span>
                <button type="button" className="su-btn su-btn-ghost su-btn-sm" onClick={downloadSampleCSV}>Download Sample</button>
              </div>
              <input type="file" accept=".csv" className="su-file-input" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />

              {csvError && <div className="su-alert su-alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{csvError}</div>}

              {parsedSubjects.length > 0 && (
                <div className="su-upload-preview" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr><th>Row</th><th>Name</th><th>Code</th><th>Level</th><th>Description</th></tr>
                    </thead>
                    <tbody>
                      {parsedSubjects.map(s => (
                        <tr key={s._rowNumber}>
                          <td>{s._rowNumber}</td>
                          <td>{s.name}</td>
                          <td style={{ fontFamily: "'SF Mono', monospace", fontWeight: 600 }}>{s.code}</td>
                          <td>{s.classLevel || '—'}</td>
                          <td style={{ maxWidth: 180, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{s.description || '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <div className="su-progress-bar">
                    <div className="su-progress-fill" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                  </div>
                  <p className="su-form-hint" style={{ marginTop: 6 }}>Uploading {uploadProgress.current} of {uploadProgress.total}...</p>
                </div>
              )}

              {uploadLog.length > 0 && (
                <div className="su-upload-log" style={{ marginTop: 12 }}>
                  {uploadLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
            <div className="su-modal-footer">
              <button className="su-btn su-btn-ghost" onClick={() => !isUploading && setShowUploadModal(false)} disabled={isUploading}>Close</button>
              <button className="su-btn su-btn-success" onClick={handleBulkUpload} disabled={parsedSubjects.length === 0 || isUploading}>
                {isUploading ? <><span className="su-spinner"></span> Importing...</> : `Import ${parsedSubjects.length} Subject(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageSubjects;