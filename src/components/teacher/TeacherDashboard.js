import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, testsAPI, teacherCAAPI, getAuthData } from '../../api';
import './TeacherDashboard.css';

/* ── Inline SVG Icon Components ── */
const Icons = {
  school: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 10v6M2 10l10-5 10 5-10 5z" /><path d="M6 12v5c3 3 9 3 12 0v-5" />
    </svg>
  ),
  book: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  ),
  clipboardCheck: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
      <path d="M9 14l2 2 4-4" />
    </svg>
  ),
  clipboard: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
      <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
    </svg>
  ),
  timer: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" />
    </svg>
  ),
  checkCircle: (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
    </svg>
  ),
  plus: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" />
    </svg>
  ),
  layers: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polygon points="12 2 2 7 12 12 22 7 12 2" /><polyline points="2 17 12 22 22 17" />
      <polyline points="2 12 12 17 22 12" />
    </svg>
  ),
  barChart: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="12" y1="20" x2="12" y2="10" /><line x1="18" y1="20" x2="18" y2="4" /><line x1="6" y1="20" x2="6" y2="16" />
    </svg>
  ),
  users: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" />
      <path d="M23 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
    </svg>
  ),
  arrowRight: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <line x1="5" y1="12" x2="19" y2="12" /><polyline points="12 5 19 12 12 19" />
    </svg>
  ),
  fileText: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" />
      <line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
    </svg>
  ),
  calendar: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="4" width="18" height="18" rx="2" ry="2" />
      <line x1="16" y1="2" x2="16" y2="6" /><line x1="8" y1="2" x2="8" y2="6" />
      <line x1="3" y1="10" x2="21" y2="10" />
    </svg>
  ),
  dots: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /><circle cx="5" cy="12" r="1" />
    </svg>
  ),
  sparkline: (
    <svg width="40" height="24" viewBox="0 0 40 24" fill="none">
      <polyline points="1,18 8,14 15,16 22,8 29,10 36,4 39,2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </svg>
  ),
  alertCircle: (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  ),
  clock: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>
    </svg>
  ),
  logIn: (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>
    </svg>
  ),
  monitor: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/>
    </svg>
  ),
  smartphone: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="2" width="14" height="20" rx="2" ry="2"/><line x1="12" y1="18" x2="12.01" y2="18"/>
    </svg>
  ),
  globe: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>
    </svg>
  ),
  history: (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/>
    </svg>
  ),
};

/* ── Helper: Format relative time ── */
const formatRelativeTime = (dateString) => {
  if (!dateString) return 'Unknown';
  const date = new Date(dateString);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;
  if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
  if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
};

/* ── Helper: Format full date/time ── */
const formatFullDateTime = (dateString) => {
  if (!dateString) return 'N/A';
  return new Date(dateString).toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/* ── Helper: Detect device type from user agent string ── */
const getDeviceIcon = (userAgent) => {
  if (!userAgent) return Icons.monitor;
  const ua = userAgent.toLowerCase();
  if (/mobile|android|iphone|ipod/.test(ua)) return Icons.smartphone;
  return Icons.monitor;
};

const TeacherDashboard = () => {
  const { user } = getAuthData();

  const { data: assignments } = useQuery({
    queryKey: ['teacher-assignments', user?._id],
    queryFn: () => dashboardAPI.getAssignmentsByTeacher(user?._id),
    enabled: !!user?._id,
  });

  const { data: tests } = useQuery({
    queryKey: ['teacher-tests', user?._id],
    queryFn: () => testsAPI.getByTeacher(user?._id),
    enabled: !!user?._id,
  });

  /* ── Fetch CA entry stats from backend ── */
  const { data: caStats } = useQuery({
    queryKey: ['teacher-ca-stats', user?._id],
    queryFn: () => teacherCAAPI.getCASubjectsCount(),
    enabled: !!user?._id,
    staleTime: 30 * 1000,
    refetchOnWindowFocus: true,
  });

  /* ── Fetch fallback submissions ── */
  const { data: caSubmissions } = useQuery({
    queryKey: ['teacher-ca-submissions-fallback', user?._id],
    queryFn: () => teacherCAAPI.getMySubmissions(),
    enabled: !!user?._id && caStats?.success === false,
    staleTime: 30 * 1000,
  });

  /* ── Fetch last teacher logins ── */
  const { data: lastLogins, isLoading: loadingLogins } = useQuery({
    queryKey: ['teacher-last-logins'],
    queryFn: () => dashboardAPI.getLastTeacherLogins(),
    enabled: !!user?._id,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: true,
  });

  const uniqueClasses = React.useMemo(() => {
    if (!assignments?.data) return [];
    const classMap = new Map();
    assignments.data.forEach((assignment) => {
      const classId = assignment.class_id?._id || assignment.class_id;
      if (!classId) return;
      const classData = assignment.class_id?._id
        ? assignment.class_id
        : assignment.class?.id
          ? assignment.class
          : null;
      const subjectData = assignment.subject_id?._id
        ? assignment.subject_id
        : assignment.subject?.id
          ? assignment.subject
          : null;
      if (!classMap.has(classId)) {
        classMap.set(classId, {
          _id: classId,
          name: classData?.name || 'Unknown Class',
          section: classData?.section || 'N/A',
          students: classData?.students || [],
          subjects: subjectData ? [subjectData] : [],
        });
      } else {
        const existingClass = classMap.get(classId);
        if (subjectData) {
          const subjectId = subjectData._id || subjectData.id;
          const alreadyAdded = existingClass.subjects.some(
            (s) => (s._id || s.id) === subjectId
          );
          if (!alreadyAdded) existingClass.subjects.push(subjectData);
        }
      }
    });
    return Array.from(classMap.values());
  }, [assignments]);

  const teacherStats = React.useMemo(() => {
    const totalStudents = uniqueClasses.reduce(
      (acc, cls) => acc + (cls.students?.length || 0),
      0
    );
    const totalSubjects = uniqueClasses.reduce(
      (acc, cls) => acc + cls.subjects.length,
      0
    );
    return { classes: uniqueClasses.length, subjects: totalSubjects, students: totalStudents };
  }, [uniqueClasses]);

  const testStats = React.useMemo(() => {
    if (!tests?.data) return { total: 0, active: 0, published: 0 };
    const now = new Date();
    const total = tests.data.length;
    const active = tests.data.filter((test) => {
      const endDate = test.endDate ? new Date(test.endDate) : null;
      return endDate && endDate > now;
    }).length;
    const published = tests.data.filter((test) => test.resultsPublished).length;
    return { total, active, published };
  }, [tests]);

  /* ── Derive CA subjects entered count ── */
  const caSubjectsEntered = React.useMemo(() => {
    if (caStats?.success && caStats?.data != null) {
      const count = 
        caStats.data.completedSubjects ?? 
        caStats.data.subjectsCount ?? 
        caStats.data.count ?? 
        caStats.data;
      
      if (typeof count === 'number') return count;
    }

    if (caSubmissions?.success && Array.isArray(caSubmissions.data)) {
      const uniquePairs = new Set();
      caSubmissions.data.forEach((record) => {
        const cId = record.class_id?._id || record.class_id || record.classId?._id || record.classId;
        const sId = record.subject_id?._id || record.subject_id || record.subjectId?._id || record.subjectId;
        if (cId && sId) uniquePairs.add(`${cId}::${sId}`);
      });
      return uniquePairs.size;
    }

    return 0;
  }, [caStats, caSubmissions]);

  const caProgress = React.useMemo(() => {
    if (teacherStats.subjects === 0) return 0;
    return Math.round((caSubjectsEntered / teacherStats.subjects) * 100);
  }, [caSubjectsEntered, teacherStats.subjects]);

  const caIsComplete = caSubjectsEntered > 0 && caSubjectsEntered >= teacherStats.subjects;

  /* ── Process login data ── */
  const processedLogins = React.useMemo(() => {
    if (!lastLogins?.data && !lastLogins?.success) return [];
    const logins = Array.isArray(lastLogins?.data) ? lastLogins.data : [];
    return logins.slice(0, 8).map((login) => ({
      _id: login._id,
      name: login.name || `${login.firstName || ''} ${login.lastName || ''}`.trim() || 'Unknown',
      firstName: login.firstName || login.name?.split(' ')[0] || '',
      lastName: login.lastName || login.name?.split(' ').slice(1).join(' ') || '',
      email: login.email,
      lastLogin: login.lastLogin || login.loginAt || login.createdAt,
      device: login.device || login.userAgent || '',
      ip: login.ip || login.ipAddress || '',
      avatar: login.avatar || login.profileImage || null,
    }));
  }, [lastLogins]);

  const getGreeting = () => {
    const hour = new Date().getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 17) return 'Good Afternoon';
    return 'Good Evening';
  };

  const todayDate = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  const statCards = [
    { title: 'Assigned Classes', value: teacherStats.classes, icon: Icons.school, color: 'violet', spark: true },
    { title: 'My Subjects', value: teacherStats.subjects, icon: Icons.book, color: 'emerald', spark: true },
    {
      title: 'CA Subjects Entered',
      value: caSubjectsEntered,
      subtitle: `of ${teacherStats.subjects} assigned`,
      icon: Icons.clipboardCheck,
      color: 'teal',
      spark: false,
      progress: caProgress,
      isComplete: caIsComplete,
    },
    { title: 'Total Tests', value: testStats.total, icon: Icons.clipboard, color: 'blue', spark: false },
    { title: 'Active Tests', value: testStats.active, icon: Icons.timer, color: 'amber', spark: false },
    { title: 'Published Results', value: testStats.published, icon: Icons.checkCircle, color: 'rose', spark: false },
  ];

  const quickActions = [
    { label: 'Create Test', href: '/teacher/create-test', icon: Icons.plus, variant: 'primary' },
    { label: 'Enter CA Scores', href: '/teacher/continuous-assessment', icon: Icons.clipboardCheck, variant: 'secondary' },
    { label: 'Question Sets', href: '/teacher/question-sets', icon: Icons.layers, variant: 'secondary' },
    { label: 'View Results', href: '/teacher/results', icon: Icons.barChart, variant: 'secondary' },
  ];

  return (
    <div className="td-wrapper">
      {/* ── Header Section ── */}
      <header className="td-header">
        <div className="td-header-content">
          <div>
            <p className="td-header-date">
              <span className="td-calendar-icon">{Icons.calendar}</span>
              {todayDate}
            </p>
            <h1 className="td-header-title">
              {getGreeting()}, {user?.firstName} <span className="td-wave">👋</span>
            </h1>
            <p className="td-header-subtitle">
              Here's an overview of your teaching activity
            </p>
          </div>
          <div className="td-header-avatar">
            {(user?.firstName?.[0] || '').toUpperCase()}
            {(user?.lastName?.[0] || '').toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── Stats Grid ── */}
      <section className="td-stats-section">
        <div className="td-stats-grid">
          {statCards.map((stat, i) => (
            <div
              key={i}
              className={`td-stat-card td-stat-card--${stat.color}${stat.progress != null ? ' td-stat-card--has-progress' : ''}`}
              style={{ animationDelay: `${i * 0.07}s` }}
            >
              <div className="td-stat-card__top">
                <div className={`td-stat-card__icon td-stat-card__icon--${stat.color}`}>
                  {stat.icon}
                </div>
                {stat.spark && (
                  <div className={`td-stat-card__spark td-stat-card__spark--${stat.color}`}>
                    {Icons.sparkline}
                  </div>
                )}
                {stat.isComplete && (
                  <div className="td-stat-card__complete-badge">
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/>
                    </svg>
                    Done
                  </div>
                )}
              </div>
              <div className="td-stat-card__value-row">
                <div className="td-stat-card__value">
                  {stat.value}
                  {stat.subtitle && (
                    <span className="td-stat-card__value-sub">{stat.subtitle}</span>
                  )}
                </div>
              </div>
              <div className="td-stat-card__title">{stat.title}</div>

              {stat.progress != null && (
                <div className="td-stat-card__progress">
                  <div className="td-stat-card__progress-track">
                    <div
                      className={`td-stat-card__progress-fill td-stat-card__progress-fill--${stat.color}${stat.isComplete ? ' td-stat-card__progress-fill--complete' : ''}`}
                      style={{ width: `${Math.min(stat.progress, 100)}%` }}
                    />
                  </div>
                  <span className={`td-stat-card__progress-label${stat.isComplete ? ' td-stat-card__progress-label--complete' : ''}`}>
                    {stat.progress}%
                  </span>
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── CA Entry Reminder ── */}
      {teacherStats.subjects > 0 && !caIsComplete && (
        <section className="td-ca-reminder">
          <div className="td-ca-reminder__content">
            <div className="td-ca-reminder__icon">
              {Icons.alertCircle}
            </div>
            <div className="td-ca-reminder__text">
              <span className="td-ca-reminder__highlight">
                {teacherStats.subjects - caSubjectsEntered} subject{teacherStats.subjects - caSubjectsEntered !== 1 ? 's' : ''}
              </span>{' '}
              still need CA score entry for the current term.
              You've completed {caSubjectsEntered} of {teacherStats.subjects}.
            </div>
          </div>
          <a href="/teacher/continuous-assessment" className="td-ca-reminder__action">
            Enter Scores
            <span>{Icons.arrowRight}</span>
          </a>
        </section>
      )}

      {/* ── CA All Done Banner ── */}
      {teacherStats.subjects > 0 && caIsComplete && (
        <section className="td-ca-complete-banner">
          <div className="td-ca-complete-banner__content">
            <div className="td-ca-complete-banner__icon">
              {Icons.checkCircle}
            </div>
            <div className="td-ca-complete-banner__text">
              All <strong>{teacherStats.subjects}</strong> assigned subjects have CA scores entered for the current term.
            </div>
          </div>
        </section>
      )}

      {/* ── Quick Actions ── */}
      <section className="td-section">
        <div className="td-section-header">
          <h2 className="td-section-title">Quick Actions</h2>
        </div>
        <div className="td-actions-grid">
          {quickActions.map((action, i) => (
            <a
              key={i}
              href={action.href}
              className={`td-action-btn td-action-btn--${action.variant}`}
            >
              <span className="td-action-btn__icon">{action.icon}</span>
              <span className="td-action-btn__label">{action.label}</span>
              <span className="td-action-btn__arrow">{Icons.arrowRight}</span>
            </a>
          ))}
        </div>
      </section>

      {/* ── Last Teachers Login ── */}
      <section className="td-section">
        <div className="td-section-header">
          <h2 className="td-section-title">
            <span className="td-section-title__icon">{Icons.logIn}</span>
            Recent Teacher Logins
          </h2>
          {processedLogins.length > 0 && (
            <span className="td-section-badge td-section-badge--blue">
              {processedLogins.length} online recently
            </span>
          )}
        </div>

        {loadingLogins ? (
          <div className="td-logins-loading">
            <div className="td-logins-loading__spinner" />
            <span>Loading login activity...</span>
          </div>
        ) : processedLogins.length === 0 ? (
          <div className="td-logins-empty">
            <div className="td-logins-empty__icon">{Icons.history}</div>
            <p>No recent login activity to display</p>
          </div>
        ) : (
          <>
            {/* Desktop Table View */}
            <div className="td-table-wrapper td-logins-table-wrapper">
              <table className="td-table td-logins-table">
                <thead>
                  <tr>
                    <th>Teacher</th>
                    <th>Last Login</th>
                    <th>Device</th>
                    <th>IP Address</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {processedLogins.map((login, index) => {
                    const isOnline = login.lastLogin && (Date.now() - new Date(login.lastLogin).getTime()) < 30 * 60 * 1000;
                    const isCurrentUser = login.email === user?.email;
                    
                    return (
                      <tr key={login._id || index} className={isCurrentUser ? 'td-logins-row--current' : ''}>
                        <td>
                          <div className="td-logins-teacher">
                            <div className={`td-logins-avatar ${isOnline ? 'td-logins-avatar--online' : ''}`}>
                              {login.avatar ? (
                                <img src={login.avatar} alt={login.name} />
                              ) : (
                                <span className="td-logins-avatar__initials">
                                  {(login.firstName?.[0] || '').toUpperCase()}
                                  {(login.lastName?.[0] || '').toUpperCase()}
                                </span>
                              )}
                              {isOnline && <span className="td-logins-avatar__pulse" />}
                            </div>
                            <div className="td-logins-teacher-info">
                              <span className="td-logins-teacher-name">
                                {login.name}
                                {isCurrentUser && <span className="td-logins-you-badge">You</span>}
                              </span>
                              <span className="td-logins-teacher-email">{login.email}</span>
                            </div>
                          </div>
                        </td>
                        <td>
                          <div className="td-logins-time">
                            <span className="td-logins-time__relative">
                              {Icons.clock} {formatRelativeTime(login.lastLogin)}
                            </span>
                            <span className="td-logins-time__full" title={formatFullDateTime(login.lastLogin)}>
                              {formatFullDateTime(login.lastLogin)}
                            </span>
                          </div>
                        </td>
                        <td>
                          <span className="td-logins-device">
                            {getDeviceIcon(login.device)} {login.device ? (login.device.length > 30 ? login.device.substring(0, 30) + '...' : login.device) : 'Unknown'}
                          </span>
                        </td>
                        <td>
                          <span className="td-logins-ip">
                            {login.ip || 'N/A'}
                          </span>
                        </td>
                        <td>
                          <span className={`td-logins-status td-logins-status--${isOnline ? 'online' : 'offline'}`}>
                            <span className="td-logins-status__dot" />
                            {isOnline ? 'Online' : 'Offline'}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Mobile Cards View */}
            <div className="td-mobile-cards td-logins-mobile">
              {processedLogins.map((login, index) => {
                const isOnline = login.lastLogin && (Date.now() - new Date(login.lastLogin).getTime()) < 30 * 60 * 1000;
                const isCurrentUser = login.email === user?.email;
                
                return (
                  <div key={login._id || index} className={`td-logins-mobile-card ${isCurrentUser ? 'td-logins-mobile-card--current' : ''}`}>
                    <div className="td-logins-mobile-card__top">
                      <div className={`td-logins-avatar ${isOnline ? 'td-logins-avatar--online' : ''}`}>
                        {login.avatar ? (
                          <img src={login.avatar} alt={login.name} />
                        ) : (
                          <span className="td-logins-avatar__initials">
                            {(login.firstName?.[0] || '').toUpperCase()}
                            {(login.lastName?.[0] || '').toUpperCase()}
                          </span>
                        )}
                        {isOnline && <span className="td-logins-avatar__pulse" />}
                      </div>
                      <div className="td-logins-mobile-card__info">
                        <div className="td-logins-mobile-card__name">
                          {login.name}
                          {isCurrentUser && <span className="td-logins-you-badge">You</span>}
                        </div>
                        <div className="td-logins-mobile-card__email">{login.email}</div>
                      </div>
                      <span className={`td-logins-status td-logins-status--${isOnline ? 'online' : 'offline'}`}>
                        <span className="td-logins-status__dot" />
                        {isOnline ? 'Online' : 'Offline'}
                      </span>
                    </div>
                    <div className="td-logins-mobile-card__details">
                      <div className="td-logins-mobile-card__detail">
                        <span className="td-logins-mobile-card__detail-label">
                          {Icons.clock} Last Login
                        </span>
                        <span className="td-logins-mobile-card__detail-value">
                          {formatRelativeTime(login.lastLogin)}
                        </span>
                      </div>
                      <div className="td-logins-mobile-card__detail">
                        <span className="td-logins-mobile-card__detail-label">
                          {getDeviceIcon(login.device)} Device
                        </span>
                        <span className="td-logins-mobile-card__detail-value">
                          {login.device ? (login.device.length > 25 ? login.device.substring(0, 25) + '...' : login.device) : 'Unknown'}
                        </span>
                      </div>
                      {login.ip && (
                        <div className="td-logins-mobile-card__detail">
                          <span className="td-logins-mobile-card__detail-label">
                            {Icons.globe} IP
                          </span>
                          <span className="td-logins-mobile-card__detail-value">{login.ip}</span>
                        </div>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </section>

      {/* ── Assigned Classes ── */}
      {assignments?.data?.length > 0 && (
        <section className="td-section">
          <div className="td-section-header">
            <h2 className="td-section-title">My Assigned Classes</h2>
            <a href="/teacher/my-classes" className="td-view-all">
              View All <span>{Icons.arrowRight}</span>
            </a>
          </div>
          <div className="td-classes-container">
            <div className="td-table-wrapper">
              <table className="td-table">
                <thead>
                  <tr>
                    <th>Class</th>
                    <th>Section</th>
                    <th>Subject</th>
                    <th>Students</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.data.slice(0, 5).map((assignment, index) => {
                    const classData = assignment.class_id?._id
                      ? assignment.class_id
                      : assignment.class?.id
                        ? assignment.class
                        : null;
                    const subjectData = assignment.subject_id?._id
                      ? assignment.subject_id
                      : assignment.subject?.id
                        ? assignment.subject
                        : null;
                    if (!classData) return null;
                    return (
                      <tr key={assignment._id || index}>
                        <td>
                          <div className="td-table-class">
                            <span className="td-table-class-icon">{Icons.school}</span>
                            <span className="td-table-class-name">{classData.name}</span>
                          </div>
                        </td>
                        <td>
                          <span className="td-badge td-badge--violet">{classData.section}</span>
                        </td>
                        <td>
                          <span className="td-badge td-badge--emerald">{subjectData?.name || 'N/A'}</span>
                        </td>
                        <td>
                          <span className="td-table-students">
                            {Icons.users} {classData.students?.length || 0}
                          </span>
                        </td>
                        <td>
                          <button className="td-table-more">{Icons.dots}</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div className="td-mobile-cards">
              {assignments.data.slice(0, 5).map((assignment, index) => {
                const classData = assignment.class_id?._id
                  ? assignment.class_id
                  : assignment.class?.id
                    ? assignment.class
                    : null;
                const subjectData = assignment.subject_id?._id
                  ? assignment.subject_id
                  : assignment.subject?.id
                    ? assignment.subject
                    : null;
                if (!classData) return null;
                return (
                  <div key={assignment._id || index} className="td-mobile-card">
                    <div className="td-mobile-card__top">
                      <div className="td-mobile-card__class">
                        <span className="td-mobile-card__icon">{Icons.school}</span>
                        <div>
                          <div className="td-mobile-card__name">{classData.name}</div>
                          <div className="td-mobile-card__students">
                            {Icons.users} {classData.students?.length || 0} students
                          </div>
                        </div>
                      </div>
                      <button className="td-table-more">{Icons.dots}</button>
                    </div>
                    <div className="td-mobile-card__tags">
                      <span className="td-badge td-badge--violet">{classData.section}</span>
                      <span className="td-badge td-badge--emerald">{subjectData?.name || 'N/A'}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            {assignments.data.length > 5 && (
              <div className="td-showing-more">
                Showing 5 of {assignments.data.length} assignments
              </div>
            )}
          </div>
        </section>
      )}

      {/* ── Recent Tests ── */}
      {tests?.data?.length > 0 && (
        <section className="td-section">
          <div className="td-section-header">
            <h2 className="td-section-title">Recent Tests</h2>
            <a href="/teacher/tests" className="td-view-all">
              View All <span>{Icons.arrowRight}</span>
            </a>
          </div>
          <div className="td-tests-list">
            {tests.data.slice(0, 5).map((test) => {
              const now = new Date();
              const endDate = test.endDate ? new Date(test.endDate) : null;
              const isActive = endDate && endDate > now;
              const isPublished = test.resultsPublished;
              const startDate = test.startDate ? new Date(test.startDate) : null;
              const formatDate = (d) =>
                d?.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });

              return (
                <div key={test._id} className="td-test-card">
                  <div className="td-test-card__indicator" data-status={isActive ? 'active' : 'expired'} />
                  <div className="td-test-card__content">
                    <div className="td-test-card__top">
                      <h4 className="td-test-card__title">{test.title}</h4>
                      <div className="td-test-card__badges">
                        <span className={`td-status-badge td-status-badge--${isActive ? 'active' : 'expired'}`}>
                          <span className="td-status-dot" />
                          {isActive ? 'Active' : 'Expired'}
                        </span>
                        {isPublished && (
                          <span className="td-status-badge td-status-badge--published">
                            {Icons.checkCircle} Published
                          </span>
                        )}
                      </div>
                    </div>
                    <div className="td-test-card__meta">
                      {test.class_id?.name && (
                        <span className="td-test-card__tag td-test-card__tag--violet">
                          {test.class_id.name}
                        </span>
                      )}
                      {test.subject_id?.name && (
                        <span className="td-test-card__tag td-test-card__tag--blue">
                          {test.subject_id.name}
                        </span>
                      )}
                    </div>
                    {startDate && (
                      <div className="td-test-card__dates">
                        <span>{Icons.calendar} {formatDate(startDate)}</span>
                        {endDate && <span>→ {formatDate(endDate)}</span>}
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </section>
      )}

      {/* ── Bottom spacing ── */}
      <div className="td-bottom-spacer" />
    </div>
  );
};

export default TeacherDashboard;