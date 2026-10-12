import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { networkAPI } from '../../services/api';

const NetworkSettings = () => {
  const [ip, setIp] = useState('localhost');
  const [port, setPort] = useState('5000');
  const [message, setMessage] = useState('');
  const [isError, setIsError] = useState(false);
  const [testing, setTesting] = useState(false);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await networkAPI.get();
        if (res.data) {
          setIp(res.data.ip || 'localhost');
          setPort(res.data.port || '5000');
        }
      } catch (err) {
        console.error('Failed to fetch network settings', err);
      }
    };
    fetchSettings();
  }, []);

  const handleTestAndSave = async (e) => {
    e.preventDefault();
    setTesting(true);
    setMessage('');
    setIsError(false);

    if (!ip || !port) {
      setIsError(true);
      setMessage('Please enter both IP and Port.');
      setTesting(false);
      return;
    }

    const testUrl = `http://${ip}:${port}/api/health`;

    try {
      // 1. Test the connection
      const response = await axios.get(testUrl, { timeout: 5000 });
      
      if (response.data.status === 'ok') {
        // 2. Save to Database
        await networkAPI.update({ ip, port });
        
        // 3. Save to localStorage for Axios
        const newUrl = `http://${ip}:${port}`;
        localStorage.setItem('custom_backend_url', newUrl);
        localStorage.setItem('custom_backend_ip', ip);
        localStorage.setItem('custom_backend_port', port);
        
        setIsError(false);
        setMessage('✅ Network detected! Settings saved to DB. Reloading to connect...');
        
        // 4. Reload the app so Axios picks up the new URL
        setTimeout(() => {
          window.location.reload();
        }, 2000);
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (err) {
      setIsError(true);
      setMessage(`❌ Network not detected at ${testUrl}. Please check the IP and Port, or ensure the backend is running and CORS is enabled.`);
    } finally {
      setTesting(false);
    }
  };

  const handleReset = () => {
    localStorage.removeItem('custom_backend_url');
    localStorage.removeItem('custom_backend_ip');
    localStorage.removeItem('custom_backend_port');
    setIsError(false);
    setMessage('🔄 Reset to default! Reloading...');
    setTimeout(() => {
      window.location.reload();
    }, 2000);
  };

  // --- Inline Styles ---
  const containerStyle = {
    maxWidth: '600px',
    margin: '0 auto',
    backgroundColor: 'white',
    padding: '2rem',
    borderRadius: '12px',
    boxShadow: '0 4px 6px rgba(0,0,0,0.05)',
    border: '1px solid #e2e8f0',
    fontFamily: 'system-ui, sans-serif'
  };

  const headerStyle = {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#0f172a',
    marginBottom: '0.5rem'
  };

  const subHeaderStyle = {
    color: '#64748b',
    fontSize: '0.9rem',
    marginBottom: '2rem'
  };

  const gridStyle = {
    display: 'grid',
    gridTemplateColumns: '2fr 1fr',
    gap: '1rem',
    marginBottom: '1.5rem'
  };

  const fieldStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: '0.5rem'
  };

  const labelStyle = {
    fontSize: '0.85rem',
    fontWeight: '500',
    color: '#334155'
  };

  const inputStyle = {
    padding: '0.75rem 1rem',
    border: '1px solid #cbd5e1',
    borderRadius: '6px',
    fontSize: '1rem',
    outline: 'none'
  };

  const btnStyle = {
    padding: '0.75rem 1.5rem',
    backgroundColor: '#2563eb',
    color: 'white',
    border: 'none',
    borderRadius: '6px',
    fontSize: '1rem',
    fontWeight: '600',
    cursor: 'pointer',
    width: '100%'
  };

  const resetBtnStyle = {
    ...btnStyle,
    backgroundColor: '#f1f5f9',
    color: '#334155',
    marginTop: '0.5rem'
  };

  const alertStyle = {
    padding: '0.75rem 1rem',
    borderRadius: '6px',
    marginBottom: '1.5rem',
    fontSize: '0.9rem',
    fontWeight: '500',
    backgroundColor: isError ? '#fef2f2' : '#f0fdf4',
    color: isError ? '#dc2626' : '#16a34a',
    border: `1px solid ${isError ? '#fecaca' : '#bbf7d0'}`,
    display: message ? 'block' : 'none'
  };

  return (
    <div style={containerStyle}>
      <h1 style={headerStyle}>Network Settings</h1>
      <p style={subHeaderStyle}>
        Configure the local backend IP and Port for this school. 
        The system will automatically test the connection. If the network is not detected, it will revert to the default server.
      </p>
      
      {message && (
        <div style={alertStyle}>{message}</div>
      )}

      <form onSubmit={handleTestAndSave}>
        <div style={gridStyle}>
          <div style={fieldStyle}>
            <label style={labelStyle}>Server IP Address</label>
            <input
              type="text"
              value={ip}
              onChange={(e) => setIp(e.target.value)}
              placeholder="e.g. 192.168.1.50 or localhost"
              style={inputStyle}
              required
              disabled={testing}
            />
          </div>
          <div style={fieldStyle}>
            <label style={labelStyle}>Port</label>
            <input
              type="text"
              value={port}
              onChange={(e) => setPort(e.target.value)}
              placeholder="e.g. 5000"
              style={inputStyle}
              required
              disabled={testing}
            />
          </div>
        </div>
        
        <button type="submit" style={btnStyle} disabled={testing}>
          {testing ? 'Testing Network...' : 'Test & Save to Database'}
        </button>
        
        <button type="button" onClick={handleReset} style={resetBtnStyle} disabled={testing}>
          Reset to Default
        </button>
      </form>
    </div>
  );
};

export default NetworkSettings;     