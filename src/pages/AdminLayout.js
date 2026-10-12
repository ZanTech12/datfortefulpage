import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDevice } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext'; // ✅ Import useAuth

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import AdminDashboard from '../components/admin/AdminDashboard';
import ManageTeachers from '../components/admin/ManageTeachers';
import ManageStudents from '../components/admin/ManageStudents';
import ManageClasses from '../components/admin/ManageClasses';
import ManageSubjects from '../components/admin/ManageSubjects';
import ManageTests from '../components/admin/ManageTests';
import AssignTeachers from '../components/admin/AssignTeachers';
import QuestionSetManager from '../components/admin/QuestionSetManager';
import StudentResultsView from '../components/admin/StudentResultsView';
import RecycleBin from '../components/admin/RecycleBin';
import Settings from '../components/admin/Settings';
import SiteSettings from '../components/admin/SiteSettings';
import BulkQuestionConverter from '../components/admin/BulkQuestionConverter';
import SyncPage from './SyncPage';
import ENotesManager from '../pages/ENotesManager';
import PinGenerator from '../components/admin/PinGenerator';
import SessionsManager from '../components/admin/SessionsManager';
import TermsManager from '../components/admin/TermsManager';
import GradingSystem from '../components/admin/GradingSystem';
import ApproveAssessments from '../components/admin/ApproveAssessments';
import PrincipalComments from '../components/admin/PrincipalComments';
import ReportCards from '../components/admin/ReportCards';
import ClassReportCards from '../components/admin/ClassReportCards';
import StudentReportCard from '../components/admin/StudentReportCard';
import ReportCardsPrintView from '../components/admin/ReportCardsPrintView';
import AdminCATeacherProgress from '../components/admin/AdminCATeacherProgress';
import StudentsClassesScoresPage from '../components/admin/StudentsClassesScoresPage';
import Broadsheet from '../components/admin/Broadsheet';
import NetworkSettings from '../components/admin/NetworkSettings';
import PromoteStudents from '../components/admin/PromoteStudents'; // ✅ NEW: Promotion

import './adminlayout.css';

const adminMenuItems = [
  { path: '/admin', label: 'Dashboard', icon: '📊', exact: true, featureKey: 'dashboard' },
  { path: '/admin/teachers', label: 'Teachers', icon: '👨‍🏫', featureKey: 'teachers' },
  { path: '/admin/students', label: 'Students', icon: '👨‍🎓', featureKey: 'students' },
  { path: '/admin/recycle-bin', label: 'Recycle Bin', icon: '🗑️', featureKey: 'recycle_bin' },
  { path: '/admin/classes', label: 'Classes', icon: '🏫', featureKey: 'classes' },
  { path: '/admin/subjects', label: 'Subjects', icon: '📚', featureKey: 'subjects' },
  { path: '/admin/assign-teachers', label: 'Assign Teachers', icon: '🔗', featureKey: 'assign_teachers' },
  { path: '/admin/e-notes', label: 'E-Notes', icon: '📒', featureKey: 'e_notes' },
  { divider: true, label: 'GRADING SYSTEM' },
  { path: '/admin/sessions', label: 'Sessions', icon: '📅', featureKey: 'sessions' },
  { path: '/admin/terms', label: 'Terms', icon: '📝', featureKey: 'terms' },
  { path: '/admin/grading-system', label: 'Grading System', icon: '📈', featureKey: 'grading_system' },
  { path: '/admin/approve-assessments', label: 'Approve CA', icon: '✅', featureKey: 'approve_ca' },
  { path: '/admin/students-classes-scores', label: 'Classes & Scores', icon: '📊', featureKey: 'classes_scores' },
  { path: '/admin/ca-progress', label: 'CA Progress', icon: '📈', featureKey: 'ca_progress' },
  { path: '/admin/principal-comments', label: 'Comments', icon: '💬', featureKey: 'comments' },
  { path: '/admin/broadsheet', label: 'Broadsheet', icon: '📋', featureKey: 'broadsheet' },
  { path: '/admin/result-pins', label: 'Result PINs', icon: '🔑', featureKey: 'result_pins' }, 
  { path: '/admin/report-cards', label: 'Report Cards', icon: '📄', featureKey: 'report_cards' },
  { divider: true, label: 'EXAMINATIONS' },
  { path: '/admin/question-sets', label: 'Question Sets', icon: '📑', featureKey: 'question_sets' },
  { path: '/admin/tests', label: 'Tests', icon: '📝', featureKey: 'tests' },
  { path: '/admin/results', label: 'Test Results', icon: '📊', featureKey: 'results' },
  { path: '/admin/bulk-converter', label: 'AI Converter', icon: '🤖', featureKey: 'bulk_converter' },
  { divider: true, label: 'SYSTEM' },
  { path: '/admin/sync', label: 'Database Sync', icon: '🔄', featureKey: 'database_sync' },
  { path: '/admin/network-settings', label: 'Network Settings', icon: '🌐', featureKey: 'site_settings' }, 
  { path: '/admin/promotion', label: 'Promotion', icon: '🎓', featureKey: 'site_settings' }, // ✅ NEW: Promotion menu item
  { path: '/admin/settings', label: 'Settings', icon: '⚙️', featureKey: 'settings' },
  { path: '/admin/sitesettings', label: 'Site Settings', icon: '🚀', featureKey: 'site_settings' },
];

const AdminLayout = () => {
  const { isMobile } = useDevice();
  const { user } = useAuth(); // ✅ Get the logged-in user

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ✅ Filter menu items based on user role and allowed features
  const visibleMenuItems = adminMenuItems.filter(item => {
    if (user?.role === 'superadmin') return true;
    if (item.superAdminOnly) return false;
    if (!item.featureKey) return true;
    
    const features = user?.allowedFeatures?.[user.role] || {};
    return features[item.featureKey] !== false;
  });

  // ✅ Route Guard: Checks if user has access to the feature
  const guard = (featureKey, Component) => {
    if (user?.role === 'superadmin') return Component;
    
    const features = user?.allowedFeatures?.[user.role] || {};
    const hasAccess = features[featureKey] !== false;
    
    return hasAccess ? Component : <Navigate to="/admin" replace />;
  };

  useEffect(() => {
    if (!isMobile) setSidebarOpen(false);
  }, [isMobile]);

  useEffect(() => {
    document.body.style.overflow = sidebarOpen ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [sidebarOpen]);

  const handleDesktopToggle = () => { if (!isMobile) setSidebarCollapsed(prev => !prev); };
  const handleMobileOpen = () => { if (isMobile) setSidebarOpen(true); };
  const handleMobileClose = () => { setSidebarOpen(false); };

  return (
    <div className={`layout-container ${!isMobile && sidebarCollapsed ? 'sidebar-collapsed' : ''}`}>
      {isMobile && sidebarOpen && (
        <div className="sidebar-backdrop" onClick={handleMobileClose} aria-hidden="true" />
      )}

      <Sidebar
        items={visibleMenuItems}
        collapsed={!isMobile && sidebarCollapsed}
        isOpen={isMobile && sidebarOpen}
        onCloseMobile={handleMobileClose}
      />

      <div className="main-content">
        <Header
          title="Admin Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            {/* Core Routes ✅ Wrapped with guard() */}
            <Route path="/" element={<AdminDashboard />} />
            <Route path="/teachers" element={guard('teachers', <ManageTeachers />)} />
            <Route path="/students" element={guard('students', <ManageStudents />)} />
            <Route path="/recycle-bin" element={guard('recycle_bin', <RecycleBin />)} />
            <Route path="/classes" element={guard('classes', <ManageClasses />)} />
            <Route path="/subjects" element={guard('subjects', <ManageSubjects />)} />
            <Route path="/assign-teachers" element={guard('assign_teachers', <AssignTeachers />)} />
            <Route path="/e-notes" element={guard('e_notes', <ENotesManager />)} />

            {/* Grading System Routes */}
            <Route path="/sessions" element={guard('sessions', <SessionsManager />)} />
            <Route path="/terms" element={guard('terms', <TermsManager />)} />
            <Route path="/grading-system" element={guard('grading_system', <GradingSystem />)} />
            <Route path="/approve-assessments" element={guard('approve_ca', <ApproveAssessments />)} />
            <Route path="/students-classes-scores" element={guard('classes_scores', <StudentsClassesScoresPage />)} />
            <Route path="/ca-progress" element={guard('ca_progress', <AdminCATeacherProgress />)} />
            <Route path="/principal-comments" element={guard('comments', <PrincipalComments />)} />
            <Route path="/broadsheet/:classId?" element={guard('broadsheet', <Broadsheet />)} />
            <Route path="/result-pins" element={guard('result_pins', <PinGenerator />)} /> 
            <Route path="/report-cards" element={guard('report_cards', <ReportCards />)} />
            <Route path="/report-cards/class/:classId" element={guard('report_cards', <ClassReportCards />)} />
            <Route path="/report-cards/student/:studentId" element={guard('report_cards', <StudentReportCard />)} />
            <Route path="/report-cards/print" element={guard('report_cards', <ReportCardsPrintView />)} />

            {/* Examination Routes */}
            <Route path="/question-sets" element={guard('question_sets', <QuestionSetManager />)} />
            <Route path="/tests" element={guard('tests', <ManageTests />)} />
            <Route path="/results" element={guard('results', <StudentResultsView />)} />
            <Route path="/bulk-converter" element={guard('bulk_converter', <BulkQuestionConverter />)} />

            {/* System Routes */}
            <Route path="/sync" element={guard('database_sync', <SyncPage />)} />
            <Route path="/network-settings" element={guard('site_settings', <NetworkSettings />)} />
            <Route path="/promotion" element={guard('site_settings', <PromoteStudents />)} /> {/* ✅ NEW: Promotion route */}
            <Route path="/settings" element={guard('settings', <Settings />)} />
            <Route path="/sitesettings" element={guard('site_settings', <SiteSettings />)} />

            <Route path="*" element={<Navigate to="/admin" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default AdminLayout;