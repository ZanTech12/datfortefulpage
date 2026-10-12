import React, { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { authAPI } from '../api';
import { useAuth } from '../context/AuthContext'; // ✅ Import useAuth
import { queryClient } from '../index';

// Optional: If you don't have these images, the UI will still look great with gradient backgrounds.
import res1 from './res1.jpg';
import res2 from './res2.jpg';
import res3 from './res3.jpg';
import logo from './logo.svg';

const SLIDES = [
  { img: res1, label: 'Smart Classrooms' },
  { img: res2, label: 'Campus Life' },
  { img: res3, label: 'Exam Halls' },
];

const Svg = (props) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={{ width: '1.25em', height: '1.25em', ...props.style }} {...props} />
);

const Icons = {
  admin: (<Svg><path d="M12 3l7 3v5.2c0 4.3-2.9 8.3-7 9.8-4.1-1.5-7-5.5-7-9.8V6l7-3z" /><path d="M9.2 12.3l1.9 1.9 3.7-4.2" /></Svg>),
  teacher: (<Svg><path d="M2 4.5h6.5A3.5 3.5 0 0 1 12 8v12a3 3 0 0 0-3-3H2V4.5z" /><path d="M22 4.5h-6.5A3.5 3.5 0 0 0 12 8v12a3 3 0 0 1 3-3h7V4.5z" /></Svg>),
  student: (<Svg><path d="M22 9.5l-10-5-10 5 10 5 10-5z" /><path d="M6.5 11.8v4.4c0 1.5 2.5 2.8 5.5 2.8s5.5-1.3 5.5-2.8v-4.4" /><path d="M22 9.5V14" /></Svg>),
  school: (<Svg><path d="M3 21h18" /><path d="M5 21V8l7-5 7 5v13" /><path d="M9.5 21v-4.5h5V21" /></Svg>),
  user: (<Svg><path d="M20 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H8.2A4.2 4.2 0 0 0 4 19.2V21" /><circle cx="12" cy="8" r="4" /></Svg>),
  lock: (<Svg><rect x="4" y="10.5" width="16" height="10" rx="2.5" /><path d="M8 10.5V7.5a4 4 0 0 1 8 0v3" /><path d="M12 14.5v2.5" /></Svg>),
  hash: (<Svg><path d="M4.5 9.5h15M4.5 14.5h15M10 3.5L8 20.5M16 3.5l-2 17" /></Svg>),
  shield: (<Svg><path d="M12 3l7 3v5.2c0 4.3-2.9 8.3-7 9.8-4.1-1.5-7-5.5-7-9.8V6l7-3z" /></Svg>),
  zap: (<Svg><path d="M13 2L4.5 13.5H11L9.5 22 19 10h-6.5L13 2z" /></Svg>),
  users: (<Svg><path d="M17 21v-1.8a4.2 4.2 0 0 0-4.2-4.2H6.2A4.2 4.2 0 0 0 2 19.2V21" /><circle cx="9.5" cy="8" r="3.5" /><path d="M22 21v-1.8a4.2 4.2 0 0 0-3.2-4.07" /><path d="M15.5 4.6a3.5 3.5 0 0 1 0 6.8" /></Svg>),
  alert: (<Svg><path d="M12 3L2.5 19.5h19L12 3z" /><path d="M12 9.5V14" /><path d="M12 17h.01" /></Svg>),
  eye: (<Svg width="18" height="18" style={{ width: '18px', height: '18px' }}><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" /><circle cx="12" cy="12" r="3" /></Svg>),
  eyeOff: (<Svg width="18" height="18" style={{ width: '18px', height: '18px' }}><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" /><line x1="1" y1="1" x2="23" y2="23" /></Svg>),
  arrow: (<Svg width="18" height="18" style={{ width: '18px', height: '18px' }}><path d="M5 12h14" /><path d="M13 6l6 6-6 6" /></Svg>),
};

/* ---------- Extract subdomain safely (Fixed for local IPs) ---------- */
const getSubdomain = () => {
  if (typeof window === 'undefined') return null;
  const host = window.location.hostname;
  
  // Ignore localhost and raw IP addresses (e.g., 192.168.1.5)
  if (host.includes('localhost') || host.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
    return null;
  }
  
  const parts = host.split('.');
  // Check for subdomain (e.g., BimTech.okispecial.com.ng or BimTech.lvh.me)
  if (parts.length >= 3 && parts[0] !== 'www') {
    return parts[0].toLowerCase().trim();
  }
  return null;
};

const LoginPage = () => {
  const navigate = useNavigate();
  const { login } = useAuth(); // ✅ Get the login function from AuthContext
  const [searchParams] = useSearchParams();
  const tokenFromUrl = searchParams.get('token') || '';

  // ✅ Auto-switch to Registration mode if token is in URL
  const [isRegistering, setIsRegistering] = useState(!!tokenFromUrl);

  const [selectedRole, setSelectedRole] = useState('admin');
  const [currentSlide, setCurrentSlide] = useState(0);
  const [formData, setFormData] = useState({ username: '', password: '', admissionNumber: '', firstName: '' });
  
  // ✅ Registration state
  const [regFormData, setRegFormData] = useState({
    token: tokenFromUrl,
    name: '',
    username: '',
    password: '',
    schoolName: ''
  });

  // ✅ School Code state (for Teachers/Students on direct link)
  const detectedSchoolCode = getSubdomain();
  const [schoolCode, setSchoolCode] = useState(detectedSchoolCode || '');

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  // Responsive hook
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 768);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const roles = [
    { id: 'admin', label: 'Admin', icon: Icons.admin },
    { id: 'teacher', label: 'Teacher', icon: Icons.teacher },
    { id: 'student', label: 'Student', icon: Icons.student },
  ];
  const activeRole = roles.find((r) => r.id === selectedRole);

  const nextSlide = useCallback(() => setCurrentSlide((prev) => (prev + 1) % SLIDES.length), []);
  useEffect(() => { 
    if (!isMobile) {
      const interval = setInterval(nextSlide, 5500); 
      return () => clearInterval(interval); 
    }
  }, [nextSlide, isMobile]);

  const handleChange = (e) => { setFormData({ ...formData, [e.target.name]: e.target.value }); setError(''); };
  const handleRegChange = (e) => { setRegFormData({ ...regFormData, [e.target.name]: e.target.value }); setError(''); };

  /* ==================== LOGIN SUBMIT ==================== */
  const handleLoginSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      let result;

      if (selectedRole === 'admin') {
        if (!formData.username || !formData.password) {
          setError('Username and password are required');
          setLoading(false);
          return;
        }
        result = await authAPI.login({
          role: 'admin',
          username: formData.username.trim(),       // ✅ NEW: trim — phones add trailing spaces
          password: formData.password,
        });
      } else if (selectedRole === 'teacher') {
        if (!formData.username || !formData.password) {
          setError('Username and password are required');
          setLoading(false);
          return;
        }
        result = await authAPI.login({
          role: 'teacher',
          username: formData.username.trim(),       // ✅ NEW: trim
          password: formData.password,
          schoolCode: schoolCode.trim(),            // ✅ FIXED: trim only — case preserved as typed
        });
      } else if (selectedRole === 'student') {
        if (!formData.admissionNumber || !formData.firstName) {
          setError('Admission Number and First Name are required');
          setLoading(false);
          return;
        }
        result = await authAPI.loginStudent({
          admissionNumber: formData.admissionNumber.trim(),   // ✅ NEW: trim
          firstName: formData.firstName.trim(),               // ✅ NEW: trim
          schoolCode: schoolCode.trim(),            // ✅ FIXED: trim only — case preserved as typed
        });
      }

      if (result.success) {
        queryClient.clear();
        // ✅ CHANGED: Use the login function from AuthContext
        // This updates localStorage AND the React state simultaneously!
        login(result.token, result.user);
        
        switch (result.user.role) {
          case 'admin': navigate('/admin'); break;
          case 'superadmin': navigate('/admin'); break;
          case 'teacher': navigate('/teacher'); break;
          case 'student': navigate('/student'); break;
          default: navigate('/');
        }
      } else {
        setError(result.message || 'Login failed');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during login');
    } finally {
      setLoading(false);
    }
  };

  /* ==================== REGISTER SUBMIT ==================== */
  const handleRegisterSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!regFormData.token || !regFormData.name || !regFormData.username || !regFormData.password) {
      setError('Token, Name, Username, and Password are all required.');
      setLoading(false);
      return;
    }

    try {
      const response = await authAPI.registerAdmin({
        ...regFormData,
        token: regFormData.token.trim(),           // ✅ NEW: trim — pasted tokens carry whitespace
        name: regFormData.name.trim(),             // ✅ NEW: trim
        username: regFormData.username.trim(),     // ✅ NEW: trim
        schoolName: regFormData.schoolName.trim(), // ✅ NEW: trim
      });
      
      if (response.success) {
        alert('Account created successfully! You can now log in.');
        setFormData({ ...formData, username: regFormData.username.trim() });
        setIsRegistering(false);
      } else {
        setError(response.message || 'Registration failed.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'An error occurred during registration.');
    } finally {
      setLoading(false);
    }
  };

  // --- Style Objects ---
  const containerStyle = {
    minHeight: '100vh',
    display: 'flex',
    backgroundColor: isMobile ? '#0f172a' : '#f8fafc',
    fontFamily: 'system-ui, -apple-system, sans-serif',
    flexDirection: isMobile ? 'column' : 'row',
    overflowX: 'hidden'
  };

  const brandPanelStyle = {
    flex: isMobile ? 'none' : '1',
    height: isMobile ? '140px' : 'auto',
    backgroundColor: '#1e293b',
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
    padding: isMobile ? '1rem' : '3rem',
    textAlign: 'center',
    position: 'relative',
    overflow: 'hidden',
    borderBottomLeftRadius: isMobile ? '20px' : '0',
    borderBottomRightRadius: isMobile ? '20px' : '0'
  };

  const formPanelStyle = {
    flex: '1',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: isMobile ? '1.5rem 1.5rem 2rem' : '2rem',
    backgroundColor: isMobile ? 'transparent' : '#f8fafc'
  };

  const loginCardStyle = {
    width: '100%',
    maxWidth: '450px',
    backgroundColor: isMobile ? 'transparent' : 'white',
    padding: isMobile ? '0' : '2.5rem',
    borderRadius: isMobile ? '0' : '16px',
    boxShadow: isMobile ? 'none' : '0 10px 25px rgba(0,0,0,0.05)',
    border: isMobile ? 'none' : '1px solid #e2e8f0'
  };

  const headerStyle = {
    textAlign: 'center',
    marginBottom: isMobile ? '1.5rem' : '2rem'
  };

  const titleStyle = {
    fontSize: isMobile ? '1.5rem' : '1.75rem',
    fontWeight: '700',
    color: isMobile ? 'white' : '#0f172a',
    margin: '0 0 0.5rem 0'
  };

  const subTitleStyle = {
    color: isMobile ? '#94a3b8' : '#64748b',
    fontSize: '0.9rem',
    margin: 0
  };

  const roleSwitchStyle = {
    display: 'flex',
    backgroundColor: isMobile ? 'rgba(255,255,255,0.1)' : '#f1f5f9',
    borderRadius: '8px',
    padding: '4px',
    marginBottom: '1.5rem',
    gap: '4px'
  };

  const roleBtnStyle = (isActive) => ({
    flex: 1,
    padding: '0.5rem 0.5rem',
    border: 'none',
    backgroundColor: isActive ? (isMobile ? '#1e293b' : 'white') : 'transparent',
    color: isActive ? (isMobile ? 'white' : '#2563eb') : (isMobile ? '#94a3b8' : '#64748b'),
    fontWeight: isActive ? '600' : '500',
    borderRadius: '6px',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '6px',
    fontSize: '0.8rem',
    transition: 'all 0.2s',
    boxShadow: isActive ? (isMobile ? '0 2px 4px rgba(0,0,0,0.2)' : '0 2px 4px rgba(0,0,0,0.05)') : 'none'
  });

  const fieldStyle = {
    position: 'relative',
    marginBottom: '1rem'
  };

  const labelStyle = {
    display: 'block',
    marginBottom: '0.4rem',
    fontSize: '0.8rem',
    color: isMobile ? '#cbd5e1' : '#334155',
    fontWeight: '500'
  };

  const inputStyle = {
    width: '100%',
    padding: '0.7rem 1rem',
    backgroundColor: isMobile ? 'rgba(255,255,255,0.05)' : 'white',
    border: `1px solid ${isMobile ? '#334155' : '#cbd5e1'}`,
    borderRadius: '6px',
    fontSize: '1rem',
    color: isMobile ? 'white' : '#0f172a',
    boxSizing: 'border-box',
    outline: 'none',
    transition: 'border-color 0.2s',
    paddingRight: '2.5rem'
  };

  const fieldIconStyle = {
    position: 'absolute',
    right: '15px',
    top: '35px',
    color: isMobile ? '#64748b' : '#94a3b8',
    pointerEvents: 'none',
    display: 'flex',
    alignItems: 'center'
  };

  const btnStyle = {
    width: '100%',
    padding: '0.8rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: '8px',
    transition: 'background-color 0.2s',
    marginTop: '0.5rem'
  };

  const alertStyle = {
    backgroundColor: isMobile ? 'rgba(239, 68, 68, 0.1)' : '#fef2f2',
    color: '#f87171',
    border: `1px solid ${isMobile ? 'rgba(239, 68, 68, 0.2)' : '#fecaca'}`,
    padding: '0.6rem 1rem',
    borderRadius: '6px',
    fontSize: '0.85rem',
    marginBottom: '1rem',
    display: 'flex',
    alignItems: 'center',
    gap: '8px'
  };

  const schoolPillStyle = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: '6px',
    backgroundColor: isMobile ? 'rgba(59, 130, 246, 0.1)' : '#eff6ff',
    color: isMobile ? '#93c5fd' : '#1e40af',
    padding: '0.4rem 0.8rem',
    borderRadius: '20px',
    fontSize: '0.8rem',
    fontWeight: '600',
    marginBottom: '1rem',
    border: `1px solid ${isMobile ? 'rgba(59, 130, 246, 0.2)' : '#bfdbfe'}`
  };

  return (
    <div style={containerStyle}>
      {/* ======== LEFT — Brand / Showcase panel ======== */}
      <aside style={brandPanelStyle}>
        {isMobile ? (
          // Mobile Brand Header
          <>
            <img src={logo} alt="Logo" style={{ height: '30px', marginBottom: '0.5rem', filter: 'brightness(0) invert(1)' }} />
            <h1 style={{ fontSize: '1.2rem', fontWeight: '700', margin: 0, color: 'white' }}>
              BimTech SaaS CBT
            </h1>
          </>
        ) : (
          // Desktop Brand Panel
          <div style={{ width: '100%', maxWidth: '500px' }}>
            <img src={logo} alt="Logo" style={{ height: '40px', marginBottom: '2rem', filter: 'brightness(0) invert(1)' }} />
            <h1 style={{ fontSize: '2.5rem', fontWeight: '800', lineHeight: '1.2', margin: 0 }}>
              Smarter exams.<br />
              <span style={{ background: 'linear-gradient(to right, #60a5fa, #3b82f6)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
                Seamless learning.
              </span>
            </h1>
            <p style={{ fontSize: '1rem', color: '#94a3b8', marginTop: '1rem', maxWidth: '400px' }}>
              One secure platform for administrators, teachers and students — run computer-based tests with total confidence.
            </p>

            {/* Slideshow */}
            <div style={{ position: 'relative', height: '250px', borderRadius: '12px', overflow: 'hidden', marginBottom: '2rem', marginTop: '2rem' }}>
              {SLIDES.map((slide, i) => (
                <div key={i} style={{
                  position: 'absolute',
                  top: 0, left: 0, right: 0, bottom: 0,
                  backgroundImage: `url(${slide.img})`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                  opacity: currentSlide === i ? 1 : 0,
                  transition: 'opacity 1s ease-in-out'
                }} />
              ))}
              <div style={{ position: 'absolute', bottom: '15px', left: '15px', backgroundColor: 'rgba(0,0,0,0.6)', color: 'white', padding: '5px 12px', borderRadius: '20px', fontSize: '0.8rem' }}>
                {SLIDES[currentSlide].label}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px' }}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>{Icons.shield} Secure & Encrypted</span>
              <span style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '0.85rem', color: '#cbd5e1' }}>{Icons.zap} Real-time Results</span>
            </div>
          </div>
        )}
      </aside>

      {/* ======== RIGHT — Form panel ======== */}
      <main style={formPanelStyle}>
        <div style={loginCardStyle}>
          
          <div style={headerStyle}>
            {!isMobile && (
              <div style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: '50px', height: '50px', backgroundColor: '#eff6ff', borderRadius: '12px', color: '#2563eb', marginBottom: '1rem' }}>
                {Icons.lock}
              </div>
            )}
            <h2 style={titleStyle}>{isRegistering ? 'Register Your School' : 'Welcome back'}</h2>
            <p style={subTitleStyle}>
              {isRegistering ? 'Enter your token and details to create an account.' : 'Sign in to continue to your dashboard'}
            </p>
          </div>

          {/* Role switcher (Hidden during registration) */}
          {!isRegistering && (
            <div style={roleSwitchStyle}>
              {roles.map((role) => (
                <button 
                  key={role.id} 
                  type="button" 
                  style={roleBtnStyle(selectedRole === role.id)} 
                  onClick={() => { setSelectedRole(role.id); setError(''); }}
                >
                  {role.icon}<span>{role.label}</span>
                </button>
              ))}
            </div>
          )}

          {/* Detected school badge */}
          {!isRegistering && detectedSchoolCode && selectedRole !== 'admin' && (
            <div style={{ textAlign: 'center' }}>
              <span style={schoolPillStyle}>
                <span style={{ width: '8px', height: '8px', backgroundColor: '#10b981', borderRadius: '50%' }}></span>
                {Icons.school}
                School: {detectedSchoolCode}
              </span>
            </div>
          )}

          {error && (
            <div style={alertStyle} role="alert">
              {Icons.alert}
              <span>{error}</span>
            </div>
          )}

          {/* ============== LOGIN FORM ============== */}
          {!isRegistering ? (
            <form onSubmit={handleLoginSubmit}>
              {/* Conditional School Code Field */}
              {selectedRole !== 'admin' && !detectedSchoolCode && (
                <div style={fieldStyle}>
                  <label style={labelStyle} htmlFor="schoolCode">School Code</label>
                  <input
                    id="schoolCode"
                    type="text"
                    style={inputStyle}
                    value={schoolCode}
                    onChange={(e) => setSchoolCode(e.target.value)}   // ✅ FIXED: removed .toUpperCase() — small letters now work
                    required
                    placeholder="e.g. BimTech"
                    autoComplete="organization"
                    autoCapitalize="none"      // ✅ NEW
                    autoCorrect="off"          // ✅ NEW
                    spellCheck="false"         // ✅ NEW
                  />
                  <span style={fieldIconStyle}>{Icons.school}</span>
                </div>
              )}

              {(selectedRole === 'admin' || selectedRole === 'teacher') && (
                <>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="username">Username</label>
                    <input
                      id="username"
                      type="text"
                      name="username"
                      style={inputStyle}
                      value={formData.username}
                      onChange={handleChange}
                      placeholder="Enter username"
                      autoComplete="username"
                      autoCapitalize="none"      // ✅ NEW: phones capitalize first letter by default
                      autoCorrect="off"          // ✅ NEW: phones autocorrect usernames
                      spellCheck="false"         // ✅ NEW: no red squiggles/alterations
                      required
                    />
                    <span style={fieldIconStyle}>{Icons.user}</span>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="password">Password</label>
                    <input id="password" type={showPassword ? 'text' : 'password'} name="password" style={inputStyle} value={formData.password} onChange={handleChange} placeholder="Enter password" autoComplete="current-password" required />
                    <span style={fieldIconStyle}>
                      <button type="button" onClick={() => setShowPassword(!showPassword)} style={{ background: 'none', border: 'none', cursor: 'pointer', color: isMobile ? '#64748b' : '#94a3b8', padding: 0, display: 'flex' }}>
                        {showPassword ? Icons.eyeOff : Icons.eye}
                      </button>
                    </span>
                  </div>
                </>
              )}

              {selectedRole === 'student' && (
                <>
                  <div style={{ backgroundColor: isMobile ? 'rgba(59, 130, 246, 0.1)' : '#f0f9ff', border: `1px solid ${isMobile ? 'rgba(59, 130, 246, 0.2)' : '#bae6fd'}`, color: isMobile ? '#93c5fd' : '#0369a1', padding: '0.6rem 1rem', borderRadius: '6px', fontSize: '0.8rem', marginBottom: '1rem', display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {Icons.student}
                    <span>Student access — no password needed, just verify your identity.</span>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="admissionNumber">Admission Number</label>
                    <input
                      id="admissionNumber"
                      type="text"
                      name="admissionNumber"
                      style={inputStyle}
                      value={formData.admissionNumber}
                      onChange={handleChange}
                      placeholder="e.g. DIS/2025/001"
                      required
                      autoFocus
                      autoCapitalize="none"      // ✅ NEW
                      autoCorrect="off"          // ✅ NEW
                      spellCheck="false"         // ✅ NEW
                    />
                    <span style={fieldIconStyle}>{Icons.hash}</span>
                  </div>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px', margin: '0.5rem 0' }}>
                    <div style={{ flex: 1, height: '1px', backgroundColor: isMobile ? '#334155' : '#e2e8f0' }}></div>
                    <span style={{ fontSize: '0.75rem', color: isMobile ? '#64748b' : '#94a3b8' }}>verify identity</span>
                    <div style={{ flex: 1, height: '1px', backgroundColor: isMobile ? '#334155' : '#e2e8f0' }}></div>
                  </div>
                  <div style={fieldStyle}>
                    <label style={labelStyle} htmlFor="firstName">First Name</label>
                    <input id="firstName" type="text" name="firstName" style={inputStyle} value={formData.firstName} onChange={handleChange} placeholder="Enter your first name" required />
                    <span style={fieldIconStyle}>{Icons.user}</span>
                  </div>
                </>
              )}

              <button type="submit" style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? 'Signing in…' : (<>Sign in as {activeRole.label} {Icons.arrow}</>)}
              </button>

              {selectedRole === 'admin' && (
                <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: isMobile ? '#94a3b8' : '#64748b' }}>
                  First time? Received a registration link?{' '}
                  <button type="button" onClick={() => setIsRegistering(true)} style={{ color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>
                    Register your school here
                  </button>
                </div>
              )}
            </form>
          ) : (
            /* ============== REGISTER FORM ============== */
            <form onSubmit={handleRegisterSubmit}>
              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="token">Registration Token</label>
                <input id="token" type="text" name="token" style={inputStyle} value={regFormData.token} onChange={handleRegChange} placeholder="Paste your registration token here" required readOnly={!!tokenFromUrl} autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                <span style={fieldIconStyle}>{Icons.lock}</span>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="schoolName">School Name (Optional)</label>
                <input id="schoolName" type="text" name="schoolName" style={inputStyle} value={regFormData.schoolName} onChange={handleRegChange} placeholder="Leave blank if assigned by SuperAdmin" />
                <span style={fieldIconStyle}>{Icons.school}</span>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="regName">Principal / Admin Name</label>
                <input id="regName" type="text" name="name" style={inputStyle} value={regFormData.name} onChange={handleRegChange} placeholder="Enter your full name" required />
                <span style={fieldIconStyle}>{Icons.user}</span>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="regUsername">Login Username</label>
                <input id="regUsername" type="text" name="username" style={inputStyle} value={regFormData.username} onChange={handleRegChange} placeholder="Choose a username" required autoCapitalize="none" autoCorrect="off" spellCheck="false" />
                <span style={fieldIconStyle}>{Icons.user}</span>
              </div>

              <div style={fieldStyle}>
                <label style={labelStyle} htmlFor="regPassword">Password</label>
                <input id="regPassword" type="password" name="password" style={inputStyle} value={regFormData.password} onChange={handleRegChange} placeholder="Choose a password" required />
                <span style={fieldIconStyle}>{Icons.lock}</span>
              </div>

              <button type="submit" style={{ ...btnStyle, opacity: loading ? 0.7 : 1 }} disabled={loading}>
                {loading ? 'Creating Account…' : (<>Create Account {Icons.arrow}</>)}
              </button>

              <div style={{ textAlign: 'center', marginTop: '1.5rem', fontSize: '0.85rem', color: isMobile ? '#94a3b8' : '#64748b' }}>
                Already have an account?{' '}
                <button type="button" onClick={() => setIsRegistering(false)} style={{ color: '#3b82f6', fontWeight: 600, background: 'none', border: 'none', cursor: 'pointer', padding: 0, fontSize: '0.85rem' }}>
                  Login here
                </button>
              </div>
            </form>
          )}

          <div style={{ textAlign: 'center', marginTop: '2rem', fontSize: '0.75rem', color: isMobile ? '#475569' : '#94a3b8' }}>
            <span>© {new Date().getFullYear()} BimTech SaaS Solutions • Secure CBT System</span>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LoginPage;