import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useDevice } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext';

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import TeacherDashboard from '../components/teacher/TeacherDashboard';
import CreateTest from '../components/teacher/CreateTest';
import QuestionSetManager from '../components/teacher/QuestionSetManager';
import BulkQuestionConverter from '../components/teacher/BulkQuestionConverter'; // ✅ ADDED IMPORT
import TestResults from '../components/teacher/TestResults';
import MyClasses from '../components/teacher/MyClasses';
import ENotesManager from '../pages/ENotesManager';
import ContinuousAssessment from '../components/teacher/ContinuousAssessment';
import Broadsheet from '../components/teacher/Broadsheet';
import MyStudents from '../components/teacher/MyStudents';
import TeacherSubmissions from '../components/teacher/TeacherSubmissions';
import TeacherProfile from '../components/teacher/TeacherProfile';

const teacherMenuItems = [
  { path: '/teacher', label: 'Dashboard', icon: '📊', exact: true },
  { path: '/teacher/classes', label: 'My Classes', icon: '🏫' },
  { path: '/teacher/e-notes', label: 'E-Notes', icon: '📒', featureKey: 'e_notes' },
  { path: '/teacher/my-students/:classId', label: 'My Students', icon: '👨‍🎓', hidden: true },
  
  { divider: true, label: 'GRADING' },
  { path: '/teacher/continuous-assessment', label: 'Enter CA', icon: '📝', featureKey: 'ca_upload' },
  { path: '/teacher/broadsheet', label: 'Broadsheet', icon: '📋', featureKey: 'broadsheet' },
  
  { divider: true, label: 'EXAMINATIONS' },
  // ✅ FIXED: Keys now match the CreateAdminModal exactly
  { path: '/teacher/question-sets', label: 'Question Sets', icon: '📚', featureKey: 'question_sets' },
  { path: '/teacher/bulk-converter', label: 'Bulk Convert', icon: '📤', featureKey: 'bulk_converter' }, // ✅ ADDED MENU ITEM
  { path: '/teacher/create-test', label: 'Create Test', icon: '✏️', featureKey: 'create_test' },
  { path: '/teacher/results', label: 'Test Results', icon: '📈', featureKey: 'results' },
  { path: '/teacher/submissions', label: 'Submissions', icon: '📨', featureKey: 'submissions' },
  
  { divider: true, label: 'ACCOUNT' },
  { path: '/teacher/profile', label: 'Profile', icon: '👤' },
];

const TeacherLayout = () => {
  const { isMobile } = useDevice();
  const { user } = useAuth();

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ✅ Filter menu items based on allowed features
  const visibleMenuItems = teacherMenuItems.filter(item => {
    if (!item.featureKey) return true;
    const features = user?.allowedFeatures?.teacher || {};
    return features[item.featureKey] !== false;
  });

  // ✅ Route Guard
  const guard = (featureKey, Component) => {
    const features = user?.allowedFeatures?.teacher || {};
    const hasAccess = features[featureKey] !== false;
    return hasAccess ? Component : <Navigate to="/teacher" replace />;
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
  const handleMobileClose = () => setSidebarOpen(false);

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
          title="Teacher Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<TeacherDashboard />} />
            <Route path="/classes" element={<MyClasses />} />
            <Route path="/e-notes" element={guard('e_notes', <ENotesManager />)} />
            <Route path="/my-students/:classId" element={<MyStudents />} />
            
            <Route path="/continuous-assessment" element={guard('ca_upload', <ContinuousAssessment />)} />
            <Route path="/broadsheet/:classId?" element={guard('broadsheet', <Broadsheet />)} />
            
            {/* ✅ FIXED: Guard keys match exactly */}
            <Route path="/question-sets" element={guard('question_sets', <QuestionSetManager />)} />
            {/* ✅ ADDED ROUTE */}
            <Route path="/bulk-converter" element={guard('bulk_converter', <BulkQuestionConverter />)} />
            <Route path="/create-test" element={guard('create_test', <CreateTest />)} />
            <Route path="/results" element={guard('results', <TestResults />)} />
            <Route path="/submissions" element={guard('submissions', <TeacherSubmissions />)} />
            
            <Route path="/profile" element={<TeacherProfile />} />
            <Route path="*" element={<Navigate to="/teacher" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default TeacherLayout;