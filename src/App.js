import React, { useState } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { getUserRole, isAuthenticated } from './api';

// Pages
import LoginPage from './pages/LoginPage';
import AdminLayout from './pages/AdminLayout';
import TeacherLayout from './pages/TeacherLayout';
import StudentLayout from './pages/StudentLayout';
import { LayoutProvider } from './context/LayoutContext';
import { DeviceProvider } from './context/DeviceContext';
import { AuthProvider } from './context/AuthContext'; // ✅ ADDED: Import AuthProvider

// Components
import PrivateRoute from './components/common/PrivateRoute';
import BrandedSplash from './components/BrandedSplash'; // ✅ ADDED: branded splash

function App() {
  // ✅ ADDED: splash shows on every app open.
  // For "once per session" (skips it on window reload), use instead:
  //   useState(() => !sessionStorage.getItem('splashSeen'))
  // and in onFinish:
  //   () => { sessionStorage.setItem('splashSeen', '1'); setShowSplash(false); }
  const [showSplash, setShowSplash] = useState(true);

  return (
    <>
      {/* ✅ ADDED: covers the whole screen (position: fixed, z-index 9999)
          while mounted. The app + auth check keep running underneath it,
          so by the time the splash finishes, the user lands directly
          on their correct screen. */}
      {showSplash && <BrandedSplash onFinish={() => setShowSplash(false)} />}

      <DeviceProvider>
        {/* ✅ ADDED: Wrap everything inside AuthProvider */}
        <AuthProvider>
          <LayoutProvider>
            <Routes>
              {/* Public Routes */}
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<LoginPage />} /> {/* ✅ Points to LoginPage! */}

              {/* Admin Routes */}
              <Route
                path="/admin/*"
                element={
                  <PrivateRoute allowedRoles={['admin', 'superadmin']}>
                    <AdminLayout />
                  </PrivateRoute>
                }
              />

              {/* Teacher Routes */}
              <Route
                path="/teacher/*"
                element={
                  <PrivateRoute allowedRoles={['teacher']}>
                    <TeacherLayout />
                  </PrivateRoute>
                }
              />

              {/* Student Routes */}
              <Route
                path="/student/*"
                element={
                  <PrivateRoute allowedRoles={['student']}>
                    <StudentLayout />
                  </PrivateRoute>
                }
              />

              <Route path="/" element={<RootRedirect />} />

              <Route
                path="*"
                element={
                  <div className="not-found">
                    <h1>404</h1>
                    <p>Page not found</p>
                    <a href="/">Go Home</a>
                  </div>
                }
              />
            </Routes>
          </LayoutProvider>
        </AuthProvider>
      </DeviceProvider>
    </>
  );
};

const RootRedirect = () => {
  const role = getUserRole();
  const authenticated = isAuthenticated();

  if (!authenticated) {
    return <Navigate to="/login" />;
  }

  switch (role) {
    case 'admin':
    case 'superadmin':
      return <Navigate to="/admin" />;
    case 'teacher':
      return <Navigate to="/teacher" />;
    case 'student':
      return <Navigate to="/student" />;
    default:
      return <Navigate to="/login" />;
  }
};

export default App;