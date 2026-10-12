import React, { useState, useEffect } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useLayout } from '../context/LayoutContext';
import { useDevice } from '../context/DeviceContext';
import { useAuth } from '../context/AuthContext'; // ✅ Import useAuth

import Header from '../components/common/Header';
import Sidebar from '../components/common/Sidebar';
import StudentDashboard from '../components/student/StudentDashboard';
import TestList from '../components/student/TestList';
import TakeTest from '../components/student/TakeTest';
import MyResults from '../components/student/MyResults';
import StudentReportCard from '../components/student/StudentReportCard';
import StudentProfile from '../components/student/StudentProfile';
import StudentENotes from '../pages/StudentENotes';

const studentMenuItems = [
  { path: '/student', label: 'Dashboard', icon: '📊', exact: true },
  { divider: true, label: 'EXAMINATIONS' },
  { path: '/student/tests', label: 'Available Tests', icon: '📝', featureKey: 'take_tests' },
  { path: '/student/results', label: 'Test Results', icon: '📈', featureKey: 'view_results' },
  // ✅ FIXED: Keys now match the CreateAdminModal exactly
  { path: '/student/schedule', label: 'Test Schedule', icon: '📅', featureKey: 'schedule' },
  { divider: true, label: 'ACADEMICS' },
  { path: '/student/report-card', label: 'My Grades', icon: '📋', featureKey: 'report_card' },
  { path: '/student/e-notes', label: 'E-Notes', icon: '📒', featureKey: 'e_notes' },
  { divider: true, label: 'ACCOUNT' },
  { path: '/student/profile', label: 'Profile', icon: '👤' },
];

const StudentLayout = () => {
  const { layoutHidden } = useLayout();
  const { isMobile } = useDevice();
  const { user } = useAuth(); // ✅ Get the logged-in user

  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  // ✅ Filter menu items based on allowed features
  const visibleMenuItems = studentMenuItems.filter(item => {
    if (!item.featureKey) return true;
    const features = user?.allowedFeatures?.student || {};
    return features[item.featureKey] !== false;
  });

  // ✅ Route Guard
  const guard = (featureKey, Component) => {
    const features = user?.allowedFeatures?.student || {};
    const hasAccess = features[featureKey] !== false;
    return hasAccess ? Component : <Navigate to="/student" replace />;
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

  // Fullscreen mode for TakeTest
  if (layoutHidden) {
    return (
      <Routes>
        <Route path="/" element={<StudentDashboard />} />
        <Route path="/tests" element={guard('take_tests', <TestList />)} />
        <Route path="/tests/:testId" element={guard('take_tests', <TakeTest />)} />
        <Route path="/results" element={guard('view_results', <MyResults />)} />
        <Route path="/schedule" element={guard('schedule', <TestList showSchedule />)} />
        <Route path="/report-card" element={guard('report_card', <StudentReportCard />)} />
        <Route path="/e-notes" element={guard('e_notes', <StudentENotes />)} />
        <Route path="/profile" element={<StudentProfile />} />
        <Route path="*" element={<Navigate to="/student" replace />} />
      </Routes>
    );
  }

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
          title="Student Panel"
          onToggleSidebar={handleDesktopToggle}
          onMobileMenuClick={handleMobileOpen}
          showMobileMenu={isMobile}
        />
        <div className="page-content">
          <Routes>
            <Route path="/" element={<StudentDashboard />} />
            <Route path="/tests" element={guard('take_tests', <TestList />)} />
            <Route path="/tests/:testId" element={guard('take_tests', <TakeTest />)} />
            <Route path="/results" element={guard('view_results', <MyResults />)} />
            <Route path="/schedule" element={guard('schedule', <TestList showSchedule />)} />
            <Route path="/report-card" element={guard('report_card', <StudentReportCard />)} />
            <Route path="/e-notes" element={guard('e_notes', <StudentENotes />)} />
            <Route path="/profile" element={<StudentProfile />} />
            <Route path="*" element={<Navigate to="/student" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
};

export default StudentLayout;