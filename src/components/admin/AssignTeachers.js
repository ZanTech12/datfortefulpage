import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { dashboardAPI } from '../../api';
import Loading from '../common/Loading';

// ==================== SCROLLABLE SELECT COMPONENT ====================
const ScrollableSelect = ({ 
  options, value, onChange, placeholder, label, required, id, optionRenderer, searchPlaceholder, noOptionsText, footerLabel,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const dropdownRef = useRef(null);
  const searchInputRef = useRef(null);

  const selectedOption = options.find(opt => String(opt.value) === String(value));

  const filteredOptions = useMemo(() => {
    if (!searchTerm) return options;
    return options.filter(opt => opt.label.toLowerCase().includes(searchTerm.toLowerCase()));
  }, [options, searchTerm]);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
        setSearchTerm('');
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchInputRef.current) searchInputRef.current.focus();
  }, [isOpen]);

  const handleSelect = (optionValue) => {
    onChange(optionValue);
    setIsOpen(false);
    setSearchTerm('');
  };

  const handleClear = (e) => {
    e.stopPropagation();
    onChange('');
    setSearchTerm('');
  };

  return (
    <div className="at-ss" ref={dropdownRef}>
      {label && (
        <label className="at-ss-label">
          {label} {required && <span style={{color:'var(--danger)'}}>*</span>}
        </label>
      )}
      <div className={`at-ss-trigger ${isOpen ? 'at-ss-open' : ''}`} onClick={() => setIsOpen(!isOpen)}>
        <span className={`at-ss-value ${!selectedOption ? 'at-ss-placeholder' : ''}`}>
          {selectedOption ? selectedOption.label : placeholder}
        </span>
        <div className="at-ss-actions">
          {value && (
            <button className="at-ss-clear" onClick={handleClear} type="button">×</button>
          )}
          <span className={`at-ss-arrow ${isOpen ? 'at-ss-arrow-up' : ''}`}>
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none"><path d="M6 8L1 3h10z" fill="#6b7280"/></svg>
          </span>
        </div>
      </div>
      {isOpen && (
        <div className="at-ss-dropdown">
          <div className="at-ss-search">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#9ca3af" strokeWidth="2"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
            <input ref={searchInputRef} type="text" value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} placeholder={searchPlaceholder || 'Search...'} className="at-ss-search-input" />
            {searchTerm && (
              <button className="at-ss-search-clear" onClick={(e) => { e.stopPropagation(); setSearchTerm(''); }} type="button">×</button>
            )}
          </div>
          <div className="at-ss-list">
            {filteredOptions.length === 0 ? (
              <div className="at-ss-empty">{noOptionsText || 'No options found'}</div>
            ) : (
              filteredOptions.map((option) => (
                <div key={String(option.value)} className={`at-ss-option ${String(option.value) === String(value) ? 'at-ss-option-selected' : ''}`} onClick={() => handleSelect(option.value)}>
                  {optionRenderer ? optionRenderer(option) : option.label}
                </div>
              ))
            )}
          </div>
          <div className="at-ss-footer">{filteredOptions.length} of {options.length} {footerLabel || 'options'}</div>
        </div>
      )}
    </div>
  );
};

// ==================== MAIN COMPONENT ====================
const AssignTeachers = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState({ teacher_id: '', class_id: '', subject_id: '' });
  const [filterClass, setFilterClass] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [searchTeacher, setSearchTeacher] = useState('');
  const [notification, setNotification] = useState({ show: false, type: '', message: '' });
  const [openActionMenu, setOpenActionMenu] = useState(null);

  // CSV import state
  const [showCSVModal, setShowCSVModal] = useState(false);
  const [parsedAssignments, setParsedAssignments] = useState([]);
  const [isImporting, setIsImporting] = useState(false);
  const [importProgress, setImportProgress] = useState({ current: 0, total: 0 });
  const [importLog, setImportLog] = useState([]);
  const [csvError, setCsvError] = useState('');

  const { data: teachersData, isLoading: teachersLoading } = useQuery({ queryKey: ['teachers-list'], queryFn: dashboardAPI.getTeachers });
  const { data: classesData, isLoading: classesLoading } = useQuery({ queryKey: ['classes-list'], queryFn: dashboardAPI.getClasses });
  const { data: subjectsData, isLoading: subjectsLoading } = useQuery({ queryKey: ['subjects-list'], queryFn: dashboardAPI.getSubjects });
  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({ queryKey: ['teacher-assignments'], queryFn: dashboardAPI.getTeacherAssignments });

  const assignmentMutation = useMutation({
    mutationFn: (data) => editingId ? dashboardAPI.updateTeacherAssignment(editingId, data) : dashboardAPI.createTeacherAssignment(data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] }); showNotif('success', editingId ? 'Assignment updated!' : 'Assignment created!'); resetForm(); },
    onError: (error) => showNotif('error', error?.response?.data?.message || 'Failed to save assignment'),
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => dashboardAPI.deleteTeacherAssignment(id),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] }); showNotif('success', 'Assignment removed!'); },
    onError: (error) => showNotif('error', error?.response?.data?.message || 'Failed to delete'),
  });

  const teachers = teachersData?.data || [];
  const classes = classesData?.data || [];
  const subjects = subjectsData?.data || [];
  const assignments = assignmentsData?.data || [];

  const teacherOptions = useMemo(() => teachers.map(t => ({ 
    value: String(t._id || t.id), 
    label: `${t.firstName} ${t.lastName} (${t.email})`, 
    firstName: t.firstName, lastName: t.lastName, email: t.email 
  })), [teachers]);

  const classOptions = useMemo(() => classes.map(c => ({ 
    value: String(c._id || c.id), 
    label: `${c.name}${c.section ? ` - ${c.section}` : ''}${c.level ? ` (${c.level})` : ''}`, 
    name: c.name, section: c.section, level: c.level 
  })), [classes]);

  const subjectOptions = useMemo(() => subjects.map(s => ({ 
    value: String(s._id || s.id), 
    label: `${s.name} (${s.code})`, 
    name: s.name, code: s.code 
  })), [subjects]);

  const filteredAssignments = useMemo(() => {
    return assignments.filter((a) => {
      const aClassId = a.class_id?._id || a.classId?._id;
      const aSubjectId = a.subject_id?._id || a.subjectId?._id;
      const matchClass = !filterClass || String(aClassId) === String(filterClass);
      const matchSubject = !filterSubject || String(aSubjectId) === String(filterSubject);
      const matchTeacher = !searchTeacher || a.teacher_name?.toLowerCase().includes(searchTeacher.toLowerCase()) || a.teacher_email?.toLowerCase().includes(searchTeacher.toLowerCase());
      return matchClass && matchSubject && matchTeacher;
    });
  }, [assignments, filterClass, filterSubject, searchTeacher]);

  const isDuplicate = useMemo(() => {
    if (!formData.teacher_id || !formData.class_id || !formData.subject_id) return false;
    return assignments.some((a) => {
      const aT = a.teacher_id?._id || a.teacherId?._id;
      const aC = a.class_id?._id || a.classId?._id;
      const aS = a.subject_id?._id || a.subjectId?._id;
      return String(aT) === String(formData.teacher_id) && String(aC) === String(formData.class_id) && String(aS) === String(formData.subject_id) && a.id !== editingId;
    });
  }, [formData, assignments, editingId]);

  const selectedTeacherAssignments = useMemo(() => {
    if (!formData.teacher_id) return [];
    return assignments.filter((a) => { 
      const aT = a.teacher_id?._id || a.teacherId?._id; 
      return String(aT) === String(formData.teacher_id) && a.id !== editingId; 
    });
  }, [formData.teacher_id, assignments, editingId]);

  useEffect(() => {
    const handleClickOutside = () => setOpenActionMenu(null);
    if (openActionMenu) {
      document.addEventListener('click', handleClickOutside);
      return () => document.removeEventListener('click', handleClickOutside);
    }
  }, [openActionMenu]);

  // Lock page scroll while the CSV modal is open
  useEffect(() => {
    document.body.style.overflow = showCSVModal ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [showCSVModal]);

  const resetForm = () => { setFormData({ teacher_id: '', class_id: '', subject_id: '' }); setEditingId(null); setShowForm(false); };

  const handleEdit = (assignment) => {
    setFormData({ 
      teacher_id: String(assignment.teacher_id?._id || assignment.teacherId?._id || ''), 
      class_id: String(assignment.class_id?._id || assignment.classId?._id || ''), 
      subject_id: String(assignment.subject_id?._id || assignment.subjectId?._id || '') 
    });
    setEditingId(assignment.id);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleDelete = (assignment) => {
    if (window.confirm(`Remove ${assignment.teacher_name} from ${assignment.class_name} (${assignment.subject_name})?`)) deleteMutation.mutate(assignment.id);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (isDuplicate) { showNotif('error', 'This teacher is already assigned to this class and subject!'); return; }
    // FIX: send the raw string IDs - parseInt() truncates MongoDB ObjectIds
    assignmentMutation.mutate({
      teacher_id: formData.teacher_id,
      class_id: formData.class_id,
      subject_id: formData.subject_id
    });
  };

  const showNotif = (type, message) => {
    setNotification({ show: true, type, message });
    setTimeout(() => setNotification({ show: false, type: '', message: '' }), 4000);
  };

  const toggleActionMenu = (id, e) => {
    e.stopPropagation();
    setOpenActionMenu(openActionMenu === id ? null : id);
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const getResultText = () => {
    const hasFilter = filterClass || filterSubject || searchTeacher;
    if (hasFilter && filteredAssignments.length !== assignments.length) return `Showing ${filteredAssignments.length} of ${assignments.length}`;
    return `${assignments.length} assignments`;
  };

  // ==================== CSV EXPORT ====================
  const exportAssignmentsCSV = () => {
    const hasFilters = !!(filterClass || filterSubject || searchTeacher);
    const dataToExport = hasFilters ? filteredAssignments : assignments;

    if (dataToExport.length === 0) {
      showNotif('error', 'No assignments available to export.');
      return;
    }

    const escapeCSV = (value) => {
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const headers = ['#', 'Teacher Name', 'Teacher Email', 'Class', 'Subject', 'Questions', 'Date Assigned'];
    const rows = dataToExport.map((a, index) => [
      index + 1,
      a.teacher_name || '',
      a.teacher_email || '',
      a.class_name || '',
      a.subject_name || '',
      a.question_count || 0,
      a.created_at ? new Date(a.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : ''
    ]);

    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 10);
    const filterSuffix = hasFilters ? '_filtered' : '';
    link.setAttribute('download', `teacher_assignments${filterSuffix}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    showNotif('success', `Exported ${dataToExport.length} assignment(s).`);
  };

  // ==================== CSV IMPORT ====================

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
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { fields.push(current); current = ''; }
        else current += ch;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  };

  const downloadAssignmentSampleCSV = () => {
    const csvContent = [
      'Teacher,ClassName,Section,Subject',
      'John Doe,JSS 1,A,Mathematics',
      'jdoe,JSS 2,B,Basic Science',
      'jane.smith@school.com,SSS 1,A,MATH',
      'Sam Okon,SSS1 A,,English Language' // combined "Name Section" format also works
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'assignment_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenCSVModal = () => {
    setParsedAssignments([]);
    setImportLog([]);
    setCsvError('');
    setImportProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowCSVModal(true);
  };

  const handleCloseCSVModal = () => {
    if (isImporting) return;
    setShowCSVModal(false);
    setParsedAssignments([]);
    setImportLog([]);
    setCsvError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // =====================================================
  // UPDATED MATCHERS (whitespace/format tolerant)
  // =====================================================

  // Collapses multiple spaces, trims, and lowercases - fixes the
  // "Babatunde  Kayode" (double space) vs "Babatunde Kayode" mismatch
  const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  // Matches a teacher by full name, username, or email.
  // Tolerates extra/trailing spaces in the database names,
  // and also tries reversed name order (e.g. "Kayode Babatunde").
  const matchTeacher = (value) => {
    if (!value) return null;
    const v = normalize(value);

    // Forward name order: "Babatunde Kayode"
    const fullMatches = teachers.filter(t => normalize(`${t.firstName} ${t.lastName}`) === v);
    if (fullMatches.length === 1) return fullMatches[0];
    if (fullMatches.length > 1) {
      return { error: `multiple teachers named "${value}" - use username or email instead` };
    }

    // Reversed name order: "Kayode Babatunde"
    const reversedMatches = teachers.filter(t => normalize(`${t.lastName} ${t.firstName}`) === v);
    if (reversedMatches.length === 1) return reversedMatches[0];

    // Username or email
    return teachers.find(t => normalize(t.username) === v || normalize(t.email) === v) || null;
  };

  // Matches a class THREE ways:
  //   1) Separate ClassName + Section columns ("JSS 2" / "A")
  //   2) One combined value: "JSS 2 A" or "JSS 2 - A"
  //   3) Name only, if unambiguous
  // All comparisons are whitespace/case-tolerant.
  const matchClass = (nameValue, sectionValue) => {
    if (!nameValue) return null;
    const raw = normalize(nameValue);
    const sec = normalize(sectionValue);

    // 1) Explicit ClassName + Section columns
    if (sec) {
      const found = classes.find(c => normalize(c.name) === raw && normalize(c.section) === sec);
      if (found) return found;
    }

    // 2) Single combined value: "JSS 2 A" or "JSS 2 - A"
    const combined = raw.replace(/\s*-\s*/g, ' ');
    const byCombined = classes.find(c => normalize(`${c.name} ${c.section || ''}`) === combined);
    if (byCombined) return byCombined;

    // 3) Name only - must be unambiguous
    const matches = classes.filter(c => normalize(c.name) === raw);
    if (matches.length === 1) return matches[0];
    if (matches.length > 1) {
      return { error: `multiple classes named "${nameValue}" - include the section (e.g. "${matches[0].name} ${matches[0].section}")` };
    }

    // 4) Helpful hint: same class name exists but with a different section
    const lastSpace = raw.lastIndexOf(' ');
    if (lastSpace > 0) {
      const possibleName = raw.slice(0, lastSpace);
      const sameName = classes.filter(c => normalize(c.name) === possibleName);
      if (sameName.length > 0) {
        const sections = sameName.map(c => c.section).filter(Boolean).join(', ');
        return { error: `Class "${nameValue}" not found - "${possibleName}" exists but only with section(s): ${sections}` };
      }
    }

    return null;
  };

  // Matches a subject by name or code, whitespace/case-tolerant
  const matchSubject = (value) => {
    if (!value) return null;
    const v = normalize(value);
    return subjects.find(s => normalize(s.name) === v || normalize(s.code) === v) || null;
  };

  const handleCSVFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a .csv file.');
      setParsedAssignments([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target.result).replace(/^\ufeff/, '');
        const lines = text.split(/\r\n|\n/).filter(l => l.trim() !== '');
        if (lines.length < 2) { setCsvError('CSV file is empty or missing data rows.'); return; }
        const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
        const getVal = (row, possibleKeys) => {
          const foundKey = possibleKeys.find(k => rawHeaders.includes(k));
          return foundKey ? (row[rawHeaders.indexOf(foundKey)] || '').trim() : '';
        };

        // Existing assignments as "teacher|class|subject" keys for duplicate detection
        const existingKeys = new Set(assignments.map(a => {
          const t = a.teacher_id?._id || a.teacherId?._id;
          const c = a.class_id?._id || a.classId?._id;
          const s = a.subject_id?._id || a.subjectId?._id;
          return `${t}|${c}|${s}`;
        }));
        const seenKeys = new Set();

        const mapped = [];
        const errors = [];

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2 || !values[0]) continue;

          const teacherRaw = getVal(values, ['teacher', 'teacher name', 'class teacher', 'teacher username', 'teacher email']);
          const className = getVal(values, ['classname', 'class_name', 'class name', 'class']);
          const section = getVal(values, ['section', 'sec', 'class section']);
          const subjectRaw = getVal(values, ['subject', 'subject name', 'subject code']);

          if (!teacherRaw) { errors.push(`Row ${i + 1}: Teacher is required (name, username or email).`); continue; }
          const teacher = matchTeacher(teacherRaw);
          if (!teacher || teacher.error) {
            errors.push(`Row ${i + 1}: ${teacher?.error || `Teacher "${teacherRaw}" not found in system.`}`);
            continue;
          }

          const cls = matchClass(className, section);
          if (!cls || cls.error) {
            errors.push(`Row ${i + 1}: ${cls?.error || `Class "${className}${section ? ' - ' + section : ''}" not found in system.`}`);
            continue;
          }

          const subject = matchSubject(subjectRaw);
          if (!subject) {
            errors.push(`Row ${i + 1}: Subject "${subjectRaw}" not found (matched by name or code).`);
            continue;
          }

          const tId = String(teacher._id || teacher.id);
          const cId = String(cls._id || cls.id);
          const sId = String(subject._id || subject.id);
          const key = `${tId}|${cId}|${sId}`;

          if (existingKeys.has(key)) {
            errors.push(`Row ${i + 1}: ${teacher.firstName} ${teacher.lastName} is already assigned to ${cls.name}${cls.section ? ' - ' + cls.section : ''} / ${subject.name}.`);
          } else if (seenKeys.has(key)) {
            errors.push(`Row ${i + 1}: Duplicate row within this file (same teacher/class/subject).`);
          }
          seenKeys.add(key);

          mapped.push({
            teacher_id: tId,
            class_id: cId,
            subject_id: sId,
            _rowNumber: i + 1,
            _teacherName: `${teacher.firstName} ${teacher.lastName}`,
            _classLabel: `${cls.name}${cls.section ? ' - ' + cls.section : ''}`,
            _subjectName: subject.name
          });
        }
        setCsvError(errors.join(' | '));
        setParsedAssignments(mapped);
      } catch (err) {
        console.error(err);
        setCsvError('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsText(file);
  };

  const handleImportAssignments = async () => {
    if (parsedAssignments.length === 0) return;
    setIsImporting(true);
    setImportLog([]);
    setImportProgress({ current: 0, total: parsedAssignments.length });
    let successCount = 0;
    let failCount = 0;
    for (const a of parsedAssignments) {
      const { _rowNumber, _teacherName, _classLabel, _subjectName, ...payload } = a;
      try {
        await dashboardAPI.createTeacherAssignment(payload);
        successCount++;
        setImportLog(prev => [...prev, `✅ Row ${_rowNumber}: ${_teacherName} → ${_classLabel} / ${_subjectName}`]);
      } catch (err) {
        failCount++;
        setImportLog(prev => [...prev, `❌ Row ${_rowNumber}: Failed (${err.response?.data?.message || 'Unknown error'})`]);
      }
      setImportProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setIsImporting(false);
    queryClient.invalidateQueries({ queryKey: ['teacher-assignments'] });
    setImportLog(prev => [...prev, `--- Import Complete: ${successCount} succeeded, ${failCount} failed ---`]);
    if (failCount === 0) {
      showNotif('success', `Imported ${successCount} assignment(s)!`);
    } else {
      showNotif('error', `${failCount} of ${parsedAssignments.length} rows failed - see the log for details.`);
    }
  };

  if (teachersLoading || classesLoading || subjectsLoading || assignmentsLoading) return <Loading message="Loading assignments..." />;

  return (
    <div className="at-root">
      <style>{`
        /* ===== BASE TOKENS ===== */
        .at-root { --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8; --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5; --warning: #f59e0b; --warning-light: #fffbeb; --radius: 12px; --radius-sm: 8px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }

        /* ===== HEADER ===== */
        .at-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .at-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .at-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .at-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
        .at-header-actions { display: flex; gap: 8px; }

        /* ===== BUTTONS ===== */
        .at-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; line-height: 1.4; }
        .at-btn:active { transform: scale(0.97); }
        .at-btn-primary { background: var(--primary); color: #fff; }
        .at-btn-primary:hover { background: var(--primary-hover); }
        .at-btn-success { background: var(--success); color: #fff; }
        .at-btn-success:hover { background: #059669; }
        .at-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .at-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
        .at-btn-danger { background: var(--danger); color: #fff; }
        .at-btn-danger:hover { background: var(--danger-hover); }
        .at-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
        .at-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .at-btn-icon { padding: 8px; min-width: 36px; justify-content: center; }
        .at-btn-icon svg { width: 16px; height: 16px; }

        /* ===== MODAL ===== */
        .at-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: atFade 0.2s ease; }
        @keyframes atFade { from { opacity: 0; } to { opacity: 1; } }
        .at-modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 700px; max-height: 90vh; display: flex; flex-direction: column; animation: atSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); border: 1px solid var(--border); border-bottom: none; }
        @keyframes atSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .at-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; flex-shrink: 0; }
        .at-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; flex-shrink: 0; }
        .at-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
        .at-modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all var(--transition); }
        .at-modal-close:hover { background: #e2e8f0; color: var(--text); }
        .at-modal-body { padding: 20px; overflow-y: auto; flex: 1; -webkit-overflow-scrolling: touch; }
        .at-modal-footer { display: flex; gap: 10px; padding: 0 20px 24px; justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0; }
        @media (min-width: 768px) {
          .at-modal-overlay { align-items: center; }
          .at-modal { border-radius: 20px; border-bottom: 1px solid var(--border); }
          .at-modal-handle { display: none; }
        }

        /* ===== CSV IMPORT STYLES ===== */
        .at-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .at-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }
        .at-upload-log { max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.76rem; line-height: 1.6; color: var(--text-secondary); }
        .at-upload-preview { max-height: 220px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .at-upload-preview table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .at-upload-preview th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.72rem; text-transform: uppercase; color: var(--text-muted); background: #f8fafc; position: sticky; top: 0; }
        .at-upload-preview td { padding: 7px 10px; border-top: 1px solid var(--border); }
        .at-file-input { width: 100%; padding: 10px; border: 1px dashed #cbd5e1; border-radius: var(--radius-sm); font-size: 0.85rem; box-sizing: border-box; background: var(--surface); cursor: pointer; }

        /* ===== STATS BAR ===== */
        .at-stats { display: grid; grid-template-columns: repeat(4, 1fr); gap: 12px; padding: 16px 24px; background: var(--surface); border-bottom: 1px solid var(--border); }
        .at-stat { text-align: center; padding: 10px 8px; background: var(--bg); border-radius: var(--radius-sm); border: 1px solid var(--border); transition: all var(--transition); }
        .at-stat:hover { border-color: #cbd5e1; box-shadow: var(--shadow-sm); }
        .at-stat-value { display: block; font-size: 1.35rem; font-weight: 700; color: var(--text); line-height: 1.2; }
        .at-stat-label { display: block; font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); margin-top: 2px; }

        /* ===== SEARCH/FILTER BAR ===== */
        .at-filter-bar { padding: 12px 24px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
        .at-search-wrap { flex: 1; min-width: 200px; position: relative; }
        .at-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; pointer-events: none; }
        .at-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; -webkit-appearance: none; }
        .at-search-input::placeholder { color: var(--text-muted); }
        .at-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .at-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #e2e8f0; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; transition: background var(--transition); }
        .at-search-clear:hover { background: #cbd5e1; }
        .at-filter-select { padding: 10px 32px 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.84rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; min-width: 140px; }
        .at-filter-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .at-filter-select option { color: var(--text); background: var(--surface); }
        .at-result-count { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; margin-left: auto; }
        .at-result-count svg { width: 14px; height: 14px; vertical-align: -2px; margin-right: 4px; }

        /* ===== NOTIFICATION TOAST ===== */
        .at-toast { position: fixed; top: 20px; right: 20px; z-index: 200; padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; display: flex; align-items: center; gap: 10px; box-shadow: var(--shadow-lg); animation: atToastIn 0.3s cubic-bezier(0.16, 1, 0.3, 1); max-width: 400px; }
        .at-toast-success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
        .at-toast-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .at-toast-close { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 1.2rem; line-height: 1; opacity: 0.6; color: inherit; padding: 0 2px; transition: opacity var(--transition); }
        .at-toast-close:hover { opacity: 1; }
        @keyframes atToastIn { from { opacity: 0; transform: translateY(-12px) scale(0.96); } to { opacity: 1; transform: translateY(0) scale(1); } }

        /* ===== FORM PANEL ===== */
        /* FIX: Removed 'overflow: hidden' so dropdown can spill out */
        .at-form-panel { background: var(--surface); border-bottom: 1px solid var(--border); animation: atFormIn 0.25s ease; }
        @keyframes atFormIn { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .at-form-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 24px; border-bottom: 1px solid var(--border); }
        .at-form-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0; display: flex; align-items: center; gap: 8px; }
        .at-form-title-icon { font-size: 1rem; }
        .at-form-body { padding: 20px 24px; }
        .at-form-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; }
        .at-form-alert { padding: 10px 14px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 500; display: flex; align-items: flex-start; gap: 8px; margin-top: 14px; }
        .at-form-alert-error { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .at-form-alert-warning { background: var(--warning-light); color: #92400e; border: 1px solid #fde68a; }
        .at-form-alert-warning ul { margin: 4px 0 0; padding-left: 18px; }
        .at-form-alert-warning li { font-size: 0.8rem; line-height: 1.6; }
        .at-form-actions { display: flex; gap: 10px; justify-content: flex-end; margin-top: 18px; }

        /* ===== SCROLLABLE SELECT ===== */
        .at-ss { position: relative; }
        .at-ss-label { display: block; font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); margin-bottom: 5px; }
        .at-ss-trigger { display: flex; align-items: center; justify-content: space-between; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); cursor: pointer; transition: border-color var(--transition), box-shadow var(--transition); min-height: 42px; }
        .at-ss-trigger:hover { border-color: #cbd5e1; }
        .at-ss-open { border-color: var(--primary) !important; box-shadow: 0 0 0 3px rgba(79,70,229,0.12) !important; }
        .at-ss-value { font-size: 0.88rem; color: var(--text); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; flex: 1; }
        .at-ss-placeholder { color: var(--text-muted) !important; }
        .at-ss-actions { display: flex; align-items: center; gap: 4px; flex-shrink: 0; margin-left: 8px; }
        .at-ss-clear { width: 20px; height: 20px; border-radius: 50%; border: none; background: #e2e8f0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 14px; line-height: 1; transition: background var(--transition); }
        .at-ss-clear:hover { background: #cbd5e1; }
        .at-ss-arrow { display: flex; transition: transform var(--transition); }
        .at-ss-arrow-up { transform: rotate(180deg); }
        /* FIX: Increased z-index to 100 so it overlays the filter bar below it */
        .at-ss-dropdown { position: absolute; top: calc(100% + 4px); left: 0; right: 0; background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); z-index: 100; overflow: hidden; animation: atSsIn 0.15s ease; }
        @keyframes atSsIn { from { opacity: 0; transform: translateY(-4px) scale(0.98); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .at-ss-search { display: flex; align-items: center; gap: 8px; padding: 8px 12px; border-bottom: 1px solid var(--border); }
        .at-ss-search svg { flex-shrink: 0; }
        .at-ss-search-input { flex: 1; border: none; outline: none; font-size: 0.84rem; color: var(--text); background: transparent; padding: 4px 0; }
        .at-ss-search-input::placeholder { color: var(--text-muted); }
        .at-ss-search-clear { width: 18px; height: 18px; border-radius: 50%; border: none; background: #e2e8f0; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 12px; line-height: 1; flex-shrink: 0; }
        .at-ss-list { max-height: 200px; overflow-y: auto; }
        .at-ss-list::-webkit-scrollbar { width: 5px; }
        .at-ss-list::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .at-ss-option { padding: 10px 14px; font-size: 0.84rem; color: var(--text); cursor: pointer; transition: background var(--transition); }
        .at-ss-option:hover { background: #f8fafc; }
        .at-ss-option-selected { background: var(--primary-light) !important; color: var(--primary); font-weight: 600; }
        .at-ss-empty { padding: 20px 14px; text-align: center; font-size: 0.82rem; color: var(--text-muted); }
        .at-ss-footer { padding: 8px 14px; font-size: 0.72rem; color: var(--text-muted); font-weight: 500; border-top: 1px solid var(--border); background: #f8fafc; }

        /* Custom option renderers */
        .at-opt-teacher { display: flex; align-items: center; gap: 10px; }
        .at-opt-avatar { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.72rem; flex-shrink: 0; }
        .at-opt-details { display: flex; flex-direction: column; min-width: 0; }
        .at-opt-name { font-size: 0.84rem; font-weight: 500; color: inherit; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .at-opt-email { font-size: 0.72rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .at-opt-class { display: flex; align-items: center; gap: 6px; }
        .at-opt-icon { font-size: 0.9rem; }
        .at-opt-class-name { font-size: 0.84rem; font-weight: 500; }
        .at-opt-class-section { font-size: 0.78rem; color: var(--text-muted); }
        .at-opt-class-level { font-size: 0.72rem; color: var(--text-muted); }
        .at-opt-subject { display: flex; align-items: center; gap: 6px; }
        .at-opt-subject-name { font-size: 0.84rem; font-weight: 500; }
        .at-opt-subject-code { font-size: 0.72rem; color: var(--text-muted); }

        /* ===== DESKTOP TABLE ===== */
        .at-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .at-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 800px; }
        .at-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .at-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .at-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .at-table tbody tr { transition: background var(--transition); }
        .at-table tbody tr:hover { background: #f8fafc; }
        .at-table tbody tr:last-child td { border-bottom: none; }
        .at-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .at-empty-icon { font-size: 2.5rem; margin-bottom: 8px; display: block; }
        .at-empty strong { color: var(--text-secondary); }

        /* ===== BADGES ===== */
        .at-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .at-badge-blue { background: #dbeafe; color: #1e40af; }
        .at-badge-purple { background: #f3e8ff; color: #6b21a8; }
        .at-badge-gray { background: #f1f5f9; color: #64748b; }

        /* ===== QUESTION COUNT ===== */
        .at-qc { display: flex; flex-direction: column; align-items: flex-start; gap: 1px; }
        .at-qc-value { font-weight: 700; font-size: 0.9rem; }
        .at-qc-value.has { color: var(--success); }
        .at-qc-value.none { color: var(--text-muted); }
        .at-qc-label { font-size: 0.7rem; color: var(--text-muted); font-weight: 500; }

        /* ===== TEACHER CELL ===== */
        .at-teacher-cell { display: flex; align-items: center; gap: 10px; }
        .at-teacher-avatar { width: 34px; height: 34px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.78rem; flex-shrink: 0; }
        .at-teacher-info { display: flex; flex-direction: column; min-width: 0; }
        .at-teacher-name { font-weight: 600; font-size: 0.88rem; color: var(--text); line-height: 1.3; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .at-teacher-email { font-size: 0.76rem; color: var(--text-muted); overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }

        /* ===== ACTION MENU ===== */
        .at-action-wrap { position: relative; }
        .at-action-trigger { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .at-action-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
        .at-action-trigger svg { width: 16px; height: 16px; color: var(--text-muted); }
        .at-action-menu { position: absolute; right: 0; top: calc(100% + 4px); background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); min-width: 180px; z-index: 50; overflow: hidden; animation: atMenuIn 0.15s ease; }
        @keyframes atMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .at-action-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: background var(--transition); text-align: left; }
        .at-action-item:hover { background: #f8fafc; }
        .at-action-item svg { width: 15px; height: 15px; flex-shrink: 0; }
        .at-action-item.danger { color: var(--danger); }
        .at-action-item.danger:hover { background: #fef2f2; }
        .at-action-sep { height: 1px; background: var(--border); margin: 2px 0; }
        .at-click-outside { position: fixed; inset: 0; z-index: 40; }

        /* ===== MOBILE CARDS ===== */
        .at-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .at-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; transition: box-shadow var(--transition); }
        .at-card:active { box-shadow: var(--shadow); }
        .at-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .at-card-name { font-weight: 600; font-size: 0.95rem; color: var(--text); line-height: 1.3; }
        .at-card-email { font-size: 0.76rem; color: var(--text-muted); margin-top: 1px; }
        .at-card-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .at-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 14px; }
        .at-card-field { display: flex; flex-direction: column; gap: 2px; }
        .at-card-field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .at-card-field-value { font-size: 0.85rem; color: var(--text); font-weight: 500; }
        .at-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }
        .at-card-actions .at-btn { flex: 1; justify-content: center; font-size: 0.78rem; padding: 8px; }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .at-cards { display: none !important; }
          .at-table-section { display: block !important; }
          .at-header { padding: 24px 32px; }
          .at-stats { padding: 16px 32px; }
          .at-filter-bar { padding: 12px 32px; }
          .at-form-header, .at-form-body { padding-left: 32px; padding-right: 32px; }
        }

        @media (max-width: 767px) {
          .at-header { padding: 16px; }
          .at-header-title { font-size: 1.15rem; }
          .at-header-sub { font-size: 0.78rem; }
          .at-header-actions { width: 100%; }
          .at-header-actions .at-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
          .at-stats { grid-template-columns: 1fr 1fr; gap: 8px; padding: 12px 16px; }
          .at-stat-value { font-size: 1.1rem; }
          .at-filter-bar { padding: 10px 16px; }
          .at-search-wrap { min-width: 100%; }
          .at-filter-select { min-width: 100%; }
          .at-form-row { grid-template-columns: 1fr; gap: 14px; }
          .at-form-header, .at-form-body { padding-left: 16px; padding-right: 16px; }
          .at-table-section { display: none !important; }
          .at-cards { display: flex !important; } /* FIX: SHOW CARDS ON MOBILE */
          .at-toast { left: 16px; right: 16px; max-width: none; top: 12px; }
        }

        @media (max-width: 380px) {
          .at-header-actions { flex-direction: column; }
          .at-card-grid { grid-template-columns: 1fr; }
        }

        /* ===== SCROLLBAR ===== */
        .at-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .at-root ::-webkit-scrollbar-track { background: transparent; }
        .at-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .at-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }

        /* ===== SPINNER ===== */
        @keyframes atSpin { to { transform: rotate(360deg); } }
        .at-spinner { display: inline-block; width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: atSpin 0.6s linear infinite; }
      `}</style>

      {/* ===== NOTIFICATION TOAST ===== */}
      {notification.show && (
        <div className={`at-toast at-toast-${notification.type}`}>
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0}}>
            {notification.type === 'success' ? <><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></> : <><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></>}
          </svg>
          <span>{notification.message}</span>
          <button className="at-toast-close" onClick={() => setNotification({ show: false, type: '', message: '' })}>×</button>
        </div>
      )}

      {/* ===== PAGE HEADER ===== */}
      <div className="at-header">
        <div className="at-header-top">
          <div>
            <h1 className="at-header-title">Assign Teachers</h1>
            <p className="at-header-sub">Assign teachers to classes &amp; subjects for question setting</p>
          </div>
          <div className="at-header-actions">
            <button className="at-btn at-btn-ghost" onClick={exportAssignmentsCSV} disabled={!assignments.length}
              title={filterClass || filterSubject || searchTeacher ? 'Export filtered assignments' : 'Export all assignments'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
            </button>
            <button className="at-btn at-btn-success" onClick={handleOpenCSVModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className={`at-btn ${showForm ? 'at-btn-ghost' : 'at-btn-primary'}`} onClick={() => showForm ? resetForm() : setShowForm(true)}>
              {showForm ? (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
              ) : (
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              )}
              <span>{showForm ? 'Cancel' : 'New Assignment'}</span>
            </button>
          </div>
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      <div className="at-stats">
        <div className="at-stat">
          <span className="at-stat-value">{assignments.length}</span>
          <span className="at-stat-label">Assignments</span>
        </div>
        <div className="at-stat">
          <span className="at-stat-value">{teachers.length}</span>
          <span className="at-stat-label">Teachers</span>
        </div>
        <div className="at-stat">
          <span className="at-stat-value">{classes.length}</span>
          <span className="at-stat-label">Classes</span>
        </div>
        <div className="at-stat">
          <span className="at-stat-value">{subjects.length}</span>
          <span className="at-stat-label">Subjects</span>
        </div>
      </div>

      {/* ===== FORM PANEL ===== */}
      {showForm && (
        <div className="at-form-panel">
          <div className="at-form-header">
            <h3 className="at-form-title">
              <span className="at-form-title-icon">{editingId ? '✏️' : '➕'}</span>
              {editingId ? 'Edit Assignment' : 'New Assignment'}
            </h3>
          </div>
          <div className="at-form-body">
            <form onSubmit={handleSubmit}>
              <div className="at-form-row">
                <ScrollableSelect
                  id="teacher" options={teacherOptions} value={formData.teacher_id}
                  onChange={(val) => setFormData({ ...formData, teacher_id: val })}
                  placeholder="Select Teacher" label="Teacher" required
                  searchPlaceholder="Search teachers..." noOptionsText="No teachers found" footerLabel="teachers"
                  optionRenderer={(option) => (
                    <div className="at-opt-teacher">
                      <div className="at-opt-avatar" style={{ background: getAvatarColor(option.firstName + option.lastName) }}>
                        {option.firstName.charAt(0)}{option.lastName.charAt(0)}
                      </div>
                      <div className="at-opt-details">
                        <span className="at-opt-name">{option.firstName} {option.lastName}</span>
                        <span className="at-opt-email">{option.email}</span>
                      </div>
                    </div>
                  )}
                />
                <ScrollableSelect
                  id="class" options={classOptions} value={formData.class_id}
                  onChange={(val) => setFormData({ ...formData, class_id: val })}
                  placeholder="Select Class" label="Class" required
                  searchPlaceholder="Search classes..." noOptionsText="No classes found" footerLabel="classes"
                  optionRenderer={(option) => (
                    <div className="at-opt-class">
                      <span className="at-opt-icon">🏫</span>
                      <span className="at-opt-class-name">{option.name}</span>
                      {option.section && <span className="at-opt-class-section">- {option.section}</span>}
                      {option.level && <span className="at-opt-class-level">({option.level})</span>}
                    </div>
                  )}
                />
                <ScrollableSelect
                  id="subject" options={subjectOptions} value={formData.subject_id}
                  onChange={(val) => setFormData({ ...formData, subject_id: val })}
                  placeholder="Select Subject" label="Subject" required
                  searchPlaceholder="Search subjects..." noOptionsText="No subjects found" footerLabel="subjects"
                  optionRenderer={(option) => (
                    <div className="at-opt-subject">
                      <span className="at-opt-icon">📚</span>
                      <span className="at-opt-subject-name">{option.name}</span>
                      <span className="at-opt-subject-code">({option.code})</span>
                    </div>
                  )}
                />
              </div>

              {isDuplicate && (
                <div className="at-form-alert at-form-alert-error">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>This teacher is already assigned to this class and subject combination.</span>
                </div>
              )}

              {selectedTeacherAssignments.length > 0 && (
                <div className="at-form-alert at-form-alert-warning">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <div>
                    <strong>This teacher is already assigned to:</strong>
                    <ul>
                      {selectedTeacherAssignments.slice(0, 3).map((a) => (
                        <li key={a.id}>{a.class_name} — {a.subject_name}</li>
                      ))}
                      {selectedTeacherAssignments.length > 3 && <li>...and {selectedTeacherAssignments.length - 3} more</li>}
                    </ul>
                  </div>
                </div>
              )}

              <div className="at-form-actions">
                <button type="button" className="at-btn at-btn-ghost" onClick={resetForm} disabled={assignmentMutation.isPending}>Cancel</button>
                <button type="submit" className="at-btn at-btn-primary" disabled={assignmentMutation.isPending || isDuplicate || !formData.teacher_id || !formData.class_id || !formData.subject_id}>
                  {assignmentMutation.isPending ? (
                    <><span className="at-spinner"></span> Saving...</>
                  ) : editingId ? 'Update Assignment' : 'Create Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ===== FILTER BAR ===== */}
      <div className="at-filter-bar">
        <div className="at-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="at-search-input" placeholder="Search by teacher name or email..." value={searchTeacher} onChange={(e) => setSearchTeacher(e.target.value)} />
          {searchTeacher && <button className="at-search-clear" onClick={() => setSearchTeacher('')}>×</button>}
        </div>
        <select className="at-filter-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)}>
          <option value="">All Classes</option>
          {classes.map((cls) => (<option key={String(cls._id || cls.id)} value={String(cls._id || cls.id)}>{cls.name} {cls.section ? `- ${cls.section}` : ''}</option>))}
        </select>
        <select className="at-filter-select" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
          <option value="">All Subjects</option>
          {subjects.map((s) => (<option key={String(s._id || s.id)} value={String(s._id || s.id)}>{s.name}</option>))}
        </select>
        {(filterClass || filterSubject || searchTeacher) && (
          <button className="at-btn at-btn-ghost at-btn-sm" onClick={() => { setFilterClass(''); setFilterSubject(''); setSearchTeacher(''); }}>Clear All</button>
        )}
        <span className="at-result-count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
          {getResultText()}
        </span>
      </div>

      {/* ===== DESKTOP TABLE ===== */}
      <div className="at-table-section" style={{ background: 'var(--surface)', minHeight: '200px' }}>
        <div className="at-table-wrap">
          <table className="at-table">
            <thead>
              <tr>
                <th style={{width:44}}>#
                  <span style={{marginLeft: 4, fontSize: '0.65rem', fontWeight: 500, color: 'var(--text-muted)', textTransform: 'none', letterSpacing: 0 }}>{filteredAssignments.length}</span>
                </th>
                <th>Teacher</th>
                <th>Class</th>
                <th>Subject</th>
                <th>Questions</th>
                <th>Date</th>
                <th style={{width:50}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredAssignments.length === 0 ? (
                <tr><td colSpan="7" className="at-empty">
                  <span className="at-empty-icon">📋</span>
                  {assignments.length === 0
                    ? 'No assignments yet. Create your first assignment to get started.'
                    : <>No assignments match your current filters.</>}
                </td></tr>
              ) : filteredAssignments.map((assignment, index) => (
                <tr key={assignment.id}>
                  <td style={{ color: 'var(--text-muted)', fontWeight: 500, fontSize: '0.82rem' }}>{index + 1}</td>
                  <td>
                    <div className="at-teacher-cell">
                      <div className="at-teacher-avatar" style={{ background: getAvatarColor(assignment.teacher_name) }}>
                        {assignment.teacher_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                      </div>
                      <div className="at-teacher-info">
                        <span className="at-teacher-name">{assignment.teacher_name}</span>
                        <span className="at-teacher-email">{assignment.teacher_email}</span>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span className="at-badge at-badge-blue">🏫 {assignment.class_name}</span>
                  </td>
                  <td>
                    <span className="at-badge at-badge-purple">📚 {assignment.subject_name}</span>
                  </td>
                  <td>
                    <div className="at-qc">
                      <span className={`at-qc-value ${(assignment.question_count || 0) > 0 ? 'has' : 'none'}`}>{assignment.question_count || 0}</span>
                      <span className="at-qc-label">questions</span>
                    </div>
                  </td>
                  <td style={{ fontSize: '0.84rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>
                    {assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) : '—'}
                  </td>
                  <td>
                    <div className="at-action-wrap">
                      <button className="at-action-trigger" onClick={(e) => toggleActionMenu(assignment.id, e)}>
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                      </button>
                      {openActionMenu === assignment.id && (
                        <>
                          <div className="at-click-outside" onClick={() => setOpenActionMenu(null)} />
                          <div className="at-action-menu">
                            <button className="at-action-item" onClick={() => { setOpenActionMenu(null); handleEdit(assignment); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Edit Assignment
                            </button>
                            <div className="at-action-sep" />
                            <button className="at-action-item danger" onClick={() => { setOpenActionMenu(null); handleDelete(assignment); }}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                              Remove Assignment
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ===== MOBILE CARDS ===== */}
      <div className="at-cards">
        {filteredAssignments.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📋</span>
            {assignments.length === 0 ? 'No assignments yet. Create your first assignment.' : 'No assignments match your filters.'}
          </div>
        ) : filteredAssignments.map((assignment) => (
          <div className="at-card" key={assignment.id}>
            <div className="at-card-top">
              <div className="at-teacher-avatar" style={{ background: getAvatarColor(assignment.teacher_name), width: 42, height: 42, fontSize: '0.88rem' }}>
                {assignment.teacher_name?.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div className="at-card-name">{assignment.teacher_name}</div>
                <div className="at-card-email">{assignment.teacher_email}</div>
              </div>
            </div>
            <div className="at-card-badges" style={{ marginBottom: 14 }}>
              <span className="at-badge at-badge-blue">🏫 {assignment.class_name}</span>
              <span className="at-badge at-badge-purple">📚 {assignment.subject_name}</span>
            </div>
            <div className="at-card-grid">
              <div className="at-card-field">
                <span className="at-card-field-label">Questions</span>
                <span className="at-card-field-value" style={{ color: (assignment.question_count || 0) > 0 ? 'var(--success)' : 'var(--text-muted)' }}>{assignment.question_count || 0}</span>
              </div>
              <div className="at-card-field">
                <span className="at-card-field-label">Date</span>
                <span className="at-card-field-value">{assignment.created_at ? new Date(assignment.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}</span>
              </div>
            </div>
            <div className="at-card-actions">
              <button className="at-btn at-btn-ghost at-btn-sm" onClick={() => handleEdit(assignment)}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                Edit
              </button>
              <button className="at-btn at-btn-danger at-btn-sm" onClick={() => handleDelete(assignment)} disabled={deleteMutation.isPending}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:14,height:14}}><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                Remove
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* ===== MODAL: CSV IMPORT ===== */}
      {showCSVModal && (
        <div className="at-modal-overlay" onClick={handleCloseCSVModal}>
          <div className="at-modal" onClick={(e) => e.stopPropagation()}>
            <div className="at-modal-handle" />
            <div className="at-modal-header">
              <h3 className="at-modal-title">Bulk Upload Assignments</h3>
              <button className="at-modal-close" onClick={handleCloseCSVModal} disabled={isImporting}>×</button>
            </div>
            <div className="at-modal-body">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>
                  Teacher: name, username or email. Class: "Name,Section" columns OR one combined "Name Section" value. Subject: name or code.
                </span>
                <button type="button" className="at-btn at-btn-ghost at-btn-sm" onClick={downloadAssignmentSampleCSV}>Download Sample</button>
              </div>
              <input type="file" accept=".csv" className="at-file-input" ref={fileInputRef} onChange={handleCSVFileChange} disabled={isImporting} />

              {csvError && (
                <div className="at-form-alert at-form-alert-error" style={{ marginTop: 12 }}>
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{width:16,height:16,flexShrink:0,marginTop:1}}><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>
                  <span>{csvError}</span>
                </div>
              )}

              {parsedAssignments.length > 0 && (
                <div className="at-upload-preview" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr><th>Row</th><th>Teacher</th><th>Class</th><th>Subject</th></tr>
                    </thead>
                    <tbody>
                      {parsedAssignments.map(a => (
                        <tr key={a._rowNumber}>
                          <td>{a._rowNumber}</td>
                          <td>{a._teacherName}</td>
                          <td>{a._classLabel}</td>
                          <td>{a._subjectName}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isImporting && (
                <div style={{ marginTop: 16 }}>
                  <div className="at-progress-bar">
                    <div className="at-progress-fill" style={{ width: `${(importProgress.current / importProgress.total) * 100}%` }} />
                  </div>
                  <p style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontStyle: 'italic', marginTop: 6 }}>
                    Importing {importProgress.current} of {importProgress.total}...
                  </p>
                </div>
              )}

              {importLog.length > 0 && (
                <div className="at-upload-log" style={{ marginTop: 12 }}>
                  {importLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
            <div className="at-modal-footer">
              <button className="at-btn at-btn-ghost" onClick={handleCloseCSVModal} disabled={isImporting}>Close</button>
              <button className="at-btn at-btn-success" onClick={handleImportAssignments} disabled={parsedAssignments.length === 0 || isImporting}>
                {isImporting ? <><span className="at-spinner"></span> Importing...</> : `Import ${parsedAssignments.length} Assignment(s)`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AssignTeachers;