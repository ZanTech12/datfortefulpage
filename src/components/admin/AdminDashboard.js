import React, { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { dashboardAPI, questionSetsAPI, testResultsAPI, adminBroadsheetAPI } from '../../api';
import { Link } from 'react-router-dom';
import './admindashboard.css';

const useClock = () => {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
};

const greeting = (h) => {
  if (h < 12) return 'Good Morning';
  if (h < 17) return 'Good Afternoon';
  return 'Good Evening';
};

const Icons = {
  teachers: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>,
  students: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>,
  classes: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>,
  subjects: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"/><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"/></svg>,
  questionSets: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/></svg>,
  questions: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 0 1 5.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>,
  tests: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>,
  assignments: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="16 3 21 3 21 8"/><line x1="4" y1="20" x2="21" y2="3"/><polyline points="21 16 21 21 16 21"/><line x1="15" y1="15" x2="21" y2="21"/><line x1="4" y1="4" x2="9" y2="9"/></svg>,
  submissions: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>,
  passed: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>,
  failed: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><line x1="15" y1="9" x2="9" y2="15"/><line x1="9" y1="9" x2="15" y2="15"/></svg>,
  avgScore: <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>,
  clock: <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>,
  arrowRight: <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>,
  sparkle: <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" stroke="none"><path d="M12 2L14.09 8.26L20 9.27L15.55 13.97L16.91 20L12 16.9L7.09 20L8.45 13.97L4 9.27L9.91 8.26L12 2Z"/></svg>,
};

const MiniStat = ({ icon, label, value, accent, delay = 0 }) => (
  <div className="dash-stat" style={{ '--accent': accent, animationDelay: `${delay}ms` }}>
    <div className="dash-stat__shimmer" />
    <div className="dash-stat__icon-wrap">
      <div className="dash-stat__icon">{icon}</div>
    </div>
    <div className="dash-stat__info">
      <span className="dash-stat__value">{value}</span>
      <span className="dash-stat__label">{label}</span>
    </div>
    <div className="dash-stat__corner" />
  </div>
);

const ActionLink = ({ to, icon, label, accent, index = 0 }) => (
  <Link to={to} className="dash-action" style={{ '--accent': accent, animationDelay: `${index * 50}ms` }}>
    <div className="dash-action__icon">{icon}</div>
    <span className="dash-action__label">{label}</span>
    <span className="dash-action__arrow">{Icons.arrowRight}</span>
    <div className="dash-action__shine" />
  </Link>
);

const StatusPill = ({ status }) => (
  <span className={`dash-pill dash-pill--${status}`}>
    <span className="dash-pill__dot" />
    {status === 'passed' ? 'Passed' : 'Failed'}
  </span>
);

const PassRateBar = ({ rate }) => (
  <div className="dash-pass-rate">
    <div className="dash-pass-rate__track">
      <div
        className="dash-pass-rate__fill"
        style={{ '--rate': `${rate}%` }}
      >
        <div className="dash-pass-rate__glow" />
      </div>
      <div className="dash-pass-rate__marker" style={{ left: `${rate}%` }}>
        <span className="dash-pass-rate__marker-label">{rate}%</span>
      </div>
    </div>
    <div className="dash-pass-rate__labels">
      <span>0%</span>
      <span>50%</span>
      <span>100%</span>
    </div>
  </div>
);

const AdminDashboard = () => {
  const now = useClock();

  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['dashboard-stats'],
    queryFn: dashboardAPI.getStats,
  });

  const { data: assignmentsData, isLoading: assignmentsLoading } = useQuery({
    queryKey: ['dashboard-assignments'],
    queryFn: dashboardAPI.getTeacherAssignments,
  });

  const { data: questionSetsData, isLoading: questionSetsLoading } = useQuery({
    queryKey: ['dashboard-question-sets'],
    queryFn: questionSetsAPI.getAll,
  });

  const { data: resultsData, isLoading: resultsLoading } = useQuery({
    queryKey: ['dashboard-results-summary'],
    queryFn: () => testResultsAPI.getAll(),
  });

  const { data: broadsheetStatsData, isLoading: broadsheetStatsLoading } = useQuery({
    queryKey: ['dashboard-broadsheet-stats'],
    queryFn: () => adminBroadsheetAPI.getGlobalStats(),
    staleTime: 5 * 60 * 1000,
  });

  const assignmentsCount = assignmentsData?.data?.length || 0;
  const questionSetsCount = questionSetsData?.data?.length || 0;
  const totalQuestions = questionSetsData?.data?.reduce((sum, qs) => sum + (qs.questions?.length || 0), 0) || 0;

  const allResults = resultsData?.data || [];
  const totalResults = allResults.length;

  const broadsheetStats = broadsheetStatsData?.data || {};
  const passedResults = broadsheetStats.passed || 0;
  const failedResults = broadsheetStats.failed || 0;
  const averageScore = broadsheetStats.averageScore || 0;
  const passRate = broadsheetStats.passRate || 0;

  const timeStr = now.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  const dateStr = now.toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' });
  const hour = now.getHours();

  return (
    <div className="dash">
      {/* Floating background orbs */}
      <div className="dash-bg">
        <div className="dash-bg__orb dash-bg__orb--1" />
        <div className="dash-bg__orb dash-bg__orb--2" />
        <div className="dash-bg__orb dash-bg__orb--3" />
        <div className="dash-bg__grid" />
      </div>

      <header className="dash-header">
        <div className="dash-header__glass" />
        <div className="dash-header__content">
          <div className="dash-header__left">
            <div className="dash-header__greeting-row">
              <h1 className="dash-header__title">{greeting(hour)}, Admin</h1>
              <span className="dash-header__sparkle">{Icons.sparkle}</span>
            </div>
            <p className="dash-header__sub">Here's what's happening across your platform today.</p>
          </div>
          <div className="dash-header__right">
            <div className="dash-clock">
              <div className="dash-clock__card">
                <span className="dash-clock__icon">{Icons.clock}</span>
                <span className="dash-clock__time">{timeStr}</span>
              </div>
              <span className="dash-clock__date">{dateStr}</span>
            </div>
          </div>
        </div>
      </header>

      <section className="dash-stats">
        <MiniStat icon={Icons.teachers} label="Total Teachers" value={stats?.data?.teachers || 0} accent="#6366f1" delay={0} />
        <MiniStat icon={Icons.students} label="Total Students" value={stats?.data?.students || 0} accent="#10b981" delay={60} />
        <MiniStat icon={Icons.classes} label="Active Classes" value={stats?.data?.classes || 0} accent="#f59e0b" delay={120} />
        <MiniStat icon={Icons.subjects} label="Subjects" value={stats?.data?.subjects || 0} accent="#06b6d4" delay={180} />
        <MiniStat icon={Icons.questionSets} label="Question Sets" value={questionSetsCount} accent="#8b5cf6" delay={240} />
        <MiniStat icon={Icons.questions} label="Total Questions" value={totalQuestions} accent="#ec4899" delay={300} />
        <MiniStat icon={Icons.tests} label="Active Tests" value={stats?.data?.tests || 0} accent="#6366f1" delay={360} />
        <MiniStat icon={Icons.assignments} label="Assignments" value={assignmentsCount} accent="#14b8a6" delay={420} />
        <MiniStat icon={Icons.submissions} label="Submissions" value={totalResults} accent="#0ea5e9" delay={480} />
        <MiniStat icon={Icons.passed} label="Passed" value={broadsheetStatsLoading ? '...' : passedResults} accent="#22c55e" delay={540} />
        <MiniStat icon={Icons.failed} label="Failed" value={broadsheetStatsLoading ? '...' : failedResults} accent="#ef4444" delay={600} />
        <MiniStat icon={Icons.avgScore} label="Avg. Score" value={broadsheetStatsLoading ? '...' : `${averageScore}%`} accent="#f97316" delay={660} />
      </section>

      <section className="dash-section">
        <div className="dash-section__head">
          <h2 className="dash-section__title">
            <span className="dash-section__title-bar" />
            Quick Actions
          </h2>
        </div>
        <div className="dash-actions">
          <ActionLink to="/admin/teachers" icon={Icons.teachers} label="Manage Teachers" accent="#6366f1" index={0} />
          <ActionLink to="/admin/students" icon={Icons.students} label="Manage Students" accent="#10b981" index={1} />
          <ActionLink to="/admin/classes" icon={Icons.classes} label="Manage Classes" accent="#f59e0b" index={2} />
          <ActionLink to="/admin/subjects" icon={Icons.subjects} label="Manage Subjects" accent="#06b6d4" index={3} />
          <ActionLink to="/admin/assign-teachers" icon={Icons.assignments} label="Assign Teachers" accent="#14b8a6" index={4} />
          <ActionLink to="/admin/question-sets" icon={Icons.questionSets} label="Question Sets" accent="#8b5cf6" index={5} />
          <ActionLink to="/admin/tests" icon={Icons.tests} label="Manage Tests" accent="#ec4899" index={6} />
          <ActionLink to="/admin/results" icon={Icons.avgScore} label="View All Results" accent="#0ea5e9" index={7} />
          <ActionLink to="/admin/broadsheet" icon={Icons.classes} label="View Broadsheet" accent="#f59e0b" index={8} />
        </div>
      </section>

      {!broadsheetStatsLoading && (passedResults > 0 || failedResults > 0) && (
        <section className="dash-section">
          <div className="dash-section__head">
            <h2 className="dash-section__title">
              <span className="dash-section__title-bar" />
              Broadsheet Overview
            </h2>
            <Link to="/admin/broadsheet" className="dash-section__link">
              View Full Broadsheet {Icons.arrowRight}
            </Link>
          </div>

          <div className="dash-overview-row">
            <div className="dash-overview-card dash-overview-card--green">
              <div className="dash-overview-card__ring">
                <svg viewBox="0 0 36 36" className="dash-overview-card__ring-svg">
                  <path className="dash-overview-card__ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="dash-overview-card__ring-fill dash-overview-card__ring-fill--green" strokeDasharray={`${totalResults > 0 ? (passedResults / totalResults) * 100 : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
              <span className="dash-overview-card__num">{passedResults}</span>
              <span className="dash-overview-card__label">Passed</span>
            </div>
            <div className="dash-overview-card dash-overview-card--red">
              <div className="dash-overview-card__ring">
                <svg viewBox="0 0 36 36" className="dash-overview-card__ring-svg">
                  <path className="dash-overview-card__ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="dash-overview-card__ring-fill dash-overview-card__ring-fill--red" strokeDasharray={`${totalResults > 0 ? (failedResults / totalResults) * 100 : 0}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
              <span className="dash-overview-card__num">{failedResults}</span>
              <span className="dash-overview-card__label">Failed</span>
            </div>
            <div className="dash-overview-card dash-overview-card--blue">
              <div className="dash-overview-card__ring">
                <svg viewBox="0 0 36 36" className="dash-overview-card__ring-svg">
                  <path className="dash-overview-card__ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="dash-overview-card__ring-fill dash-overview-card__ring-fill--blue" strokeDasharray={`${averageScore}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
              <span className="dash-overview-card__num">{averageScore}%</span>
              <span className="dash-overview-card__label">Average Score</span>
            </div>
            <div className="dash-overview-card dash-overview-card--purple">
              <div className="dash-overview-card__ring">
                <svg viewBox="0 0 36 36" className="dash-overview-card__ring-svg">
                  <path className="dash-overview-card__ring-bg" d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                  <path className="dash-overview-card__ring-fill dash-overview-card__ring-fill--purple" strokeDasharray={`${passRate}, 100`} d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" />
                </svg>
              </div>
              <span className="dash-overview-card__num">{passRate}%</span>
              <span className="dash-overview-card__label">Pass Rate</span>
            </div>
          </div>

          {/* Pass Rate Progress Bar */}
          <div className="dash-progress-section">
            <div className="dash-progress-section__header">
              <span className="dash-progress-section__title">Overall Pass Rate</span>
              <span className="dash-progress-section__value" style={{ color: passRate >= 50 ? '#22c55e' : '#ef4444' }}>{passRate}%</span>
            </div>
            <PassRateBar rate={passRate} />
          </div>

          {broadsheetStatsData?.termInfo && (
            <div className="dash-term-info">
              <div className="dash-term-info__item">
                <span className="dash-term-info__label">Term</span>
                <span className="dash-term-info__value">{broadsheetStatsData.termInfo.name}</span>
              </div>
              <div className="dash-term-info__divider" />
              <div className="dash-term-info__item">
                <span className="dash-term-info__label">Session</span>
                <span className="dash-term-info__value">{broadsheetStatsData.sessionInfo.name}</span>
              </div>
              <div className="dash-term-info__divider" />
              <div className="dash-term-info__item">
                <span className="dash-term-info__label">Assessed</span>
                <span className="dash-term-info__value">{broadsheetStats.assessedStudents} of {broadsheetStats.totalStudents} students</span>
              </div>
            </div>
          )}

          {allResults.length > 0 && (
            <div className="dash-table-wrap" style={{ marginTop: '24px' }}>
              <div className="dash-table-wrap__head">
                <h3 className="dash-table-wrap__title">Recent Online Test Submissions</h3>
                <Link to="/admin/results" className="dash-table-wrap__link">See all {Icons.arrowRight}</Link>
              </div>
              <div className="dash-table-scroll">
                <table className="dash-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Test</th>
                      <th>Score</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {allResults.slice(0, 5).map((r, i) => (
                      <tr key={r._id || i}>
                        <td>
                          <div className="dash-table__student">
                            <span className="dash-table__avatar">{(r.studentId?.firstName?.[0] || '').toUpperCase()}{(r.studentId?.lastName?.[0] || '').toUpperCase()}</span>
                            <span className="dash-table__student-name">{r.studentId?.firstName} {r.studentId?.lastName}</span>
                          </div>
                        </td>
                        <td className="dash-table__muted">{r.testId?.title || '—'}</td>
                        <td>
                          <div className="dash-table__score-cell">
                            <div className="dash-table__score-bar-wrap">
                              <div className="dash-table__score-bar" style={{ width: `${r.percentage || 0}%`, background: r.percentage >= 50 ? '#22c55e' : '#ef4444' }} />
                            </div>
                            <strong>{r.percentage || 0}%</strong>
                            <span className="dash-table__muted">({r.score}/{r.totalQuestions || '?'})</span>
                          </div>
                        </td>
                        <td><StatusPill status={r.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </section>
      )}

      {!questionSetsLoading && questionSetsData?.data?.length > 0 && (
        <section className="dash-section">
          <div className="dash-section__head">
            <h2 className="dash-section__title">
              <span className="dash-section__title-bar" />
              Recent Question Sets
            </h2>
            <Link to="/admin/question-sets" className="dash-section__link">View All {Icons.arrowRight}</Link>
          </div>
          <div className="dash-table-wrap">
            <div className="dash-table-scroll">
              <table className="dash-table">
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Class</th>
                    <th>Subject</th>
                    <th>Questions</th>
                    <th>Created By</th>
                  </tr>
                </thead>
                <tbody>
                  {questionSetsData.data.slice(0, 5).map((qs) => (
                    <tr key={qs._id}>
                      <td><strong>{qs.title}</strong></td>
                      <td>
                        <span className="dash-table__tag">{qs.classId?.name || '—'}</span>
                      </td>
                      <td>
                        <span className="dash-table__tag dash-table__tag--sub">{qs.subjectId?.name || '—'}</span>
                      </td>
                      <td>
                        <span className="dash-badge">{qs.questions?.length || 0}</span>
                      </td>
                      <td className="dash-table__muted">{qs.teacherId ? `${qs.teacherId.firstName} ${qs.teacherId.lastName}` : 'Admin'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      <div className="dash-footer" />
    </div>
  );
};

export default AdminDashboard;