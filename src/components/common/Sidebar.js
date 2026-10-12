import React, { useEffect, useState } from 'react';
import { NavLink, useLocation } from 'react-router-dom';
import { useSchoolSettings } from '../../hooks/useSchoolSettings';
import './sidebar.css';

const Sidebar = ({ items, collapsed, isOpen, onCloseMobile }) => {
  const location = useLocation();
  const [hoveredIndex, setHoveredIndex] = useState(null);
  const site = useSchoolSettings();
  const [shortName, setShortName] = useState('School');

  useEffect(() => {
    if (site.shortName) setShortName(site.shortName);
  }, [site.shortName]);

  // Auto-close mobile drawer when route changes
  useEffect(() => {
    if (isOpen) onCloseMobile();
  }, [location.pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  // Clear hovered tooltip when sidebar collapses
  useEffect(() => {
    if (collapsed) setHoveredIndex(null);
  }, [collapsed]);

  const logoUrl = site.logoUrl || '';

  // ✅ Inline Style Objects
  const asideStyle = {
    width: collapsed ? '80px' : '280px',
    height: '100vh',
    position: 'fixed',
    top: 0,
    left: 0,
    backgroundColor: '#0f172a', // slate-900
    color: 'white',
    display: 'flex',
    flexDirection: 'column',
    transition: 'width 0.3s ease',
    zIndex: 1000,
    boxShadow: '4px 0 15px rgba(0,0,0,0.2)',
    overflowY: 'auto',
    overflowX: 'hidden'
  };

  const dividerStyle = {
    fontSize: '0.7rem',
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: '0.08em',
    color: '#64748b', // slate-500
    padding: '1.5rem 1.25rem 0.5rem 1.25rem',
    marginTop: '0.5rem',
    borderTop: '1px solid rgba(255, 255, 255, 0.05)',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis'
  };

  const navItemStyle = (isActive) => ({
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    padding: '0.75rem 1.25rem',
    textDecoration: 'none',
    color: isActive ? '#ffffff' : '#94a3b8', // slate-400
    backgroundColor: isActive ? 'rgba(59, 130, 246, 0.15)' : 'transparent',
    borderLeft: isActive ? '3px solid #3b82f6' : '3px solid transparent',
    transition: 'all 0.2s ease',
    fontWeight: isActive ? '500' : '400',
    whiteSpace: 'nowrap',
    overflow: 'hidden'
  });

  const navIconStyle = {
    fontSize: '1.1rem',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    width: '24px',
    flexShrink: 0
  };

  const navLabelStyle = {
    fontSize: '0.9rem',
    opacity: collapsed ? 0 : 1,
    transition: 'opacity 0.2s ease'
  };

  const tooltipStyle = {
    position: 'absolute',
    left: '100%',
    top: '50%',
    transform: 'translateY(-50%)',
    marginLeft: '10px',
    backgroundColor: '#1e293b',
    color: 'white',
    padding: '5px 10px',
    borderRadius: '4px',
    fontSize: '0.8rem',
    whiteSpace: 'nowrap',
    zIndex: 2000,
    boxShadow: '0 4px 6px rgba(0,0,0,0.1)',
    pointerEvents: 'none'
  };

  return (
    <aside
      className={`sidebar ${collapsed ? 'collapsed' : ''} ${isOpen ? 'open' : ''}`}
      style={asideStyle}
    >
      {/* Logo Section */}
      <div style={{ padding: '1.5rem 1.25rem', display: 'flex', alignItems: 'center', gap: '12px', borderBottom: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ width: '40px', height: '40px', borderRadius: '8px', backgroundColor: '#3b82f6', display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 'bold', fontSize: '1.2rem', flexShrink: 0 }}>
          {logoUrl ? (
            <img src={logoUrl} alt="Logo" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '8px' }} onError={(e) => { e.currentTarget.style.display = 'none'; }} />
          ) : (
            shortName.charAt(0)
          )}
        </div>
        {!collapsed && (
          <div>
            <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: '700', color: 'white' }}>{shortName.toUpperCase()}</h2>
            <p style={{ margin: 0, fontSize: '0.75rem', color: '#64748b' }}>Application System</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav style={{ flex: 1, paddingY: '1rem' }} aria-label="Main navigation">
        {items.map((item, index) => (
          item.divider ? (
            !collapsed && <div key={index} style={dividerStyle}>{item.label}</div>
          ) : (
            <div
              key={index}
              className="nav-item-wrapper"
              style={{ '--stagger': `${index * 45}ms`, position: 'relative' }}
            >
              <NavLink
                to={item.path}
                end={item.exact}
                style={({ isActive }) => navItemStyle(isActive)}
                onMouseEnter={() => setHoveredIndex(index)}
                onMouseLeave={() => setHoveredIndex(null)}
              >
                <span style={navIconStyle}>{item.icon}</span>
                <span style={navLabelStyle}>{item.label}</span>
              </NavLink>

              {/* Tooltip — only visible when collapsed & hovered */}
              {collapsed && hoveredIndex === index && (
                <div className="nav-tooltip" style={tooltipStyle} role="tooltip">
                  {item.label}
                  <span className="nav-tooltip-arrow" aria-hidden="true" />
                </div>
              )}
            </div>
          )
        ))}
      </nav>

      {/* Bottom accent line */}
      <div style={{ padding: '1rem', borderTop: '1px solid rgba(255,255,255,0.05)' }}>
        <div style={{ height: '2px', width: '100%', background: 'linear-gradient(to right, transparent, #3b82f6, transparent)' }} />
      </div>
    </aside>
  );
};

export default Sidebar;