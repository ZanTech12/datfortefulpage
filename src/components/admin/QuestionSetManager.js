import React, { useState, useRef, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { questionSetsAPI, classesAPI, subjectsAPI, dashboardAPI, getUserRole } from '../../api';
import Loading from '../common/Loading';
import QuestionToolbar, { figureStore } from './QuestionToolbar'; // ✅ toolbar + shared figure store

// ==========================================================
// ✨ FIGURE TOKEN SYSTEM
// Textareas hold display text with [FIG:id] tokens; the real
// base64 <img> tags are converted at the boundaries:
//   load (htmlToDisplay) · preview (displayToHtml) · save (displayToHtml)
// ==========================================================
const FIG_TOKEN_RE = /\[FIG:([a-z0-9]+)\]/g;

// stored HTML → display text (base64 <img> → short tokens)
const htmlToDisplay = (html = '') =>
  (html || '').replace(
    /<img[^>]*src="(data:image\/[^"]+)"[^>]*>/gi,
    (match, src) => {
      for (const [id, data] of figureStore.entries()) {
        if (data === src) return ` [FIG:${id}] `;
      }
      const id = 'f' + Math.random().toString(36).slice(2, 10);
      figureStore.set(id, src);
      return ` [FIG:${id}] `;
    }
  );

// display text → stored HTML (tokens → real <img> tags)
const displayToHtml = (display = '') =>
  (display || '').replace(FIG_TOKEN_RE, (token, id) => {
    const src = figureStore.get(id);
    return src
      ? `<img src="${src}" alt="figure" style="max-width:100%;" />`
      : '';
  });

const QuestionSetManager = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const modalBodyRef = useRef(null);
  const questionTextRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [editingSet, setEditingSet] = useState(null);
  const [showScrollBtn, setShowScrollBtn] = useState(false);
  const [copied, setCopied] = useState(false);
  const [inputMethod, setInputMethod] = useState('manual');
  const [currentQuestionIndex, setCurrentQuestionIndex] = useState(0);
  const [formData, setFormData] = useState({
    title: '', classId: '', subjectId: '',
    questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }],
  });
  const [error, setError] = useState('');

  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const userRole = getUserRole();
  const isTeacher = userRole === 'teacher';
  const teacherId = user?._id || user?.id;

  const { data: questionSets, isPending: qsPending } = useQuery({ queryKey: ['questionSets'], queryFn: questionSetsAPI.getAll });
  const { data: classes, isPending: classesPending } = useQuery({ queryKey: ['classes'], queryFn: () => classesAPI.getAll({ limit: 100 }) });
  const { data: subjects, isPending: subjectsPending } = useQuery({ queryKey: ['subjects'], queryFn: subjectsAPI.getAll });

  const { data: allTeacherAssignments } = useQuery({
    queryKey: ['teacherAssignments'], queryFn: dashboardAPI.getTeacherAssignments,
    enabled: !isTeacher && !showModal,
  });

  const { data: myAssignments, isPending: myAssignmentsPending } = useQuery({
    queryKey: ['my-assignments', teacherId],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(teacherId),
    enabled: isTeacher && !!teacherId,
  });

  const { data: classAssignments, isPending: classAssignmentsPending } = useQuery({
    queryKey: ['classAssignments', formData.classId],
    queryFn: () => dashboardAPI.getAssignmentsByClass(formData.classId),
    enabled: !!formData.classId && showModal && !isTeacher,
  });

  const createMutation = useMutation({
    mutationFn: questionSetsAPI.create,
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questionSets'] }); handleCloseModal(); },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create question set'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => questionSetsAPI.update(id, data),
    onSuccess: () => { queryClient.invalidateQueries({ queryKey: ['questionSets'] }); handleCloseModal(); },
    onError: (err) => {
      if (err.response?.status === 403) setError('Authorization failed. Your backend might not be configured to allow teachers to edit sets they are assigned to.');
      else setError(err.response?.data?.message || 'Failed to update question set');
    },
  });

  const deleteMutation = useMutation({
    mutationFn: questionSetsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['questionSets'] }),
    onError: (err) => alert(err.response?.data?.message || 'Failed to delete question set. You might not have permission.'),
  });

  const formatName = (name) => {
    if (!name) return '';
    return name.toLowerCase().split(' ').map(word => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
  };

  const getAssignedTeacher = (classId, subjectId, assignmentsData) => {
    if (!assignmentsData?.data || !classId || !subjectId) return null;
    const classIdStr = classId.toString();
    const subjectIdStr = subjectId.toString();
    return assignmentsData.data.find((a) => {
      const aClassId = (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString();
      const aSubjectId = (a.subject_id?._id || a.subject_id || a.subjectId?._id || a.subjectId)?.toString();
      return aClassId === classIdStr && aSubjectId === subjectIdStr;
    });
  };

  const getTeacherDisplayInfo = (assignment) => {
    if (!assignment) return null;
    return assignment.teacher_name || `${assignment.teacher_id?.firstName || ''} ${assignment.teacher_id?.lastName || ''}`.trim() || null;
  };

  const getInitials = (name) => {
    if (!name) return '';
    return name.split(' ').filter(Boolean).map(w => w[0]).join('').substring(0, 2).toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1','#8b5cf6','#a855f7','#d946ef','#ec4899','#f43f5e','#ef4444','#f97316','#eab308','#22c55e','#14b8a6','#06b6d4','#0ea5e9','#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  // ✨ NEW: mobile-card helpers (resolve names even when API returns plain IDs)
  const formatDate = (d) =>
    d ? new Date(d).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' }) : '—';

  const getClassInfo = (qs) => {
    if (qs.classId?.name) return qs.classId;
    const id = qs.classId?.toString();
    return (id && (classes?.data || []).find(c => (c._id || c.id)?.toString() === id)) || null;
  };

  const getSubjectInfo = (qs) => {
    if (qs.subjectId?.name) return qs.subjectId;
    const id = qs.subjectId?.toString();
    return (id && (subjects?.data || []).find(s => (s._id || s.id)?.toString() === id)) || null;
  };

  // ✨ NEW: difficulty breakdown for the admin table column
  const getDiffBreakdown = (questions = []) => {
    const d = { easy: 0, medium: 0, hard: 0 };
    questions.forEach(q => { if (d[q.difficulty] != null) d[q.difficulty]++; });
    return d;
  };

  const availableClasses = useMemo(() => {
    if (!classes?.data) return [];
    if (!isTeacher) return classes.data;
    if (!myAssignments?.data) return [];
    const ids = new Set(myAssignments.data.map(a => (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString()).filter(Boolean));
    return classes.data.filter(c => ids.has((c._id || c.id)?.toString()));
  }, [isTeacher, classes?.data, myAssignments?.data]);

  const availableSubjects = useMemo(() => {
    if (!subjects?.data) return [];
    if (isTeacher) {
      if (!formData.classId || !myAssignments?.data) return [];
      return subjects.data.filter(sub =>
        myAssignments.data.some(a => {
          const aC = (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString();
          const aS = (a.subject_id?._id || a.subject_id || a.subjectId?._id || a.subjectId)?.toString();
          return aC === formData.classId?.toString() && aS === (sub._id || sub.id)?.toString();
        })
      );
    }
    return subjects.data;
  }, [isTeacher, formData.classId, subjects?.data, myAssignments?.data]);

  const filteredQuestionSets = useMemo(() => {
    if (!questionSets?.data) return [];
    if (!isTeacher) return questionSets.data;
    if (!myAssignments?.data) return [];
    const pairs = myAssignments.data.map(a => ({
      classId: (a.class_id?._id || a.class_id || a.classId?._id || a.classId)?.toString(),
      subjectId: (a.subject_id?._id || a.subject_id || a.subjectId?._id || a.subjectId)?.toString(),
    })).filter(p => p.classId && p.subjectId);
    return questionSets.data.filter(qs => {
      const qC = (qs.classId?._id || qs.classId)?.toString();
      const qS = (qs.subjectId?._id || qs.subjectId)?.toString();
      return pairs.some(p => p.classId === qC && p.subjectId === qS);
    });
  }, [isTeacher, questionSets?.data, myAssignments?.data]);

  // ✨ NEW: stat-bar totals
  const totalQuestions = useMemo(() => filteredQuestionSets.reduce((sum, qs) => sum + (qs.questions?.length || 0), 0), [filteredQuestionSets]);
  const coveredSubjects = useMemo(() => new Set(filteredQuestionSets.map(qs => (qs.subjectId?._id || qs.subjectId)?.toString()).filter(Boolean)).size, [filteredQuestionSets]);
  const coveredClasses = useMemo(() => new Set(filteredQuestionSets.map(qs => (qs.classId?._id || qs.classId)?.toString()).filter(Boolean)).size, [filteredQuestionSets]);

  const currentAssignedTeacher = !isTeacher && formData.classId && formData.subjectId
    ? getAssignedTeacher(formData.classId, formData.subjectId, classAssignments) : null;
  const currentTeacherInfo = getTeacherDisplayInfo(currentAssignedTeacher);

  const sampleJSON = `[
  {
    "questionText": "In the figure, find <b>x</b> <img src=\\"/uploads/questions/fig1.png\\">",
    "options": ["30°", "45°", "60°", "90°"],
    "correctAnswer": 1,
    "difficulty": "medium",
    "explanation": "Angles in a triangle sum to 180°."
  }
]`;

  const handleCopyJSON = () => { navigator.clipboard.writeText(sampleJSON); setCopied(true); setTimeout(() => setCopied(false), 2000); };
  const handleScroll = (e) => { const { scrollTop, scrollHeight, clientHeight } = e.target; setShowScrollBtn(scrollHeight - (scrollTop + clientHeight) >= 100); };
  const scrollToBottom = () => { modalBodyRef.current?.scrollTo({ top: modalBodyRef.current.scrollHeight, behavior: 'smooth' }); };

  const handleChange = (e) => {
    const { name, value } = e.target;
    if (name === 'classId') setFormData(prev => ({ ...prev, classId: value, subjectId: '' }));
    else setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const handleQuestionChange = (field, value) => {
    const uq = [...formData.questions];
    uq[currentQuestionIndex][field] = value;
    setFormData({ ...formData, questions: uq });
  };

  const handleOptionChange = (i, v) => {
    const uq = [...formData.questions];
    uq[currentQuestionIndex].options[i] = v;
    setFormData({ ...formData, questions: uq });
  };

  const handleSetCorrect = (i) => {
    const uq = [...formData.questions];
    uq[currentQuestionIndex] = { ...uq[currentQuestionIndex], correctAnswer: i };
    setFormData({ ...formData, questions: uq });
  };

  const handleAddOption = () => {
    const uq = [...formData.questions];
    if (uq[currentQuestionIndex].options.length >= 8) return;
    uq[currentQuestionIndex].options.push('');
    setFormData({ ...formData, questions: uq });
  };

  const handleRemoveOption = (idx) => {
    const uq = [...formData.questions];
    const opts = uq[currentQuestionIndex].options;
    if (opts.length <= 2) return;
    const correctText = opts[uq[currentQuestionIndex].correctAnswer];
    opts.splice(idx, 1);
    let nc = opts.indexOf(correctText);
    if (nc === -1) nc = 0;
    uq[currentQuestionIndex].correctAnswer = nc;
    setFormData({ ...formData, questions: uq });
  };

  const handleDuplicateQuestion = () => {
    const uq = [...formData.questions];
    uq.splice(currentQuestionIndex + 1, 0, JSON.parse(JSON.stringify(uq[currentQuestionIndex])));
    setFormData({ ...formData, questions: uq });
    setCurrentQuestionIndex(p => p + 1);
  };

  const handleShuffleOptions = () => {
    const uq = [...formData.questions];
    const q = { ...uq[currentQuestionIndex] };
    const oc = [...q.options];
    const ct = oc[q.correctAnswer];
    for (let i = oc.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [oc[i], oc[j]] = [oc[j], oc[i]]; }
    q.options = oc;
    q.correctAnswer = oc.indexOf(ct);
    if (q.correctAnswer === -1) q.correctAnswer = 0;
    uq[currentQuestionIndex] = q;
    setFormData({ ...formData, questions: uq });
  };

  const handleNext = () => {
    if (currentQuestionIndex < formData.questions.length - 1) setCurrentQuestionIndex(p => p + 1);
    else {
      setFormData(prev => ({ ...prev, questions: [...prev.questions, { questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] }));
      setCurrentQuestionIndex(p => p + 1);
      setTimeout(scrollToBottom, 100);
    }
  };

  const handlePrev = () => {
    if (currentQuestionIndex > 0) { setCurrentQuestionIndex(p => p - 1); modalBodyRef.current?.scrollTo({ top: 0, behavior: 'smooth' }); }
  };

  const removeQuestion = () => {
    if (formData.questions.length <= 1) return;
    const uq = formData.questions.filter((_, i) => i !== currentQuestionIndex);
    setFormData({ ...formData, questions: uq });
    if (currentQuestionIndex >= uq.length) setCurrentQuestionIndex(uq.length - 1);
  };

  const handleFileUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        let pq = [];
        const text = ev.target.result;
        if (file.name.endsWith('.json')) {
          const json = JSON.parse(text);
          if (!Array.isArray(json)) throw new Error("JSON must be an array.");
          pq = json.map(q => ({ questionText: q.questionText || '', options: Array.isArray(q.options) ? q.options : ['', ''], correctAnswer: parseInt(q.correctAnswer) || 0, difficulty: ['easy', 'medium', 'hard'].includes(q.difficulty) ? q.difficulty : 'medium', explanation: q.explanation || '' }));
        } else if (file.name.endsWith('.csv')) {
          const lines = text.split('\n').filter(l => l.trim());
          if (lines.length < 2) throw new Error("CSV is empty.");
          for (let i = 1; i < lines.length; i++) {
            const c = lines[i].split(',').map(x => x.trim());
            if (c.length >= 6) pq.push({ questionText: c[0], options: [c[1]||'',c[2]||'',c[3]||'',c[4]||''].filter(Boolean), correctAnswer: parseInt(c[5])||0, difficulty: ['easy','medium','hard'].includes(c[6])?c[6]:'medium', explanation: c[7]||'' });
          }
        } else throw new Error("Invalid file type. Use .json or .csv");
        if (!pq.length) throw new Error("No valid questions found.");
        setFormData(prev => ({ ...prev, questions: pq }));
        setCurrentQuestionIndex(0); setError(''); setInputMethod('manual');
      } catch (err) { setError(`Upload failed: ${err.message}`); }
      finally { e.target.value = ''; }
    };
    reader.readAsText(file);
  };

  const handleExportJSON = () => {
    const exportable = formData.questions.map(q => ({ ...q, questionText: displayToHtml(q.questionText) }));
    const blob = new Blob([JSON.stringify(exportable, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${formData.title || 'question-set'}.json`;
    document.body.appendChild(a); a.click(); URL.revokeObjectURL(url); document.body.removeChild(a);
  };

  const handleOpenCreate = () => {
    setEditingSet(null);
    setFormData({ title: '', classId: '', subjectId: '', questions: [{ questionText: '', options: ['', ''], correctAnswer: 0, difficulty: 'medium', explanation: '' }] });
    setCurrentQuestionIndex(0); setInputMethod('manual'); setError(''); setShowModal(true); setShowScrollBtn(false); setCopied(false);
  };

  const handleOpenEdit = (qs) => {
    setEditingSet(qs);
    setFormData({
      title: qs.title||'',
      classId: qs.classId?._id || qs.classId || '',
      subjectId: qs.subjectId?._id || qs.subjectId || '',
      questions: (qs.questions?.length ? qs.questions : [{ questionText:'', options:['',''], correctAnswer:0, difficulty:'medium', explanation:'' }])
        .map(q => ({ ...q, questionText: htmlToDisplay(q.questionText) })),
    });
    setCurrentQuestionIndex(0); setInputMethod('manual'); setError(''); setShowModal(true); setShowScrollBtn(false); setCopied(false);
  };

  const handleCloseModal = () => { setShowModal(false); setEditingSet(null); setError(''); };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    const vq = formData.questions
      .filter(q => q.questionText.trim() && q.options.filter(o => o.trim()).length >= 2)
      .map(q => ({ ...q, questionText: displayToHtml(q.questionText) }));
    if (!vq.length) { setError('Add at least one question with text and 2+ options'); return; }
    const data = { ...formData, questions: vq };
    if (editingSet) updateMutation.mutate({ id: editingSet._id || editingSet.id, data });
    else createMutation.mutate(data);
  };

  const handleDelete = (qs) => { if (window.confirm(`Delete "${qs.title}"?`)) deleteMutation.mutate(qs._id || qs.id); };

  const isLoading = qsPending || classesPending || subjectsPending || (isTeacher && myAssignmentsPending);
  if (isLoading) return <Loading message="Loading question sets..." />;

  const isSaving = createMutation.isPending || updateMutation.isPending;
  const cq = formData.questions[currentQuestionIndex];
  const isLast = currentQuestionIndex === formData.questions.length - 1;
  const colSpan = isTeacher ? 4 : 7;

  return (
    <div className="qs-root">
      <style>{`
        .qs-root {
          --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8;
          --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --primary-50: #eef2ff;
          --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5;
          --warning: #f59e0b; --warning-light: #fffbeb; --amber: #f59e0b;
          --radius: 14px; --radius-sm: 10px; --radius-xs: 6px;
          --shadow-xs: 0 1px 2px rgba(0,0,0,0.04);
          --shadow-sm: 0 1px 3px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow: 0 2px 8px rgba(0,0,0,0.06), 0 1px 2px rgba(0,0,0,0.04);
          --shadow-md: 0 4px 12px rgba(0,0,0,0.07), 0 2px 4px rgba(0,0,0,0.04);
          --shadow-lg: 0 12px 24px rgba(0,0,0,0.08), 0 4px 8px rgba(0,0,0,0.04);
          --shadow-xl: 0 20px 40px rgba(0,0,0,0.1), 0 8px 16px rgba(0,0,0,0.06);
          --transition: 180ms cubic-bezier(0.4, 0, 0.2, 1);
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
          color: var(--text); -webkit-font-smoothing: antialiased; background: var(--bg); min-height: 100vh;
        }

        /* ===== HEADER ===== */
        .qs-header {
          background: var(--surface); border-bottom: 1px solid var(--border);
          padding: 20px 24px; position: sticky; top: 0; z-index: 30;
        }
        .qs-header::after {
          content: ''; position: absolute; bottom: -1px; left: 24px; right: 24px; height: 1px;
          background: linear-gradient(90deg, transparent, var(--primary) 20%, var(--primary) 80%, transparent);
          opacity: 0.15;
        }
        .qs-header-inner { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .qs-header-left { display: flex; align-items: center; gap: 16px; }
        .qs-header-icon {
          width: 48px; height: 48px; border-radius: 14px; flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex; align-items: center; justify-content: center; color: #fff;
          box-shadow: 0 4px 12px rgba(79, 70, 229, 0.3);
        }
        .qs-header-title { font-size: 1.4rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.03em; }
        .qs-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; font-weight: 500; }
        /* ✨ NEW: header actions container (replaces the inline-styled div) */
        .qs-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }

        /* ===== BUTTONS ===== */
        .qs-btn {
          display: inline-flex; align-items: center; gap: 7px; padding: 10px 18px; border-radius: var(--radius-sm);
          font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer;
          transition: all var(--transition); white-space: nowrap; line-height: 1.4; font-family: inherit;
          position: relative; overflow: hidden;
        }
        .qs-btn::after { content: ''; position: absolute; inset: 0; background: linear-gradient(180deg, rgba(255,255,255,0.12) 0%, transparent 60%); pointer-events: none; }
        .qs-btn:active { transform: scale(0.97); }
        .qs-btn:disabled { opacity: 0.45; cursor: not-allowed; transform: none !important; }
        .qs-btn svg { width: 15px; height: 15px; flex-shrink: 0; }
        .qs-btn-primary {
          background: linear-gradient(135deg, var(--primary) 0%, #6d28d9 100%);
          color: #fff; box-shadow: 0 2px 8px rgba(79,70,229,0.3);
        }
        .qs-btn-primary:hover { box-shadow: 0 4px 16px rgba(79,70,229,0.4); transform: translateY(-1px); }
        .qs-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .qs-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; box-shadow: var(--shadow-xs); }
        .qs-btn-danger-outline { background: var(--surface); color: var(--danger); border: 1px solid #fecaca; }
        .qs-btn-danger-outline:hover { background: #fef2f2; border-color: #fca5a5; }
        .qs-btn-danger {
          background: linear-gradient(135deg, #ef4444 0%, #dc2626 100%);
          color: #fff; box-shadow: 0 2px 8px rgba(239,68,68,0.25);
        }
        .qs-btn-danger:hover { box-shadow: 0 4px 16px rgba(239,68,68,0.35); transform: translateY(-1px); }
        .qs-btn-sm { padding: 7px 13px; font-size: 0.78rem; border-radius: var(--radius-xs); }
        .qs-btn-sm svg { width: 13px; height: 13px; }
        .qs-btn-spinner { width: 14px; height: 14px; border: 2px solid rgba(255,255,255,0.3); border-top-color: #fff; border-radius: 50%; animation: qsSpin 0.6s linear infinite; flex-shrink: 0; }
        @keyframes qsSpin { to { transform: rotate(360deg); } }

        /* ===== BADGES ===== */
        .qs-badge {
          display: inline-flex; align-items: center; gap: 5px; padding: 4px 11px; border-radius: 20px;
          font-size: 0.72rem; font-weight: 600; white-space: nowrap; letter-spacing: 0.01em;
        }
        .qs-badge-indigo { background: var(--primary-light); color: #4338ca; }
        .qs-badge-green { background: #dcfce7; color: #166534; }
        .qs-badge-amber { background: #fef3c7; color: #92400e; }
        .qs-badge-dot { width: 6px; height: 6px; border-radius: 50%; flex-shrink: 0; }
        /* ✨ NEW: the dots rendered invisible before — give them their colors */
        .qs-badge-indigo .qs-badge-dot { background: var(--primary); }
        .qs-badge-green .qs-badge-dot { background: var(--success); }
        .qs-badge-amber .qs-badge-dot { background: var(--warning); }

        /* ===== LOCKED ===== */
        .qs-locked {
          background: var(--surface); border: 1px solid #fde68a; border-radius: var(--radius);
          padding: 40px 24px; text-align: center; margin: 16px 24px;
        }
        .qs-locked-icon { width: 56px; height: 56px; border-radius: 50%; background: #fef3c7; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; }
        .qs-locked h3 { font-size: 1.05rem; font-weight: 700; color: #92400e; margin: 0 0 6px; }
        .qs-locked p { font-size: 0.88rem; color: #b45309; margin: 0; line-height: 1.5; max-width: 360px; margin-left: auto; margin-right: auto; }

        /* ===== STATS BAR ===== */
        .qs-stats {
          display: flex; gap: 12px; padding: 14px 24px; background: var(--bg);
          border-bottom: 1px solid var(--border); overflow-x: auto;
        }
        .qs-stat-chip {
          display: inline-flex; align-items: center; gap: 8px; padding: 8px 14px;
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm);
          font-size: 0.82rem; color: var(--text-secondary); font-weight: 500; white-space: nowrap;
        }
        .qs-stat-chip strong { color: var(--text); font-weight: 700; font-variant-numeric: tabular-nums; }
        .qs-stat-chip svg { width: 15px; height: 15px; color: var(--text-muted); flex-shrink: 0; }

        /* ===== TABLE ===== */
        .qs-table-section { background: var(--surface); min-height: 200px; }
        .qs-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .qs-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 720px; }
        .qs-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .qs-table th {
          padding: 13px 18px; text-align: left; font-weight: 600; font-size: 0.72rem;
          text-transform: uppercase; letter-spacing: 0.06em; color: var(--text-muted);
          border-bottom: 1px solid var(--border); white-space: nowrap;
        }
        .qs-table td { padding: 16px 18px; border-bottom: 1px solid #f1f5f9; vertical-align: middle; }
        .qs-table tbody tr { transition: background var(--transition); animation: qsRowIn 0.35s ease both; }
        .qs-table tbody tr:hover { background: #fafaff; }
        .qs-table tbody tr:last-child td { border-bottom: none; }
        @keyframes qsRowIn { from { opacity: 0; transform: translateY(8px); } to { opacity: 1; transform: translateY(0); } }
        .qs-empty { text-align: center; padding: 56px 24px; color: var(--text-muted); }
        .qs-table-actions { display: flex; gap: 6px; }

        /* ===== MOBILE CARDS ===== */
        .qs-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .qs-card {
          background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius);
          padding: 18px; transition: all var(--transition); animation: qsRowIn 0.35s ease both;
          position: relative; overflow: hidden;
        }
        .qs-card::before {
          content: ''; position: absolute; top: 0; left: 0; right: 0; height: 3px;
          background: linear-gradient(90deg, var(--primary), #7c3aed); opacity: 0.6;
        }
        .qs-card-top { display: flex; align-items: flex-start; justify-content: space-between; gap: 10px; margin-bottom: 14px; }
        .qs-card-title { font-weight: 700; font-size: 0.98rem; color: var(--text); line-height: 1.3; }
        /* ✨ NEW: card subtitle + icon */
        .qs-card-sub { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-top: 2px; }
        .qs-card-ico {
          width: 38px; height: 38px; border-radius: var(--radius-sm); flex-shrink: 0;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          display: flex; align-items: center; justify-content: center; color: #fff;
        }
        .qs-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px; margin-bottom: 16px; }
        .qs-card-field { display: flex; flex-direction: column; gap: 3px; }
        .qs-card-field-label { font-size: 0.68rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); }
        .qs-card-field-value { font-size: 0.86rem; color: var(--text); font-weight: 500; }
        .qs-card-actions { display: flex; gap: 8px; padding-top: 14px; border-top: 1px solid var(--border); }
        .qs-card-actions .qs-btn { flex: 1; justify-content: center; }

        /* ===== MODAL ===== */
        .qs-modal-overlay {
          position: fixed; inset: 0; background: rgba(15,23,42,0.55); backdrop-filter: blur(6px);
          z-index: 100; display: flex; align-items: center; justify-content: center;
          animation: qsFadeIn 0.2s ease;
        }
        @keyframes qsFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .qs-modal {
          background: var(--surface); border-radius: 20px; width: 100%; max-width: 1040px;
          max-height: 92vh; overflow: hidden; display: flex; flex-direction: column;
          box-shadow: var(--shadow-xl); animation: qsModalIn 0.35s cubic-bezier(0.16, 1, 0.3, 1);
        }
        @keyframes qsModalIn { from { opacity: 0; transform: scale(0.95) translateY(16px); } to { opacity: 1; transform: scale(1) translateY(0); } }
        .qs-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; }
        .qs-modal-header {
          display: flex; align-items: center; justify-content: space-between;
          padding: 20px 28px; border-bottom: 1px solid var(--border); background: var(--surface); flex-shrink: 0;
        }
        .qs-modal-title { font-size: 1.2rem; font-weight: 800; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .qs-modal-close {
          width: 34px; height: 34px; border-radius: 50%; border: none; background: #f1f5f9;
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          color: var(--text-muted); font-size: 1.3rem; transition: all var(--transition);
        }
        .qs-modal-close:hover { background: #e2e8f0; color: var(--text); transform: rotate(90deg); }
        .qs-modal-body { flex: 1; overflow-y: auto; padding: 24px 28px; }
        .qs-modal-footer {
          display: flex; gap: 10px; padding: 16px 28px; border-top: 1px solid var(--border);
          background: var(--surface); justify-content: flex-end; flex-wrap: wrap; flex-shrink: 0;
        }

        /* ===== ALERTS ===== */
        .qs-alert {
          padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500;
          display: flex; align-items: center; gap: 10px; margin-bottom: 20px;
          animation: qsSlideDown 0.3s cubic-bezier(0.16,1,0.3,1);
        }
        .qs-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        @keyframes qsSlideDown { from { opacity: 0; transform: translateY(-10px); } to { opacity: 1; transform: translateY(0); } }

        /* ===== METHOD TABS ===== */
        .qs-method-tabs {
          display: flex; gap: 2px; background: #e2e8f0; border-radius: var(--radius-sm); padding: 3px;
          width: fit-content; margin-bottom: 24px; box-shadow: inset 0 1px 2px rgba(0,0,0,0.06);
        }
        .qs-method-tab {
          display: inline-flex; align-items: center; gap: 7px; padding: 9px 20px; border-radius: 7px;
          border: none; background: none; font-size: 0.84rem; font-weight: 600;
          color: var(--text-muted); cursor: pointer; transition: all var(--transition); font-family: inherit;
        }
        .qs-method-tab:hover { color: var(--text-secondary); }
        .qs-method-tab--active {
          background: var(--surface); color: var(--text); box-shadow: var(--shadow-sm), 0 0 0 1px rgba(0,0,0,0.04);
        }

        /* ===== FORM ===== */
        .qs-form-row { display: grid; grid-template-columns: repeat(3, 1fr); gap: 16px; margin-bottom: 20px; }
        .qs-form-group { display: flex; flex-direction: column; gap: 6px; }
        .qs-form-label { font-size: 0.78rem; font-weight: 700; color: var(--text-secondary); letter-spacing: 0.01em; }
        .qs-form-input, .qs-form-select, .qs-form-textarea {
          width: 100%; padding: 11px 14px; border-radius: var(--radius-sm);
          border: 1.5px solid var(--border); background: var(--surface); font-size: 0.88rem;
          color: var(--text); outline: none;
          transition: border-color var(--transition), box-shadow var(--transition);
          box-sizing: border-box; -webkit-appearance: none; appearance: none; font-family: inherit;
        }
        .qs-form-input::placeholder, .qs-form-textarea::placeholder { color: var(--text-muted); }
        .qs-form-input:focus, .qs-form-select:focus, .qs-form-textarea:focus {
          border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.1);
        }
        .qs-form-select {
          background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
          background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; cursor: pointer;
        }
        .qs-form-select option { color: var(--text); background: var(--surface); }
        .qs-form-textarea { resize: vertical; min-height: 80px; line-height: 1.6; }

        /* ═══ ✨ EDITOR LAYOUT — navigator rail + zones ═══ */
        .qs-editor-layout {
          display: grid;
          grid-template-columns: 216px 1fr;
          gap: 18px;
          align-items: start;
        }
        .qs-rail {
          position: sticky;
          top: 0;
          background: linear-gradient(180deg, #f8fafc, #f1f5f9);
          border: 1px solid var(--border);
          border-radius: var(--radius);
          padding: 14px 12px;
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .qs-rail__title {
          font-size: 0.62rem; font-weight: 800; letter-spacing: 0.14em;
          text-transform: uppercase; color: var(--text-muted);
          display: flex; align-items: center; justify-content: space-between;
        }
        .qs-rail__grid {
          display: grid; grid-template-columns: repeat(4, 1fr);
          gap: 6px; max-height: 280px; overflow-y: auto; padding: 2px;
        }
        .qs-rail-chip {
          position: relative;
          aspect-ratio: 1; border-radius: 9px;
          border: 1.5px solid var(--border); background: var(--surface);
          font-size: 0.72rem; font-weight: 700; color: var(--text-muted);
          cursor: pointer; display: flex; align-items: center; justify-content: center;
          transition: all var(--transition); font-family: inherit;
        }
        .qs-rail-chip:hover { border-color: var(--primary); color: var(--primary); transform: translateY(-1px); }
        .qs-rail-chip--filled { border-color: #a7f3d0; background: #ecfdf5; color: #059669; }
        .qs-rail-chip--current {
          background: linear-gradient(135deg, var(--primary), #7c3aed);
          color: #fff; border-color: transparent;
          box-shadow: 0 3px 12px rgba(79,70,229,0.4);
          transform: scale(1.06);
        }
        .qs-rail-chip__dot {
          position: absolute; bottom: 4px; right: 4px;
          width: 6px; height: 6px; border-radius: 50%;
          background: #cbd5e1;
        }
        .qs-rail-chip--filled .qs-rail-chip__dot { background: #10b981; box-shadow: 0 0 5px #34d399; }
        .qs-rail-chip--current .qs-rail-chip__dot { background: #fff; }
        .qs-rail__legend { font-size: 0.62rem; color: var(--text-muted); line-height: 1.7; }

        /* ── Editor zones ── */
        .qs-zone {
          background: var(--surface); border: 1.5px solid var(--border);
          border-radius: var(--radius); padding: 18px 20px;
          transition: border-color var(--transition), box-shadow var(--transition);
        }
        .qs-zone:focus-within {
          border-color: var(--primary);
          box-shadow: 0 0 0 3px rgba(79,70,229,0.07);
        }
        .qs-zone + .qs-zone { margin-top: 16px; }
        .qs-zone-head { display: flex; align-items: center; gap: 10px; margin-bottom: 14px; flex-wrap: wrap; }
        .qs-zone-num {
          width: 24px; height: 24px; border-radius: 7px; flex-shrink: 0;
          background: var(--primary-light); color: var(--primary);
          display: flex; align-items: center; justify-content: center;
          font-size: 0.72rem; font-weight: 800;
        }
        .qs-zone-title {
          font-size: 0.8rem; font-weight: 800; color: var(--text);
          letter-spacing: 0.04em; text-transform: uppercase;
        }
        .qs-zone-hint { margin-left: auto; font-size: 0.68rem; color: var(--text-muted); font-weight: 500; }

        /* ── Sticky editor footer ── */
        .qs-editor-footer {
          position: sticky; bottom: -24px; margin: 16px -28px -24px;
          padding: 13px 28px; background: var(--surface);
          border-top: 1px solid var(--border);
          display: flex; justify-content: space-between; align-items: center; gap: 10px;
          z-index: 5; box-shadow: 0 -4px 16px rgba(0,0,0,0.04);
        }

        /* ✅ FORMATTING TOOLBAR */
        .qs-toolbar {
          display: flex; align-items: center; gap: 6px; flex-wrap: wrap;
          padding: 7px 9px; border-radius: var(--radius-sm); border: 1px solid var(--border);
          background: linear-gradient(135deg, #f8fafc, #f1f5f9); margin-bottom: 8px;
        }
        .qs-toolbar-btn {
          min-width: 32px; padding: 4px 9px; border-radius: var(--radius-xs);
          border: 1px solid var(--border); background: var(--surface);
          font-size: 0.82rem; font-weight: 700; color: var(--text-secondary);
          cursor: pointer; transition: all var(--transition); font-family: inherit;
          display: inline-flex; align-items: center; justify-content: center;
        }
        .qs-toolbar-btn:hover { background: var(--primary-light); border-color: var(--primary); color: var(--primary); }
        .qs-toolbar-btn:active { transform: scale(0.95); }
        .qs-toolbar-btn:disabled { opacity: 0.5; cursor: not-allowed; }

        /* ✅ live preview panel — figures render as real images here */
        .qs-preview {
          margin-top: 8px; padding: 12px 16px; border-radius: var(--radius-sm);
          background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          border: 1px dashed var(--border); font-size: 0.88rem; color: var(--text);
          line-height: 1.7;
        }
        .qs-preview img { max-width: 100%; height: auto; border-radius: 8px; margin: 6px 0; }
        .qs-preview-label {
          font-size: 0.6rem; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase;
          color: var(--text-muted); display: block; margin-bottom: 6px;
        }

        /* ===== TEACHER INFO ===== */
        .qs-teacher-bar {
          display: flex; align-items: center; gap: 14px; padding: 14px 18px;
          border-radius: var(--radius-sm); margin-bottom: 20px;
        }
        .qs-teacher-bar--ok { background: linear-gradient(135deg, #eef2ff 0%, #e0e7ff 100%); border: 1px solid #c7d2fe; }
        .qs-teacher-bar--warn { background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%); border: 1px solid #fde68a; }
        .qs-teacher-avatar {
          width: 40px; height: 40px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          color: #fff; font-weight: 700; font-size: 0.82rem; flex-shrink: 0;
          box-shadow: 0 2px 8px rgba(0,0,0,0.12);
        }
        .qs-teacher-name { font-size: 0.9rem; font-weight: 700; }
        .qs-teacher-bar--ok .qs-teacher-name { color: #312e81; }
        .qs-teacher-bar--warn .qs-teacher-name { color: #92400e; }
        .qs-teacher-sub { font-size: 0.76rem; font-weight: 500; }
        .qs-teacher-bar--ok .qs-teacher-sub { color: var(--primary); }
        .qs-teacher-bar--warn .qs-teacher-sub { color: #b45309; }

        /* ===== OPTIONS ===== */
        .qs-opt-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 10px; }
        .qs-opt {
          display: flex; align-items: center; gap: 12px; padding: 12px 14px;
          border: 1.5px solid var(--border); border-radius: var(--radius-sm);
          background: var(--surface); transition: all var(--transition);
        }
        .qs-opt--correct {
          border-color: var(--primary); background: linear-gradient(135deg, var(--primary-50) 0%, #e0e7ff 100%);
          box-shadow: 0 0 0 3px rgba(79,70,229,0.06);
        }
        .qs-opt-letter {
          width: 28px; height: 28px; border-radius: 8px; background: #f1f5f9;
          display: flex; align-items: center; justify-content: center;
          font-size: 0.76rem; font-weight: 700; color: var(--text-muted); flex-shrink: 0;
          transition: all var(--transition);
        }
        .qs-opt--correct .qs-opt-letter {
          background: var(--primary); color: #fff;
          box-shadow: 0 2px 6px rgba(79,70,229,0.3);
        }
        .qs-opt-input {
          flex: 1; border: none; outline: none; font-size: 0.88rem;
          background: transparent; color: var(--text); font-family: inherit;
        }
        .qs-opt-input::placeholder { color: var(--text-muted); }
        .qs-opt-remove {
          background: none; border: none; color: var(--text-muted); cursor: pointer;
          font-size: 1.3rem; line-height: 1; padding: 0; transition: all var(--transition);
          width: 24px; height: 24px; border-radius: 6px; display: flex; align-items: center; justify-content: center;
          flex-shrink: 0;
        }
        .qs-opt-remove:hover { color: var(--danger); background: #fef2f2; }
        .qs-opt--selectable { cursor: pointer; }
        .qs-opt__check {
          width: 18px; height: 18px; border-radius: 50%;
          border: 2px solid var(--border); flex-shrink: 0;
          display: flex; align-items: center; justify-content: center;
          transition: all var(--transition); font-size: 0.6rem; color: #fff;
        }
        .qs-opt--correct .qs-opt__check { border-color: var(--primary); background: var(--primary); }
        .qs-opt--correct .qs-opt__check::after { content: '✓'; font-weight: 900; }

        /* ===== DIFFICULTY ===== */
        .qs-diff-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }

        /* ===== NAV LABEL ===== */
        .qs-nav-label {
          font-size: 0.86rem; font-weight: 600; color: var(--text-muted);
          background: #f1f5f9; padding: 6px 16px; border-radius: 20px;
        }

        /* ===== SCROLL BTN ===== */
        .qs-scroll-btn {
          position: sticky; bottom: 24px; float: right; clear: both; margin-right: 12px;
          width: 46px; height: 46px; border-radius: 50%; border: none;
          background: linear-gradient(135deg, var(--primary) 0%, #7c3aed 100%);
          color: #fff; box-shadow: 0 4px 16px rgba(79,70,229,0.4); cursor: pointer;
          display: flex; align-items: center; justify-content: center;
          transition: all 0.3s ease; opacity: 0; visibility: hidden; transform: translateY(16px); z-index: 50;
        }
        .qs-scroll-btn--vis { opacity: 1; visibility: visible; transform: translateY(0); }
        .qs-scroll-btn:hover { box-shadow: 0 6px 24px rgba(79,70,229,0.5); transform: translateY(-2px); }
        .qs-scroll-btn svg { width: 20px; height: 20px; }

        /* ===== UPLOAD ===== */
        .qs-upload-zone {
          border: 2px dashed #cbd5e1; border-radius: var(--radius); padding: 48px 24px;
          text-align: center; cursor: pointer; background: linear-gradient(135deg, #f8fafc 0%, #f1f5f9 100%);
          transition: all 0.25s ease;
        }
        .qs-upload-zone:hover { border-color: var(--primary); background: linear-gradient(135deg, var(--primary-50) 0%, #e0e7ff 100%); }
        .qs-upload-icon-wrap {
          width: 64px; height: 64px; border-radius: 50%; background: var(--primary-light);
          display: flex; align-items: center; justify-content: center; margin: 0 auto 16px;
          transition: all 0.25s ease;
        }
        .qs-upload-zone:hover .qs-upload-icon-wrap { background: var(--primary); box-shadow: 0 4px 16px rgba(79,70,229,0.3); }
        .qs-upload-zone:hover .qs-upload-icon-wrap svg { color: #fff; }
        .qs-upload-icon-wrap svg { width: 28px; height: 28px; color: var(--primary); transition: color 0.25s ease; }
        .qs-upload-title { margin: 0; font-weight: 700; font-size: 0.95rem; color: var(--text); }
        .qs-upload-sub { margin: 6px 0 0; font-size: 0.84rem; color: var(--text-muted); }

        /* ===== CODE BLOCK ===== */
        .qs-code-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; }
        .qs-code-label { font-size: 0.88rem; font-weight: 700; color: var(--text); }
        .qs-copy-btn {
          display: inline-flex; align-items: center; gap: 5px; padding: 5px 12px;
          border-radius: var(--radius-xs); border: 1px solid var(--border); background: var(--surface);
          color: var(--text-secondary); cursor: pointer; font-size: 0.76rem; font-weight: 600;
          transition: all var(--transition); font-family: inherit;
        }
        .qs-copy-btn:hover { background: var(--text); color: #fff; border-color: var(--text); }
        .qs-copy-btn--done { background: var(--success); color: #fff; border-color: var(--success); }
        .qs-code-block {
          background: #0f172a; border-radius: var(--radius-sm); padding: 18px;
          overflow: auto; max-height: 260px; border: 1px solid #1e293b;
        }
        .qs-code-block pre {
          color: #e2e8f0; font-size: 0.8rem; margin: 0;
          font-family: 'SF Mono', 'Fira Code', 'Courier New', monospace;
          white-space: pre-wrap; word-break: break-all; line-height: 1.6;
        }
        .qs-code-hint { margin: 10px 0 0; font-size: 0.76rem; color: var(--text-muted); font-weight: 500; }

        /* ===== RESPONSIVE ===== */
        @media (min-width: 768px) {
          .qs-cards { display: none !important; }
          .qs-table-section { display: block !important; }
          .qs-header { padding: 24px 32px; }
          .qs-stats { padding: 14px 32px; }
          .qs-locked { margin: 16px 32px; }
          .qs-form-row { grid-template-columns: repeat(3, 1fr); gap: 18px; }
          .qs-modal-handle { display: none; }   /* ✨ NEW: handle is a mobile affordance only */
        }
        @media (max-width: 767px) {
          .qs-header { padding: 16px; }
          .qs-header-inner { flex-direction: column; align-items: flex-start; }
          .qs-header-title { font-size: 1.15rem; }
          .qs-header-icon { width: 42px; height: 42px; border-radius: 12px; }
          .qs-stats { padding: 10px 16px; gap: 8px; }
          .qs-stat-chip { padding: 7px 11px; font-size: 0.78rem; }
          .qs-locked { margin: 12px 16px; padding: 28px 16px; }
          .qs-table-section { display: none !important; }
          .qs-cards { display: flex !important; }
          .qs-card-grid { grid-template-columns: 1fr 1fr; }
          .qs-form-row { grid-template-columns: 1fr; }
          .qs-diff-row { grid-template-columns: 1fr; }
          .qs-modal { border-radius: 20px 20px 0 0; max-height: 96vh; width: 100%; max-width: 100%; }
          .qs-modal-overlay { align-items: flex-end; }
          .qs-method-tabs { width: 100%; }
          .qs-method-tab { flex: 1; justify-content: center; font-size: 0.78rem; padding: 9px 8px; }
          .qs-opt-grid { grid-template-columns: 1fr; }
          .qs-upload-zone { padding: 36px 16px; }
          .qs-modal-body { padding: 20px 16px; }
          /* ✨ NEW: full-width header & footer buttons on mobile */
          .qs-header-actions { width: 100%; }
          .qs-header-actions .qs-btn { flex: 1; justify-content: center; }
          .qs-modal-footer { padding: 12px 16px 20px; }
          .qs-modal-footer .qs-btn { flex: 1; justify-content: center; }
        }
        @media (max-width: 420px) {
          .qs-card-grid { grid-template-columns: 1fr; }
          .qs-q-header { flex-direction: column; align-items: flex-start; }
        }
        /* ✨ editor layout responsive */
        @media (max-width: 900px) {
          .qs-editor-layout { grid-template-columns: 1fr; }
          .qs-rail { position: static; }
          .qs-rail__grid { grid-template-columns: repeat(auto-fill, minmax(38px, 1fr)); max-height: none; }
          /* ✨ FIXED: -20px horizontal margin bled past the 16px body padding */
          .qs-editor-footer { position: sticky; bottom: 0; margin: 16px -16px -20px; padding: 12px 16px; }
          .qs-modal-body { padding: 20px 16px; }
        }

        /* ===== SCROLLBAR ===== */
        .qs-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .qs-root ::-webkit-scrollbar-track { background: transparent; }
        .qs-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
        .qs-root ::-webkit-scrollbar-thumb:hover { background: #94a3b8; }
      `}</style>

      {/* ===== HEADER ===== */}
      <div className="qs-header">
        <div className="qs-header-inner">
          <div className="qs-header-left">
            <div className="qs-header-icon">
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/>
              </svg>
            </div>
            <div>
              <h1 className="qs-header-title">Question Sets</h1>
              <p className="qs-header-sub">{isTeacher ? 'Manage question sets for your assigned subjects' : 'Create and manage question sets for tests'}</p>
            </div>
          </div>
          {/* ✨ NEW: class instead of inline styles → full-width button on mobile */}
          <div className="qs-header-actions">
            {!(isTeacher && availableClasses.length === 0) && (
              <button className="qs-btn qs-btn-primary" onClick={handleOpenCreate}>
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                Create Question Set
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ===== STATS BAR ===== */}
      {!isTeacher && (
        <div className="qs-stats">
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            <strong>{filteredQuestionSets.length}</strong> Sets
          </div>
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/><circle cx="12" cy="12" r="10"/></svg>
            <strong>{totalQuestions}</strong> Questions
          </div>
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>
            <strong>{coveredSubjects}</strong> Subjects
          </div>
          <div className="qs-stat-chip">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg>
            <strong>{coveredClasses}</strong> Classes
          </div>
        </div>
      )}

      {isTeacher && availableClasses.length === 0 ? (
        /* ===== LOCKED (teacher with no assignments) ===== */
        <div className="qs-locked">
          <div className="qs-locked-icon">🔒</div>
          <h3>No classes assigned yet</h3>
          <p>You'll be able to create and manage question sets once an admin assigns you to a class and subject.</p>
        </div>
      ) : (
        <>
          {/* ===== DESKTOP TABLE ===== */}
          <div className="qs-table-section">
            <div className="qs-table-wrap">
              <table className="qs-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Class</th>
                    <th>Subject</th>
                    {!isTeacher && <th>Assigned Teacher</th>}
                    {!isTeacher && <th>Questions</th>}
                    {!isTeacher && <th>Created</th>}
                    <th style={{ width: 120 }}></th>
                  </tr>
                </thead>
                <tbody>
                  {filteredQuestionSets.length === 0 ? (
                    <tr>
                      <td colSpan={colSpan} className="qs-empty">
                        <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📝</span>
                        {isTeacher ? 'No question sets for your assigned subjects yet.' : 'No question sets yet. Create your first set to get started.'}
                      </td>
                    </tr>
                  ) : filteredQuestionSets.map((qs) => {
                    const setId = qs._id || qs.id;
                    const classInfo = getClassInfo(qs);
                    const subjectInfo = getSubjectInfo(qs);
                    const questionCount = qs.questions?.length || 0;
                    const d = getDiffBreakdown(qs.questions);
                    const assignedTeacher = !isTeacher
                      ? getTeacherDisplayInfo(getAssignedTeacher(
                          (qs.classId?._id || qs.classId)?.toString(),
                          (qs.subjectId?._id || qs.subjectId)?.toString(),
                          allTeacherAssignments
                        ))
                      : null;
                    return (
                      <tr key={setId}>
                        <td>
                          <div style={{ fontWeight: 700, fontSize: '0.92rem', lineHeight: 1.3 }}>{qs.title || 'Untitled Set'}</div>
                          {isTeacher && (
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 5, flexWrap: 'wrap' }}>
                              <span className="qs-badge qs-badge-indigo"><span className="qs-badge-dot" />{questionCount} Q{questionCount === 1 ? '' : 's'}</span>
                              <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 500 }}>{formatDate(qs.createdAt)}</span>
                            </div>
                          )}
                        </td>
                        <td style={{ fontWeight: 600 }}>{classInfo ? `${classInfo.name}${classInfo.section ? ' — ' + classInfo.section : ''}` : '—'}</td>
                        <td style={{ color: 'var(--text-secondary)', fontWeight: 500 }}>{subjectInfo?.name || '—'}</td>
                        {!isTeacher && (
                          <td>
                            {assignedTeacher ? (
                              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                                <div style={{ width: 26, height: 26, borderRadius: '50%', background: getAvatarColor(assignedTeacher), display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '0.62rem', fontWeight: 700, flexShrink: 0 }}>
                                  {getInitials(assignedTeacher)}
                                </div>
                                <span style={{ fontSize: '0.85rem', color: 'var(--text-secondary)', fontWeight: 500 }}>{formatName(assignedTeacher)}</span>
                              </div>
                            ) : (
                              <span style={{ fontSize: '0.82rem', color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Assigned</span>
                            )}
                          </td>
                        )}
                        {!isTeacher && (
                          <td>
                            <div style={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
                              <span style={{ fontWeight: 700, fontSize: '0.9rem' }}>{questionCount}</span>
                              <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 500 }}>{d.easy}E · {d.medium}M · {d.hard}H</span>
                            </div>
                          </td>
                        )}
                        {!isTeacher && (
                          <td style={{ fontSize: '0.82rem', color: 'var(--text-secondary)', whiteSpace: 'nowrap' }}>{formatDate(qs.createdAt)}</td>
                        )}
                        <td>
                          <div className="qs-table-actions">
                            <button className="qs-btn qs-btn-ghost qs-btn-sm" onClick={() => handleOpenEdit(qs)}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                              Edit
                            </button>
                            <button className="qs-btn qs-btn-danger-outline qs-btn-sm" onClick={() => handleDelete(qs)} title="Delete set">
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* ===== ✨ NEW: MOBILE CARDS ===== */}
          <div className="qs-cards">
            {filteredQuestionSets.length === 0 ? (
              <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
                <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>📝</span>
                {isTeacher ? 'No question sets for your assigned subjects yet.' : 'No question sets yet. Create your first set to get started.'}
              </div>
            ) : filteredQuestionSets.map((qs) => {
              const setId = qs._id || qs.id;
              const classInfo = getClassInfo(qs);
              const subjectInfo = getSubjectInfo(qs);
              const questionCount = qs.questions?.length || 0;
              const assignedTeacher = !isTeacher
                ? getTeacherDisplayInfo(getAssignedTeacher(
                    (qs.classId?._id || qs.classId)?.toString(),
                    (qs.subjectId?._id || qs.subjectId)?.toString(),
                    allTeacherAssignments
                  ))
                : null;
              return (
                <div className="qs-card" key={setId}>
                  <div className="qs-card-top">
                    <div className="qs-card-ico">
                      <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3" /><line x1="12" y1="17" x2="12.01" y2="17" /><circle cx="12" cy="12" r="10" />
                      </svg>
                    </div>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div className="qs-card-title">{qs.title || 'Untitled Set'}</div>
                      <div className="qs-card-sub">
                        {classInfo ? `${classInfo.name}${classInfo.section ? ' — ' + classInfo.section : ''}` : 'No class'}
                        {subjectInfo ? ` · ${subjectInfo.name}` : ''}
                      </div>
                    </div>
                    <span className="qs-badge qs-badge-indigo">
                      <span className="qs-badge-dot" />
                      {questionCount} Q{questionCount === 1 ? '' : 's'}
                    </span>
                  </div>

                  <div className="qs-card-grid">
                    <div className="qs-card-field">
                      <span className="qs-card-field-label">Class</span>
                      <span className="qs-card-field-value">{classInfo ? classInfo.name : '—'}</span>
                    </div>
                    <div className="qs-card-field">
                      <span className="qs-card-field-label">Subject</span>
                      <span className="qs-card-field-value">{subjectInfo ? subjectInfo.name : '—'}</span>
                    </div>
                    {!isTeacher && (
                      <div className="qs-card-field" style={{ gridColumn: '1 / -1' }}>
                        <span className="qs-card-field-label">Assigned Teacher</span>
                        <span className="qs-card-field-value" style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
                          {assignedTeacher ? (
                            <>
                              <span style={{ width: 22, height: 22, borderRadius: '50%', background: getAvatarColor(assignedTeacher), color: '#fff', fontSize: '0.6rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                                {getInitials(assignedTeacher)}
                              </span>
                              {formatName(assignedTeacher)}
                            </>
                          ) : (
                            <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>Not Assigned</span>
                          )}
                        </span>
                      </div>
                    )}
                    <div className="qs-card-field">
                      <span className="qs-card-field-label">Questions</span>
                      <span className="qs-card-field-value">{questionCount}</span>
                    </div>
                    <div className="qs-card-field">
                      <span className="qs-card-field-label">Created</span>
                      <span className="qs-card-field-value">{formatDate(qs.createdAt)}</span>
                    </div>
                  </div>

                  <div className="qs-card-actions">
                    <button className="qs-btn qs-btn-ghost qs-btn-sm" onClick={() => handleOpenEdit(qs)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                      Edit
                    </button>
                    <button className="qs-btn qs-btn-danger qs-btn-sm" onClick={() => handleDelete(qs)}>
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* ===== MODAL: CREATE / EDIT QUESTION SET ===== */}
      {showModal && (
        <div className="qs-modal-overlay" onClick={handleCloseModal}>
          <div className="qs-modal" onClick={(e) => e.stopPropagation()}>
            <div className="qs-modal-handle" />
            <div className="qs-modal-header">
              <h3 className="qs-modal-title">{editingSet ? 'Edit Question Set' : 'Create New Question Set'}</h3>
              <button className="qs-modal-close" onClick={handleCloseModal}>×</button>
            </div>

            <div className="qs-modal-body" ref={modalBodyRef} onScroll={handleScroll}>
              {error && (
                <div className="qs-alert qs-alert-danger">⚠ {error}</div>
              )}

              {/* ── Method tabs ── */}
              <div className="qs-method-tabs">
                <button type="button" className={`qs-method-tab${inputMethod === 'manual' ? ' qs-method-tab--active' : ''}`} onClick={() => setInputMethod('manual')}>
                  ✏️ Manual Entry
                </button>
                <button type="button" className={`qs-method-tab${inputMethod === 'upload' ? ' qs-method-tab--active' : ''}`} onClick={() => setInputMethod('upload')}>
                  📄 Upload File
                </button>
              </div>

              {inputMethod === 'manual' ? (
                <>
                  {/* ── Assigned teacher bar (admin) ── */}
                  {!isTeacher && formData.classId && formData.subjectId && !classAssignmentsPending && (
                    currentTeacherInfo ? (
                      <div className="qs-teacher-bar qs-teacher-bar--ok">
                        <div className="qs-teacher-avatar" style={{ background: getAvatarColor(currentTeacherInfo) }}>{getInitials(currentTeacherInfo)}</div>
                        <div>
                          <div className="qs-teacher-name">{formatName(currentTeacherInfo)}</div>
                          <div className="qs-teacher-sub">Assigned teacher for this class &amp; subject</div>
                        </div>
                      </div>
                    ) : (
                      <div className="qs-teacher-bar qs-teacher-bar--warn">
                        <div className="qs-teacher-avatar" style={{ background: 'linear-gradient(135deg, #f59e0b, #d97706)' }}>?</div>
                        <div>
                          <div className="qs-teacher-name">No teacher assigned</div>
                          <div className="qs-teacher-sub">Nobody teaches this subject in this class yet</div>
                        </div>
                      </div>
                    )
                  )}

                  {/* ── Set details ── */}
                  <div className="qs-form-row">
                    <div className="qs-form-group">
                      <label className="qs-form-label">Title</label>
                      <input className="qs-form-input" name="title" value={formData.title} onChange={handleChange} placeholder="e.g. First Term Mathematics Test" />
                    </div>
                    <div className="qs-form-group">
                      <label className="qs-form-label">Class</label>
                      <select className="qs-form-select" name="classId" value={formData.classId} onChange={handleChange}>
                        <option value="">Select class…</option>
                        {availableClasses.map((c) => (
                          <option key={c._id || c.id} value={c._id || c.id}>
                            {c.name}{c.section ? ` — ${c.section}` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="qs-form-group">
                      <label className="qs-form-label">Subject</label>
                      <select className="qs-form-select" name="subjectId" value={formData.subjectId} onChange={handleChange} disabled={isTeacher && !formData.classId}>
                        <option value="">{isTeacher && !formData.classId ? 'Select a class first…' : 'Select subject…'}</option>
                        {availableSubjects.map((sub) => (
                          <option key={sub._id || sub.id} value={sub._id || sub.id}>{sub.name}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* ── Editor: navigator rail + zones ── */}
                  <div className="qs-editor-layout">
                    <div className="qs-rail">
                      <div className="qs-rail__title">
                        <span>Questions</span>
                        <span>{formData.questions.length}</span>
                      </div>
                      <div className="qs-rail__grid">
                        {formData.questions.map((q, i) => {
                          const filled = q.questionText.trim() !== '' || q.options.filter(o => o.trim()).length >= 2;
                          return (
                            <button
                              type="button"
                              key={i}
                              className={`qs-rail-chip${filled ? ' qs-rail-chip--filled' : ''}${i === currentQuestionIndex ? ' qs-rail-chip--current' : ''}`}
                              onClick={() => setCurrentQuestionIndex(i)}
                              title={filled ? `Question ${i + 1}` : `Question ${i + 1} (empty)`}
                            >
                              {i + 1}
                              <span className="qs-rail-chip__dot" />
                            </button>
                          );
                        })}
                      </div>
                      <div className="qs-rail__legend">Green dot = has content<br />Highlighted = current</div>
                    </div>

                    <div>
                      {/* Zone 1: question text + toolbar + live preview */}
                      <div className="qs-zone">
                        <div className="qs-zone-head">
                          <span className="qs-zone-num">{currentQuestionIndex + 1}</span>
                          <span className="qs-zone-title">Question</span>
                          <span className="qs-zone-hint">Toolbar supports formatting &amp; figures</span>
                        </div>
                        {/* ✅ formatting toolbar — attached to the question textarea */}
                        <QuestionToolbar textareaRef={questionTextRef} />
                        <textarea
                          ref={questionTextRef}
                          className="qs-form-textarea"
                          style={{ minHeight: 110 }}
                          value={cq.questionText}
                          onChange={(e) => handleQuestionChange('questionText', e.target.value)}
                          placeholder="Type the question here… inserted figures appear as [FIG:id] tokens"
                        />
                        <div className="qs-preview">
                          <span className="qs-preview-label">Live Preview</span>
                          <div dangerouslySetInnerHTML={{ __html: displayToHtml(cq.questionText) || '<em style="color:#94a3b8;">Preview appears here as you type…</em>' }} />
                        </div>
                      </div>

                      {/* Zone 2: options — click a card to mark it correct */}
                      <div className="qs-zone">
                        <div className="qs-zone-head">
                          <span className="qs-zone-num">✓</span>
                          <span className="qs-zone-title">Options</span>
                          <span className="qs-zone-hint">Click an option to mark it correct</span>
                        </div>
                        <div className="qs-opt-grid">
                          {cq.options.map((opt, i) => (
                            <div
                              key={i}
                              className={`qs-opt qs-opt--selectable${cq.correctAnswer === i ? ' qs-opt--correct' : ''}`}
                              onClick={() => handleSetCorrect(i)}
                              title="Click to mark as the correct answer"
                            >
                              <span className="qs-opt__check" />
                              <span className="qs-opt-letter">{String.fromCharCode(65 + i)}</span>
                              <input
                                className="qs-opt-input"
                                type="text"
                                value={opt}
                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                onChange={(e) => handleOptionChange(i, e.target.value)}
                                onClick={(e) => e.stopPropagation()}
                              />
                              {cq.options.length > 2 && (
                                <button
                                  type="button"
                                  className="qs-opt-remove"
                                  onClick={(e) => { e.stopPropagation(); handleRemoveOption(i); }}
                                  title="Remove option"
                                >×</button>
                              )}
                            </div>
                          ))}
                        </div>
                        <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                          {cq.options.length < 8 && (
                            <button type="button" className="qs-btn qs-btn-ghost qs-btn-sm" onClick={handleAddOption}>
                              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
                              Add Option
                            </button>
                          )}
                          <button type="button" className="qs-btn qs-btn-ghost qs-btn-sm" onClick={handleShuffleOptions}>
                            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>
                            Shuffle Options
                          </button>
                        </div>
                      </div>

                      {/* Zone 3: difficulty + explanation */}
                      <div className="qs-zone">
                        <div className="qs-zone-head">
                          <span className="qs-zone-num">⚙</span>
                          <span className="qs-zone-title">Difficulty &amp; Explanation</span>
                          <span className="qs-zone-hint">Explanation shows after submission</span>
                        </div>
                        <div className="qs-diff-row">
                          <div className="qs-form-group">
                            <label className="qs-form-label">Difficulty</label>
                            <select className="qs-form-select" value={cq.difficulty} onChange={(e) => handleQuestionChange('difficulty', e.target.value)}>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                          </div>
                          <div className="qs-form-group">
                            <label className="qs-form-label">Explanation (optional)</label>
                            <textarea
                              className="qs-form-textarea"
                              value={cq.explanation}
                              onChange={(e) => handleQuestionChange('explanation', e.target.value)}
                              placeholder="Why is the correct answer right?"
                            />
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* ── Sticky editor footer: navigate / duplicate / remove ── */}
                  <div className="qs-editor-footer">
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                      <button type="button" className="qs-btn qs-btn-ghost qs-btn-sm" onClick={handlePrev} disabled={currentQuestionIndex === 0}>← Prev</button>
                      <span className="qs-nav-label">Q{currentQuestionIndex + 1} / {formData.questions.length}</span>
                      <button type="button" className="qs-btn qs-btn-ghost qs-btn-sm" onClick={handleNext}>{isLast ? '+ New Question' : 'Next →'}</button>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button type="button" className="qs-btn qs-btn-ghost qs-btn-sm" onClick={handleDuplicateQuestion} title="Duplicate this question">⧉ Duplicate</button>
                      <button type="button" className="qs-btn qs-btn-danger-outline qs-btn-sm" onClick={removeQuestion} disabled={formData.questions.length <= 1} title="Remove this question">🗑 Remove</button>
                    </div>
                  </div>
                </>
              ) : (
                /* ── Upload tab ── */
                <>
                  <div className="qs-upload-zone" onClick={() => fileInputRef.current?.click()}>
                    <div className="qs-upload-icon-wrap">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                        <polyline points="17 8 12 3 7 8" />
                        <line x1="12" y1="3" x2="12" y2="15" />
                      </svg>
                    </div>
                    <h4 className="qs-upload-title">Click to upload a questions file</h4>
                    <p className="qs-upload-sub">Accepts .json or .csv — uploading replaces the current questions</p>
                    <input type="file" ref={fileInputRef} accept=".json,.csv" style={{ display: 'none' }} onChange={handleFileUpload} />
                  </div>

                  <div style={{ marginTop: 24 }}>
                    <div className="qs-code-head">
                      <span className="qs-code-label">JSON format</span>
                      <button type="button" className={`qs-copy-btn${copied ? ' qs-copy-btn--done' : ''}`} onClick={handleCopyJSON}>
                        {copied ? '✓ Copied!' : 'Copy sample'}
                      </button>
                    </div>
                    <div className="qs-code-block"><pre>{sampleJSON}</pre></div>
                    <p className="qs-code-hint">
                      CSV columns: question, option A, option B, option C, option D, correct answer index (0-based), difficulty, explanation.
                    </p>
                  </div>
                </>
              )}

              {/* scroll-to-bottom button */}
              <button
                type="button"
                className={`qs-scroll-btn${showScrollBtn ? ' qs-scroll-btn--vis' : ''}`}
                onClick={scrollToBottom}
                title="Scroll to bottom"
              >
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
              </button>
            </div>

            <div className="qs-modal-footer">
              <button type="button" className="qs-btn qs-btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button type="button" className="qs-btn qs-btn-ghost" onClick={handleExportJSON} title="Download current questions as JSON">⇩ Export JSON</button>
              <button type="button" className="qs-btn qs-btn-primary" onClick={handleSubmit} disabled={isSaving}>
                {isSaving && <span className="qs-btn-spinner" />}
                {editingSet ? 'Save Changes' : 'Create Question Set'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default QuestionSetManager;