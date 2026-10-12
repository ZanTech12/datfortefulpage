import React, { useState, useEffect, useRef } from 'react';

const SyncPage = () => {
  const [loading, setLoading] = useState(null);
  const [logs, setLogs] = useState([]);
  const [isError, setIsError] = useState(false);
  const [progress, setProgress] = useState(0);
  const progressInterval = useRef(null);

  const API_BASE_URL = process.env.NODE_ENV === 'production' 
    ? '' 
    : 'http://localhost:5000';

  // ✅ Simulate progress while loading
  useEffect(() => {
    if (loading) {
      setProgress(10); // Start at 10%
      progressInterval.current = setInterval(() => {
        setProgress(prev => {
          if (prev >= 90) return 90; // Cap at 90% until complete
          return prev + 2; // Increment slowly
        });
      }, 1000);
    } else {
      clearInterval(progressInterval.current);
    }
    
    return () => clearInterval(progressInterval.current);
  }, [loading]);

  const handleSync = async (direction) => {
    const token = localStorage.getItem('token');
    
    if (!token) {
      alert('You must be logged in as an Admin to sync.');
      return;
    }

    setLoading(direction);
    setLogs(['Starting synchronization...']);
    setIsError(false);
    setProgress(0);

    try {
      const response = await fetch(`${API_BASE_URL}/sync/${direction}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        }
      });

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split('\n\n');
        buffer = lines.pop();

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const data = JSON.parse(line.replace('data: ', ''));
              setLogs(prev => [...prev, data.message]);
              
              if (data.message.includes('✅ Synchronization completed')) {
                setProgress(100);
                clearInterval(progressInterval.current);
              }
              if (data.message.includes('❌')) {
                setIsError(true);
                setProgress(100);
                clearInterval(progressInterval.current);
              }
            } catch (e) {
              console.error('Parse error:', e);
            }
          }
        }
      }
    } catch (error) {
      setIsError(true);
      setLogs(prev => [...prev, `❌ Network Error: ${error.message}`]);
      setProgress(100);
    } finally {
      setLoading(null);
    }
  };

  // --- Inline Style Objects ---
  const containerStyle = {
    minHeight: '100vh',
    backgroundColor: '#f3f4f6',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    fontFamily: 'system-ui, -apple-system, sans-serif'
  };

  const cardStyle = {
    maxWidth: '42rem',
    width: '100%',
    backgroundColor: '#ffffff',
    padding: '2rem',
    borderRadius: '8px',
    boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06)'
  };

  const headerStyle = {
    fontSize: '1.5rem',
    fontWeight: '700',
    color: '#1f2937',
    borderBottom: '2px solid #3b82f6',
    paddingBottom: '1rem',
    marginBottom: '1.5rem',
    marginTop: 0
  };

  const infoBoxStyle = {
    marginBottom: '1.5rem',
    backgroundColor: '#eff6ff',
    padding: '1rem',
    borderRadius: '6px',
    fontSize: '0.875rem',
    color: '#1e40af',
    border: '1px solid #bfdbfe'
  };

  const buttonContainerStyle = {
    display: 'flex',
    flexDirection: 'row',
    gap: '1rem',
    marginBottom: '1.5rem',
    flexWrap: 'wrap' 
  };

  const baseButtonStyle = {
    flex: '1 1 200px', 
    padding: '0.75rem 1.5rem',
    color: '#ffffff',
    borderRadius: '6px',
    fontWeight: '500',
    border: 'none',
    cursor: 'pointer',
    fontSize: '1rem'
  };

  const progressBarContainer = {
    width: '100%',
    height: '20px',
    backgroundColor: '#e5e7eb',
    borderRadius: '6px',
    overflow: 'hidden',
    marginBottom: '1rem',
    display: logs.length > 0 ? 'block' : 'none'
  };

  const progressBarFill = {
    height: '100%',
    width: `${progress}%`,
    backgroundColor: isError ? '#dc2626' : (progress === 100 ? '#10b981' : '#3b82f6'),
    transition: 'width 0.5s ease-in-out',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'white',
    fontSize: '0.75rem',
    fontWeight: 'bold'
  };

  const logBoxStyle = {
    padding: '1rem',
    borderRadius: '6px',
    border: '1px solid',
    backgroundColor: '#1e293b',
    color: '#e2e8f0',
    fontFamily: 'monospace',
    fontSize: '0.85rem',
    minHeight: '150px',
    maxHeight: '300px',
    overflowY: 'auto'
  };

  return (
    <div style={containerStyle}>
      <div style={cardStyle}>
        <h1 style={headerStyle}>Database Sync</h1>
        
        <div style={infoBoxStyle}>
          <p style={{ margin: '0 0 5px 0' }}><strong>Primary:</strong> Local Database (Offline)</p>
          <p style={{ margin: 0 }}><strong>Secondary:</strong> Neon Cloud Database (Online)</p>
        </div>

        <div style={buttonContainerStyle}>
          <button
            onClick={() => handleSync('to-local')}
            disabled={loading !== null}
            style={{
              ...baseButtonStyle,
              backgroundColor: loading === 'to-local' ? '#60a5fa' : '#2563eb',
              cursor: loading !== null ? 'not-allowed' : 'pointer'
            }}
          >
            {loading === 'to-local' ? 'Syncing...' : 'Pull Cloud to Local (Backup)'}
          </button>

          <button
            onClick={() => handleSync('to-online')}
            disabled={loading !== null}
            style={{
              ...baseButtonStyle,
              backgroundColor: loading === 'to-online' ? '#fca5a5' : '#dc2626',
              cursor: loading !== null ? 'not-allowed' : 'pointer'
            }}
          >
            {loading === 'to-online' ? 'Syncing...' : 'Push Local to Cloud (Restore)'}
          </button>
        </div>

        {/* ✅ Progress Bar */}
        {logs.length > 0 && (
          <div style={progressBarContainer}>
            <div style={progressBarFill}>
              {progress}%
            </div>
          </div>
        )}

        {logs.length > 0 && (
          <div style={logBoxStyle}>
            {logs.map((log, i) => (
              <div key={i} style={{ color: log.includes('❌') ? '#f87171' : log.includes('✅') ? '#4ade80' : '#e2e8f0' }}>
                {log}
              </div>
            ))}
            {loading && <div style={{ color: '#fbbf24' }}>_</div>}
          </div>
        )}
      </div>
    </div>
  );
};

export default SyncPage;