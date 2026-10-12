import React, { useState, useRef, useEffect, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { classesAPI, teachersAPI, subjectsAPI } from '../../api';
import Loading from '../common/Loading';

const ManageClasses = () => {
  const queryClient = useQueryClient();
  const modalBodyRef = useRef(null);
  const fileInputRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [editingClass, setEditingClass] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [error, setError] = useState('');
  const [formData, setFormData] = useState({
    name: '',
    level: '',
    section: '',
    session: '',
    teacherId: '',
    capacity: '',
    subjects: [],
    category: '',   // ✅ NEW: school category (primary | secondary)
  });

  // CSV import state
  const [parsedClasses, setParsedClasses] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadLog, setUploadLog] = useState([]);
  const [csvError, setCsvError] = useState('');

  const handleModalScroll = () => {
    if (modalBodyRef.current) {
      setShowScrollBtn(modalBodyRef.current.scrollTop > 50);
    }
  };

  const scrollToTop = () => {
    if (modalBodyRef.current) {
      modalBodyRef.current.scrollTo({ top: 0, behavior: 'smooth' });
    }
  };

  useEffect(() => {
    if (showModal && modalBodyRef.current) {
      modalBodyRef.current.scrollTop = 0;
      setShowScrollBtn(false);
    }
  }, [showModal]);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    if (openActionMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionMenu]);

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 100 })
  });

  const { data: teachers, isLoading: teachersLoading } = useQuery({
    queryKey: ['teachers'],
    queryFn: teachersAPI.getAll
  });

  const { data: subjects, isLoading: subjectsLoading } = useQuery({
    queryKey: ['subjects'],
    queryFn: subjectsAPI.getAll
  });

  const createMutation = useMutation({
    mutationFn: classesAPI.create,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create class'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => classesAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['classes'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update class'),
  });

  const deleteMutation = useMutation({
    mutationFn: classesAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['classes'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete class'),
  });

  // =====================================================
  // CSV IMPORT (with optional Category column)
  // =====================================================

  // Proper CSV line parser - respects quoted fields
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
    // Category column is OPTIONAL - leave blank and the backend
    // auto-detects it from the class name
    const csvContent = [
      'ClassName,Level,Section,Session,Class Teacher,Capacity,Subjects,Category',
      'JSS 1,JSS 1,A,2024-2025,John Doe,40,Mathematics;English Language,secondary',
      'JSS 2,JSS 2,B,2024-2025,jdoe,35,Basic Science;Agricultural Science,',
      'SSS 1,SSS 1,A,2024-2025,jane.smith@school.com,30,Mathematics;Physics;Chemistry,Secondary',
      'Primary 1,Primary,A,2024-2025,John Doe,40,Mathematics;English,primary'
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'class_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenUploadModal = () => {
    setParsedClasses([]);
    setUploadLog([]);
    setCsvError('');
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowUploadModal(true);
  };

  // Matches a teacher by full name, username, or email (case-insensitive)
  const matchTeacher = (value) => {
    if (!value) return null;
    const v = value.trim().toLowerCase();
    const list = teachers?.data || [];
    const fullMatches = list.filter(t => `${t.firstName} ${t.lastName}`.toLowerCase() === v);
    if (fullMatches.length === 1) return fullMatches[0];
    if (fullMatches.length > 1) {
      return { error: `multiple teachers named "${value}" - use their username or email instead` };
    }
    return list.find(t => t.username?.toLowerCase() === v || t.email?.toLowerCase() === v) || null;
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a .csv file.');
      setParsedClasses([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target.result).replace(/^\ufeff/, '');
        const lines = text.split('\n').filter(line => line.trim() !== '');
        if (lines.length < 2) { setCsvError('CSV file is empty or missing data rows.'); return; }
        const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
        const getVal = (row, possibleKeys) => {
          const foundKey = possibleKeys.find(k => rawHeaders.includes(k));
          return foundKey ? (row[rawHeaders.indexOf(foundKey)] || '').trim() : '';
        };
        const subjectList = subjects?.data || [];
        const existingClasses = classes?.data || [];
        const mappedData = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2 || !values[0]) continue;

          const name = getVal(values, ['classname', 'class_name', 'class name', 'class']);
          const level = getVal(values, ['level', 'classlevel', 'class level']);
          const section = getVal(values, ['section', 'sec']);
          const session = getVal(values, ['session', 'academic session', 'session year']);
          const teacherRaw = getVal(values, ['class teacher', 'classteacher', 'teacher', 'teacher name', 'teacher username', 'class teacher name']);
          const capacity = getVal(values, ['capacity', 'student capacity', 'capacity number']);
          const subjectsRaw = getVal(values, ['subjects', 'subject', 'assigned subjects', 'subject names']);
          // ✅ NEW: optional Category column (blank = backend auto-detects from name)
          const categoryRaw = getVal(values, ['category', 'school category', 'class category']);

          if (!name || !level || !section || !session) {
            errors.push(`Row ${i + 1}: Missing Class Name, Level, Section or Session.`);
            continue;
          }

          // ✅ NEW: validate the category if provided
          let category = '';
          if (categoryRaw) {
            const c = categoryRaw.toLowerCase();
            if (c.includes('primary')) category = 'primary';
            else if (c.includes('second')) category = 'secondary';
            else {
              errors.push(`Row ${i + 1}: Invalid Category "${categoryRaw}" - use "primary" or "secondary" (or leave blank to auto-detect).`);
              continue;
            }
          }

          const capacityNum = parseInt(capacity, 10);
          if (!capacityNum || capacityNum < 1 || capacityNum > 200) {
            errors.push(`Row ${i + 1}: Capacity must be a number between 1 and 200.`);
            continue;
          }

          if (!teacherRaw) {
            errors.push(`Row ${i + 1}: Class Teacher is required (name, username or email).`);
            continue;
          }
          const teacher = matchTeacher(teacherRaw);
          if (!teacher || teacher.error) {
            errors.push(`Row ${i + 1}: ${teacher?.error || `Teacher "${teacherRaw}" not found in system.`}`);
            continue;
          }

          const matchedIds = [];
          if (subjectsRaw) {
            subjectsRaw.split(/[;|]/).map(s => s.trim()).filter(Boolean).forEach(subName => {
              const found = subjectList.find(s =>
                s.name?.toLowerCase() === subName.toLowerCase() ||
                s.code?.toLowerCase() === subName.toLowerCase()
              );
              if (found) {
                const subjId = found._id || found.id;
                if (!matchedIds.includes(subjId)) matchedIds.push(subjId);
              } else {
                errors.push(`Row ${i + 1}: Subject "${subName}" not found in system.`);
              }
            });
          }

          const dup = existingClasses.find(c =>
            c.name?.toLowerCase() === name.toLowerCase() &&
            c.level?.toLowerCase() === level.toLowerCase() &&
            c.section?.toLowerCase() === section.toLowerCase() &&
            c.session?.toLowerCase() === session.toLowerCase()
          );
          if (dup) errors.push(`Row ${i + 1}: Class "${name} - ${section}" (${session}) already exists.`);

          mappedData.push({
            name, level, section, session,
            teacherId: teacher._id || teacher.id,
            capacity: capacityNum,
            subjects: matchedIds,
            ...(category ? { category } : {}),   // ✅ NEW: only send when provided
            _rowNumber: i + 1,
            _teacherName: `${teacher.firstName} ${teacher.lastName}`,
            _category: category
          });
        }
        setCsvError(errors.join(' | '));
        setParsedClasses(mappedData);
      } catch (err) {
        console.error(err);
        setCsvError('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedClasses.length === 0) return;
    setIsUploading(true);
    setUploadLog([]);
    setUploadProgress({ current: 0, total: parsedClasses.length });
    let successCount = 0;
    let failCount = 0;
    for (const cls of parsedClasses) {
      const { _rowNumber, _teacherName, _category, ...payload } = cls;
      try {
        await classesAPI.create(payload);
        successCount++;
        setUploadLog(prev => [...prev, `✅ Row ${_rowNumber}: ${cls.name} - ${cls.section} created (teacher: ${_teacherName}${_category ? `, ${_category}` : ''})`]);
      } catch (err) {
        failCount++;
        setUploadLog(prev => [...prev, `❌ Row ${_rowNumber}: Failed (${err.response?.data?.message || 'Unknown error'})`]);
      }
      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ['classes'] });
    setUploadLog(prev => [...prev, `--- Import Complete: ${successCount} succeeded, ${failCount} failed ---`]);
  };

  const filteredClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!searchTerm.trim()) return classes.data;
    const term = searchTerm.toLowerCase();
    return classes.data.filter((cls) => {
      const teacherName = cls.teacherId
        ? `${cls.teacherId.firstName} ${cls.teacherId.lastName}`.toLowerCase()
        : '';
      return (
        cls.name?.toLowerCase().includes(term) ||
        cls.level?.toLowerCase().includes(term) ||
        cls.section?.toLowerCase().includes(term) ||
        cls.session?.toLowerCase().includes(term) ||
        (cls.category || '').toLowerCase().includes(term) ||   // ✅ NEW: search by category too
        teacherName.includes(term)
      );
    });
  }, [classes?.data, searchTerm]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
  };

  const handleSubjectToggle = (subjectId) => {
    setFormData((prev) => ({
      ...prev,
      subjects: prev.subjects.includes(subjectId)
        ? prev.subjects.filter((id) => id !== subjectId)
        : [...prev.subjects, subjectId],
    }));
    setError('');
  };

  const handleOpenCreate = () => {
    setEditingClass(null);
    setFormData({ name: '', level: '', section: '', session: '2024-2025', teacherId: '', capacity: '', subjects: [], category: '' });
    setError('');
    setShowModal(true);
  };

  const handleOpenEdit = (cls) => {
    setEditingClass(cls);
    setFormData({
      name: cls.name || '',
      level: cls.level || '',
      section: cls.section || '',
      session: cls.session || '',
      teacherId: cls.teacherId?._id || cls.teacherId?.id || '',
      capacity: cls.capacity || '',
      subjects: cls.subjects?.map(s => s._id || s.id) || [],
      category: cls.category || '',   // ✅ NEW
    });
    setError('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false);
    setEditingClass(null);
    setError('');
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    // category flows into the payload automatically through formData
    const submitData = { ...formData, capacity: parseInt(formData.capacity) };
    if (editingClass) {
      updateMutation.mutate({ id: editingClass._id || editingClass.id, data: submitData });
    } else {
      createMutation.mutate(submitData);
    }
  };

  const handleDelete = (cls) => {
    if (window.confirm(`Delete class "${cls.name} - ${cls.section}"?`)) {
      deleteMutation.mutate(cls._id || cls.id);
    }
  };

  const toggleActionMenu = (id, e) => {
    e.stopPropagation();
    setOpenActionMenu(openActionMenu === id ? null : id);
  };

  const getTeacherName = (cls) => {
    if (!cls.teacherId) return null;
    return `${cls.teacherId.firstName} ${cls.teacherId.lastName}`;
  };

  const getCapacityPercent = (cls) => {
    if (!cls.capacity) return 0;
    return Math.min(100, Math.round(((cls.students?.length || 0) / cls.capacity) * 100));
  };

  const getCapacityColor = (pct) => {
    if (pct >= 90) return 'red';
    if (pct >= 70) return 'amber';
    return 'green';
  };

  const getLevelBadge = (level) => {
    const l = (level || '').toLowerCase();
    if (l.includes('primary') || l.includes('nursery') || l.includes('pre')) return 'purple';
    if (l.includes('jss') || l.includes('junior') || l.includes('middle')) return 'blue';
    if (l.includes('sss') || l.includes('senior') || l.includes('secondary')) return 'green';
    if (l.includes('a-level') || l.includes('advanced')) return 'amber';
    return 'gray';
  };

  // ✅ NEW: badge for the school category
  const getCategoryBadge = (category) => {
    if (!category) return null;
    return category === 'primary' ? 'purple' : 'blue';
  };

  const getIconColor = (name) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getResultText = () => {
    if (searchTerm.trim() && filteredClasses.length !== classes?.data?.length) return `Showing ${filteredClasses.length} of ${classes?.data?.length}`;
    return `${classes?.data?.length || 0} classes`;
  };

  const getSubjectNames = (cls) => {
    if (!cls.subjects?.length) return [];
    return cls.subjects.map(s => s.name || s.code);
  };

  if (classesLoading || teachersLoading || subjectsLoading) return <Loading message="Loading classes..." />;

  return (
    <div className="mc-root">
      <style>{`
        .mc-root { --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8; --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5; --warning: #f59e0b; --warning-light: #fffbeb; --radius: 12px; --radius-sm: 8px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }
        .mc-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .mc-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .mc-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .mc-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
        .mc-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .mc-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; text-decoration: none; line-height: 1.4; }
        .mc-btn:active { transform: scale(0.97); }
        .mc-btn-primary { background: var(--primary); color: #fff; }
        .mc-btn-primary:hover { background: var(--primary-hover); }
        .mc-btn-success { background: var(--success); color: #fff; }
        .mc-btn-success:hover { background: #059669; }
        .mc-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .mc-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
        .mc-btn-danger { background: var(--danger); color: #fff; }
        .mc-btn-danger:hover { background: var(--danger-hover); }
        .mc-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
        .mc-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .mc-search-bar { padding: 12px 24px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; }
        .mc-search-wrap { flex: 1; max-width: 420px; position: relative; }
        .mc-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; pointer-events: none; }
        .mc-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; box-sizing: border-box; -webkit-appearance: none; }
        .mc-search-input::placeholder { color: var(--text-muted); }
        .mc-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .mc-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #e2e8f0; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; }
        .mc-result-count { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; }
        .mc-result-count svg { width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; }
        .mc-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .mc-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 780px; }
        .mc-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .mc-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .mc-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .mc-table tbody tr { transition: background var(--transition); }
        .mc-table tbody tr:hover { background: #f8fafc; }
        .mc-table tbody tr:last-child td { border-bottom: none; }
        .mc-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .mc-empty-icon { font-size: 2.5rem; margin-bottom: 8px; display: block; }
        .mc-empty strong { color: var(--text-secondary); }
        .mc-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .mc-badge-green { background: #dcfce7; color: #166534; }
        .mc-badge-amber { background: #fef3c7; color: #92400e; }
        .mc-badge-red { background: #fee2e2; color: #991b1b; }
        .mc-badge-blue { background: #dbeafe; color: #1e40af; }
        .mc-badge-purple { background: #f3e8ff; color: #6b21a8; }
        .mc-badge-gray { background: #f1f5f9; color: #64748b; }
        .mc-cap-wrap { display: flex; flex-direction: column; gap: 4px; min-width: 110px; }
        .mc-cap-label { font-size: 0.78rem; color: var(--text-secondary); font-weight: 500; }
        .mc-cap-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .mc-cap-fill { height: 100%; border-radius: 3px; transition: width 0.4s ease; }
        .mc-cap-fill-green { background: #22c55e; }
        .mc-cap-fill-amber { background: #f59e0b; }
        .mc-cap-fill-red { background: #ef4444; }
        .mc-subjects { display: flex; gap: 4px; flex-wrap: wrap; max-width: 200px; }
        .mc-subject-pill { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 500; background: var(--primary-light); color: var(--primary); white-space: nowrap; }
        .mc-subject-more { padding: 2px 8px; border-radius: 4px; font-size: 0.7rem; font-weight: 600; background: #f1f5f9; color: var(--text-muted); }
        .mc-class-icon { width: 38px; height: 38px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: center; font-weight: 800; font-size: 0.82rem; color: #fff; flex-shrink: 0; letter-spacing: -0.01em; }
        .mc-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .mc-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
        .mc-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .mc-card-name { font-weight: 600; font-size: 0.95rem; color: var(--text); line-height: 1.3; }
        .mc-card-session { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
        .mc-card-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .mc-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .mc-card-field { display: flex; flex-direction: column; gap: 2px; }
        .mc-card-field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .mc-card-field-value { font-size: 0.85rem; color: var(--text); font-weight: 500; }
        .mc-card-cap { margin-bottom: 14px; }
        .mc-card-subjects { display: flex; gap: 4px; flex-wrap: wrap; margin-bottom: 14px; }
        .mc-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }
        .mc-card-actions .mc-btn { flex: 1; justify-content: center; font-size: 0.78rem; padding: 8px; }
        .mc-action-menu-wrap { position: relative; }
        .mc-action-trigger { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .mc-action-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
        .mc-action-trigger svg { width: 16px; height: 16px; color: var(--text-muted); }
        .mc-action-menu { position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); min-width: 180px; z-index: 50; overflow: hidden; animation: mcMenuIn 0.15s ease; }
        @keyframes mcMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .mc-action-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: background var(--transition); text-align: left; }
        .mc-action-menu-item:hover { background: #f8fafc; }
        .mc-action-menu-item svg { width: 15px; height: 15px; flex-shrink: 0; }
        .mc-action-menu-item.danger { color: var(--danger); }
        .mc-action-menu-item.danger:hover { background: #fef2f2; }
        .mc-action-menu-sep { height: 1px; background: var(--border); margin: 2px 0; }
        .mc-click-outside { position: fixed; inset: 0; z-index: 40; }
        .mc-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: mcFadeIn 0.2s ease; }
        @keyframes mcFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .mc-modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 560px; max-height: 90vh; display: flex; flex-direction: column; animation: mcSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--border); border-bottom: none; }
        @keyframes mcSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .mc-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; flex-shrink: 0; }
        .mc-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; flex-shrink: 0; }
        .mc-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
        .mc-modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all var(--transition); }
        .mc-modal-close:hover { background: #e2e8f0; color: var(--text); }
        .mc-modal-body { padding: 20px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; position: relative; }
        .mc-modal-footer { display: flex; gap: 10px; padding: 0 20px 24px; justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0; }
        .mc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .mc-form-group { display: flex; flex-direction: column; gap: 5px; }
        .mc-form-group.full { grid-column: 1 / -1; }
        .mc-form-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
        .mc-form-input, .mc-form-select { width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; box-sizing: border-box; -webkit-appearance: none; appearance: none; }
        .mc-form-input::placeholder { color: var(--text-muted); }
        .mc-form-input:focus, .mc-form-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .mc-form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; cursor: pointer; }
        .mc-form-select option { color: var(--text); background: var(--surface); }
        .mc-form-hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
        .mc-checkbox-grid { display: flex; flex-direction: column; gap: 6px; max-height: 150px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); padding: 10px 12px; background: var(--surface); }
        .mc-checkbox-grid::-webkit-scrollbar { width: 5px; }
        .mc-checkbox-grid::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .mc-checkbox-item { display: flex; align-items: center; gap: 8px; cursor: pointer; font-size: 0.84rem; color: var(--text-secondary); padding: 4px 0; }
        .mc-checkbox-item:hover { color: var(--text); }
        .mc-checkbox-item input[type="checkbox"] { width: 16px; height: 16px; cursor: pointer; accent-color: var(--primary); }
        .mc-checkbox-code { font-size: 0.72rem; color: var(--text-muted); font-weight: 500; margin-left: auto; }
        .mc-checkbox-empty { font-size: 0.82rem; color: var(--text-muted); padding: 8px 0; }
        .mc-alert { padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 500; display: flex; align-items: center; gap: 8px; margin-bottom: 14px; }
        .mc-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .mc-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .mc-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }
        .mc-upload-log { max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.76rem; line-height: 1.6; color: var(--text-secondary); }
        .mc-upload-preview { max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .mc-upload-preview table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .mc-upload-preview th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); background: #f8fafc; position: sticky; top: 0; }
        .mc-upload-preview td { padding: 7px 10px; border-top: 1px solid var(--border); }
        .mc-file-input { width: 100%; padding: 10px; border: 1px dashed #cbd5e1; border-radius: var(--radius-sm); font-size: 0.85rem; box-sizing: border-box; background: var(--surface); cursor: pointer; }
        .mc-scroll-top { position: sticky; bottom: 16px; left: 100%; transform: translateX(-52px); width: 36px; height: 36px; border-radius: 50%; background: var(--primary); color: #fff; border: none; cursor: pointer; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 12px rgba(79,70,229,0.4); opacity: 0; visibility: hidden; transition: all 0.3s ease; z-index: 10; pointer-events: none; margin-top: 12px; }
        .mc-scroll-top.visible { opacity: 1; visibility: visible; pointer-events: auto; }
        .mc-scroll-top:hover { background: var(--primary-hover); transform: translateX(-52px) scale(1.05); }
        .mc-scroll-top svg { width: 18px; height: 18px; }
        @media (min-width: 768px) {
          .mc-modal-overlay { align-items: center; }
          .mc-modal { border-radius: 20px; border-bottom: 1px solid var(--border); max-height: 90vh; }
          .mc-modal-handle { display: none; }
          .mc-cards { display: none !important; }
          .mc-table-section { display: block !important; }
          .mc-header { padding: 24px 32px; }
          .mc-search-bar { padding: 12px 32px; }
          .mc-form-row { gap: 16px; }
        }
        @media (max-width: 767px) {
          .mc-header { padding: 16px; }
          .mc-header-title { font-size: 1.15rem; }
          .mc-header-sub { font-size: 0.78rem; }
          .mc-header-actions { width: 100%; }
          .mc-header-actions .mc-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
          .mc-search-bar { padding: 10px 16px; }
          .mc-search-wrap { max-width: 100%; }
          .mc-table-section { display: none !important; }
          .mc-cards { display: flex !important; }
          .mc-card-grid { grid-template-columns: 1fr 1fr; gap: 10px; }
          .mc-form-row { grid-template-columns: 1fr; }
          .mc-modal { max-height: 95vh; border-radius: 16px 16px 0 0; }
        }
        @media (max-width: 380px) {
          .mc-header-actions { flex-direction: column; }
          .mc-card-grid { grid-template-columns: 1fr; }
        }
        .mc-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .mc-root ::-webkit-scrollbar-track { background: transparent; }
        .mc-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .mc-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
        @keyframes mcSpin { to { transform: rotate(360deg); } }
        .mc-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: mcSpin 0.6s linear infinite; }
      `}</style>

      {/* ===== PAGE HEADER ===== */}
      <div className="mc-header">
        <div className="mc-header-top">
          <div>
            <h1 className="mc-header-title">Classes</h1>
            <p className="mc-header-sub">Manage class sections &amp; assignments</p>
          </div>
          <div className="mc-header-actions">
            <button className="mc-btn mc-btn-success" onClick={handleOpenUploadModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className="mc-btn mc-btn-primary" onClick={handleOpenCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Class</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== SEARCH BAR ===== */}
      <div className="mc-search-bar">
        <div className="mc-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="mc-search-input" placeholder="Search by name, level, section, category, teacher..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="mc-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>
        <span className="mc-result-count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          {getResultText()}
        </span>
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="mc-table-section" style={{ background: 'var(--surface)', minHeight: '200px' }}>
        <div className="mc-table-wrap">
          <table className="mc-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Level</th>
                <th>Session</th>
                <th>Teacher</th>
                <th>Subjects</th>
                <th>Capacity</th>
                <th style={{width: 50}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredClasses.length === 0 ? (
                <tr><td colSpan="7" className="mc-empty">
                  <span className="mc-empty-icon">🏫</span>
                  {searchTerm.trim() ? <>No classes found for "<strong>{searchTerm}</strong>"</> : 'No classes yet. Add your first class to get started.'}
                </td></tr>
              ) : filteredClasses.map((cls) => {
                const pct = getCapacityPercent(cls);
                const capColor = getCapacityColor(pct);
                const teacherName = getTeacherName(cls);
                const subjectNames = getSubjectNames(cls);
                const levelBadge = getLevelBadge(cls.level);
                const categoryBadge = getCategoryBadge(cls.category);   // ✅ NEW
                const classId = cls._id || cls.id;
                return (
                  <tr key={classId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <div className="mc-class-icon" style={{ background: getIconColor(cls.name + cls.section) }}>
                          {cls.section}
                        </div>
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{cls.name}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>Section {cls.section}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      {/* ✅ NEW: category badge next to the level badge */}
                      <span className={`mc-badge mc-badge-${levelBadge}`}>{cls.level || 'N/A'}</span>
                      {categoryBadge && (
                        <span className={`mc-badge mc-badge-${categoryBadge}`} style={{ marginLeft: 4 }}>
                          {cls.category === 'primary' ? 'Primary' : 'Secondary'}
                        </span>
                      )}
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{cls.session}</td>
                    <td>
                      {teacherName ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <div style={{ width: 26, height: 26, borderRadius: '50%', background: getIconColor(teacherName), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.6rem', fontWeight: 700, flexShrink: 0 }}>
                            {teacherName.split(' ').map(n => n[0]).join('')}
                          </div>
                          <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{teacherName}</span>
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Assigned</span>
                      )}
                    </td>
                    <td>
                      {subjectNames.length > 0 ? (
                        <div className="mc-subjects">
                          {subjectNames.slice(0, 2).map((name, i) => (
                            <span className="mc-subject-pill" key={i}>{name}</span>
                          ))}
                          {subjectNames.length > 2 && (
                            <span className="mc-subject-more">+{subjectNames.length - 2}</span>
                          )}
                        </div>
                      ) : (
                        <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)' }}>—</span>
                      )}
                    </td>
                    <td>
                      <div className="mc-cap-wrap">
                        <span className="mc-cap-label">{cls.students?.length || 0} / {cls.capacity}</span>
                        <div className="mc-cap-bar">
                          <div className={`mc-cap-fill mc-cap-fill-${capColor}`} style={{ width: `${pct}%` }} />
                        </div>
                      </div>
                    </td>
                    <td>
                      <div className="mc-action-menu-wrap">
                        <button className="mc-action-trigger" onClick={(e) => toggleActionMenu(classId, e)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openActionMenu === classId && (
                          <>
                            <div className="mc-click-outside" onClick={() => setOpenActionMenu(null)} />
                            <div className="mc-action-menu">
                              <button className="mc-action-menu-item" onClick={() => { setOpenActionMenu(null); handleOpenEdit(cls); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                                Edit Class
                              </button>
                              <div className="mc-action-menu-sep" />
                              <button className="mc-action-menu-item danger" onClick={() => { setOpenActionMenu(null); handleDelete(cls); }}>
                                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                                Delete Class
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
      <div className="mc-cards">
        {filteredClasses.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>🏫</span>
            {searchTerm.trim() ? <>No classes found for "<strong>{searchTerm}</strong>"</> : 'No classes yet. Add your first class.'}
          </div>
        ) : filteredClasses.map((cls) => {
          const pct = getCapacityPercent(cls);
          const capColor = getCapacityColor(pct);
          const teacherName = getTeacherName(cls);
          const subjectNames = getSubjectNames(cls);
          const levelBadge = getLevelBadge(cls.level);
          const classId = cls._id || cls.id;
          return (
            <div className="mc-card" key={classId}>
              <div className="mc-card-top">
                <div className="mc-class-icon" style={{ background: getIconColor(cls.name + cls.section) }}>
                  {cls.section}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="mc-card-name">{cls.name} — {cls.section}</div>
                  <div className="mc-card-session">{cls.session}</div>
                </div>
                <div className="mc-card-badges">
                  <span className={`mc-badge mc-badge-${levelBadge}`}>{cls.level || 'N/A'}</span>
                  {/* ✅ NEW: category badge on mobile */}
                  {cls.category && (
                    <span className={`mc-badge ${cls.category === 'primary' ? 'mc-badge-purple' : 'mc-badge-blue'}`}>
                      {cls.category === 'primary' ? 'Primary' : 'Secondary'}
                    </span>
                  )}
                </div>
              </div>
              <div className="mc-card-grid">
                <div className="mc-card-field">
                  <span className="mc-card-field-label">Teacher</span>
                  <span className="mc-card-field-value">{teacherName || 'Not Assigned'}</span>
                </div>
                <div className="mc-card-field">
                  <span className="mc-card-field-label">Students</span>
                  <span className="mc-card-field-value" style={{ color: capColor === 'red' ? 'var(--danger)' : capColor === 'amber' ? 'var(--warning)' : 'var(--success)' }}>
                    {cls.students?.length || 0}
                  </span>
                </div>
              </div>
              <div className="mc-card-cap">
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-secondary)' }}>Capacity</span>
                  <span style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>{cls.students?.length || 0} / {cls.capacity}</span>
                </div>
                <div className="mc-cap-bar" style={{ height: 8 }}>
                  <div className={`mc-cap-fill mc-cap-fill-${capColor}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
              {subjectNames.length > 0 && (
                <div className="mc-card-subjects">
                  {subjectNames.slice(0, 3).map((name, i) => (
                    <span className="mc-subject-pill" key={i}>{name}</span>
                  ))}
                  {subjectNames.length > 3 && (
                    <span className="mc-subject-more">+{subjectNames.length - 3} more</span>
                  )}
                </div>
              )}
              <div className="mc-card-actions">
                <button className="mc-btn mc-btn-ghost mc-btn-sm" onClick={() => handleOpenEdit(cls)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                  Edit
                </button>
                <button className="mc-btn mc-btn-danger mc-btn-sm" onClick={() => handleDelete(cls)}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                  Delete
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* ===== MODAL: ADD/EDIT CLASS ===== */}
      {showModal && (
        <div className="mc-modal-overlay" onClick={handleCloseModal}>
          <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-handle" />
            <div className="mc-modal-header">
              <h3 className="mc-modal-title">{editingClass ? 'Edit Class' : 'Add New Class'}</h3>
              <button className="mc-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="mc-modal-body" ref={modalBodyRef} onScroll={handleModalScroll}>
              {error && (
                <div className="mc-alert mc-alert-danger">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  {error}
                </div>
              )}
              <form onSubmit={handleSubmit}>
                <div className="mc-form-row">
                  <div className="mc-form-group">
                    <label className="mc-form-label">Class Name *</label>
                    <input type="text" name="name" className="mc-form-input" value={formData.name} onChange={handleChange} placeholder="e.g., JSS 1" required />
                  </div>
                  <div className="mc-form-group">
                    <label className="mc-form-label">Section *</label>
                    <input type="text" name="section" className="mc-form-input" value={formData.section} onChange={handleChange} placeholder="e.g., A" required />
                  </div>
                </div>
                <div className="mc-form-row">
                  <div className="mc-form-group">
                    <label className="mc-form-label">Level *</label>
                    <input type="text" name="level" className="mc-form-input" value={formData.level} onChange={handleChange} placeholder="e.g., 7, Primary" required />
                  </div>
                  <div className="mc-form-group">
                    <label className="mc-form-label">Session *</label>
                    <input type="text" name="session" className="mc-form-input" value={formData.session} onChange={handleChange} placeholder="e.g., 2024-2025" required />
                  </div>
                </div>
                <div className="mc-form-row">
                  <div className="mc-form-group">
                    <label className="mc-form-label">Capacity *</label>
                    <input type="number" name="capacity" className="mc-form-input" value={formData.capacity} onChange={handleChange} min="1" max="200" required />
                  </div>
                  <div className="mc-form-group">
                    <label className="mc-form-label">Class Teacher *</label>
                    <select name="teacherId" className="mc-form-input mc-form-select" value={formData.teacherId} onChange={handleChange} required>
                      <option value="">Select Teacher</option>
                      {teachers?.data?.map((teacher) => (
                        <option key={teacher._id || teacher.id} value={teacher._id || teacher.id}>
                          {teacher.firstName} {teacher.lastName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* ✅ NEW: School Category picker */}
                <div className="mc-form-group full" style={{ marginBottom: 14 }}>
                  <label className="mc-form-label">School Category *</label>
                  <select name="category" className="mc-form-input mc-form-select" value={formData.category} onChange={handleChange} required>
                    <option value="">Select Category</option>
                    <option value="primary">Primary School (KG 1 - Primary 5)</option>
                    <option value="secondary">Secondary School (JSS 1 - SSS 3)</option>
                  </select>
                  <span className="mc-form-hint">Determines which promotion ladder this class belongs to</span>
                </div>

                <div className="mc-form-group" style={{ marginBottom: 0 }}>
                  <label className="mc-form-label">Subjects ({formData.subjects.length} selected)</label>
                  <div className="mc-checkbox-grid">
                    {subjects?.data?.length === 0 ? (
                      <div className="mc-checkbox-empty">No subjects available</div>
                    ) : (
                      subjects?.data?.map((subject) => {
                        const subjId = subject._id || subject.id;
                        return (
                          <label className="mc-checkbox-item" key={subjId}>
                            <input
                              type="checkbox"
                              value={subjId}
                              checked={formData.subjects.includes(subjId)}
                              onChange={() => handleSubjectToggle(subjId)}
                            />
                            {subject.name}
                            <span className="mc-checkbox-code">{subject.code}</span>
                          </label>
                        );
                      })
                    )}
                  </div>
                </div>
              </form>

              <button
                className={`mc-scroll-top ${showScrollBtn ? 'visible' : ''}`}
                onClick={scrollToTop}
                aria-label="Scroll to top"
                title="Scroll to top"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><polyline points="18 15 12 9 6 15"/></svg>
              </button>
            </div>
            <div className="mc-modal-footer">
              <button type="button" className="mc-btn mc-btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button
                type="button"
                className="mc-btn mc-btn-primary"
                disabled={createMutation.isPending || createMutation.isLoading || updateMutation.isPending || updateMutation.isLoading}
                onClick={handleSubmit}
              >
                {(createMutation.isPending || createMutation.isLoading || updateMutation.isPending || updateMutation.isLoading) ? (
                  <><span className="mc-spinner"></span> Saving...</>
                ) : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== MODAL: CSV UPLOAD ===== */}
      {showUploadModal && (
        <div className="mc-modal-overlay" onClick={() => !isUploading && setShowUploadModal(false)}>
          <div className="mc-modal" onClick={(e) => e.stopPropagation()}>
            <div className="mc-modal-handle" />
            <div className="mc-modal-header">
              <h3 className="mc-modal-title">Bulk Upload Classes</h3>
              <button className="mc-modal-close" onClick={() => !isUploading && setShowUploadModal(false)} disabled={isUploading}>×</button>
            </div>
            <div className="mc-modal-body">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="mc-form-hint">Class Teacher: full name, username or email. Category column optional (blank = auto-detected from class name).</span>
                <button type="button" className="mc-btn mc-btn-ghost mc-btn-sm" onClick={downloadSampleCSV}>Download Sample</button>
              </div>
              <input type="file" accept=".csv" className="mc-file-input" ref={fileInputRef} onChange={handleFileChange} disabled={isUploading} />

              {csvError && <div className="mc-alert mc-alert-danger" style={{ marginTop: 12, marginBottom: 0 }}>{csvError}</div>}

              {parsedClasses.length > 0 && (
                <div className="mc-upload-preview" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr><th>Row</th><th>Class</th><th>Session</th><th>Teacher</th><th>Capacity</th><th>Category</th></tr>
                    </thead>
                    <tbody>
                      {parsedClasses.map(c => (
                        <tr key={c._rowNumber}>
                          <td>{c._rowNumber}</td>
                          <td>{c.name} - {c.section}</td>
                          <td>{c.session}</td>
                          <td>{c._teacherName}</td>
                          <td>{c.capacity}</td>
                          <td>
                            {c._category
                              ? (c._category === 'primary' ? 'Primary' : 'Secondary')
                              : <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>auto</span>}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <div className="mc-progress-bar">
                    <div className="mc-progress-fill" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                  </div>
                  <p className="mc-form-hint" style={{ marginTop: 6 }}>Uploading {uploadProgress.current} of {uploadProgress.total}...</p>
                </div>
              )}

              {uploadLog.length > 0 && (
                <div className="mc-upload-log" style={{ marginTop: 12 }}>
                  {uploadLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
            <div className="mc-modal-footer">
              <button className="mc-btn mc-btn-ghost" onClick={() => !isUploading && setShowUploadModal(false)} disabled={isUploading}>Close</button>
              <button className="mc-btn mc-btn-success" onClick={handleBulkUpload} disabled={parsedClasses.length === 0 || isUploading}>
                {isUploading ? <><span className="mc-spinner"></span> Importing...</> : `Import ${parsedClasses.length} Class(es)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageClasses;