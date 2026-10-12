import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom'; 
import { eNotesAPI, subjectsAPI, getApiBaseUrl } from '../services/api'; // ✅ CHANGED: Import getApiBaseUrl

const customStyles = `
  .page-title { font-size: 1.8rem; font-weight: 600; margin-bottom: 4px; }
  .page-subtitle { font-size: 0.9rem; color: #6b7280; margin-bottom: 20px; }
  .card { background: #ffffff; border-radius: 14px; padding: 20px; box-shadow: 0 10px 25px rgba(0, 0, 0, 0.08); margin-bottom: 20px; }
  .table-container { overflow-x: auto; }
  table { width: 100%; border-collapse: collapse; }
  thead { background: #f9fafb; }
  th { text-align: left; padding: 12px; font-size: 0.85rem; color: #6b7280; font-weight: 600; border-bottom: 1px solid #e5e7eb; }
  td { padding: 14px 12px; font-size: 0.9rem; border-bottom: 1px solid #f1f5f9; }
  tbody tr { transition: 0.2s ease; }
  tbody tr:hover { background: #f8fafc; cursor: pointer; }
  .btn { border: none; border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; cursor: pointer; transition: all 0.25s ease; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
  .btn-info { background: #0ea5e9; color: #fff; }
  .btn-info:hover { background: #0284c7; }
  .btn-secondary { background: #e5e7eb; color: #374151; }
  .btn-secondary:hover { background: #d1d5db; }
  .btn-sm { padding: 6px 10px; font-size: 0.75rem; }
  .alert { padding: 10px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 12px; }
  .alert-danger { background: #fee2e2; color: #b91c1c; }
  .spinner-dark { display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 20px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .badge-pdf { background: linear-gradient(135deg, #ef4444, #f87171); color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
  .subjects-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 20px; margin-bottom: 20px; }
  .subject-card { background: #ffffff; border-radius: 14px; padding: 24px; box-shadow: 0 4px 6px rgba(0,0,0,0.05); border: 1px solid #e5e7eb; cursor: pointer; transition: all 0.25s ease; }
  .subject-card:hover { transform: translateY(-3px); box-shadow: 0 10px 15px rgba(0,0,0,0.1); border-color: #6366f1; }
`;

export default function StudentENotes() {
    const [subjects, setSubjects] = useState([]);
    const [studentClassId, setStudentClassId] = useState(null);
    const [selectedSubject, setSelectedSubject] = useState(null);
    const [weeks, setWeeks] = useState([]);
    const [loading, setLoading] = useState({ initial: true, data: false });
    const [error, setError] = useState('');
    const [activeFile, setActiveFile] = useState(null);

    useEffect(() => {
        const fetchStudentData = async () => {
            try {
                setLoading({ initial: true, data: false });
                const infoRes = await eNotesAPI.getMyInfo();
                const studentInfo = infoRes.data?.data || infoRes.data;
                
                if (studentInfo?.classId) {
                    setStudentClassId(studentInfo.classId);
                    const subRes = await subjectsAPI.getByClass(studentInfo.classId);
                    const subData = subRes.data?.data || subRes.data || [];
                    setSubjects(Array.isArray(subData) ? subData : []);
                } else {
                    setError('You are not assigned to a class yet. Please contact administration.');
                }
            } catch (err) {
                console.error('Failed to load data:', err);
                setError('Failed to load E-Notes. Please try again later.');
            } finally {
                setLoading({ initial: false, data: false });
            }
        };
        fetchStudentData();
    }, []);

    const handleSubjectClick = async (subject) => {
        setSelectedSubject(subject);
        try {
            setLoading({ initial: false, data: true });
            const weeksRes = await eNotesAPI.getWeeks(studentClassId, subject.id);
            let weeksData = [];
            if (Array.isArray(weeksRes)) weeksData = weeksRes;
            else if (weeksRes?.data && Array.isArray(weeksRes.data)) weeksData = weeksRes.data;
            else if (weeksRes?.data?.data && Array.isArray(weeksRes.data.data)) weeksData = weeksRes.data.data;
            setWeeks(weeksData);
        } catch (err) {
            console.error('Error fetching weeks:', err);
            setError('Failed to load notes for this subject.');
        } finally {
            setLoading({ initial: false, data: false });
        }
    };

    // ✅ PROTECTION: Block right-click context menu globally while viewer is open
    useEffect(() => {
        const handleContextMenu = (e) => {
            if (activeFile) e.preventDefault();
        };
        document.addEventListener('contextmenu', handleContextMenu);
        return () => document.removeEventListener('contextmenu', handleContextMenu);
    }, [activeFile]);

    if (loading.initial) return (
        <div style={{ textAlign: 'center', padding: '40px' }}>
            <div className="spinner-dark"></div>
        </div>
    );
    
    if (error && !selectedSubject) return (
        <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto', fontFamily: 'system-ui, sans-serif' }}>
            <style>{customStyles}</style>
            <div className="alert alert-danger">{error}</div>
        </div>
    );

    // ✅ FULL SCREEN PDF READER (Protected)
    if (activeFile) {
        // ✅ FIXED: Use getApiBaseUrl() for dynamic URL
        const fileUrl = activeFile.fileUrl.startsWith('http') ? activeFile.fileUrl : `${getApiBaseUrl()}${activeFile.fileUrl}`;
        const viewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;

        return createPortal(
            <div 
                style={{ 
                    position: 'fixed', 
                    top: 0, left: 0, right: 0, bottom: 0, 
                    zIndex: 9999, 
                    backgroundColor: '#f8fafc', 
                    display: 'flex', 
                    flexDirection: 'column',
                    // ✅ PROTECTION: Disable text selection and dragging
                    userSelect: 'none', 
                    WebkitUserSelect: 'none',
                    MozUserSelect: 'none',
                }}
                // ✅ PROTECTION: Prevent dragging images/links
                onDragStart={(e) => e.preventDefault()}
            >
                <div style={{ 
                    backgroundColor: 'white', 
                    padding: '12px 24px', 
                    display: 'flex', 
                    justifyContent: 'space-between', 
                    alignItems: 'center', 
                    boxShadow: '0 1px 3px rgba(0,0,0,0.1)', 
                    zIndex: 10 
                }}>
                    <h2 style={{ fontWeight: 600, color: '#1e293b', fontSize: '18px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {activeFile.fileName}
                    </h2>
                    <button 
                        onClick={() => setActiveFile(null)}
                        className="btn btn-secondary btn-sm"
                    >
                        Close
                    </button>
                </div>
                
                <div style={{ 
                    flex: 1, 
                    padding: '16px', 
                    overflow: 'hidden', 
                    position: 'relative', 
                    display: 'flex' 
                }}>
                    <div style={{ 
                        flex: 1, 
                        backgroundColor: 'white', 
                        borderRadius: '12px', 
                        overflow: 'hidden', 
                        boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)', 
                        position: 'relative' 
                    }}>
                        <iframe 
                            src={viewUrl} 
                            title={activeFile.fileName}
                            style={{ 
                                position: 'absolute', 
                                top: 0, left: 0, 
                                width: '100%', height: '100%', 
                                border: 'none' 
                            }}
                            // ✅ PROTECTION: Block right-click directly on iframe
                            onContextMenu={(e) => e.preventDefault()}
                        />
                    </div>
                </div>
            </div>,
            document.body
        );
    }

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <style>{customStyles}</style>

            <h2 className="page-title">Class E-Notes</h2>
            <p className="page-subtitle">
                {selectedSubject ? `Viewing notes for ${selectedSubject.name}` : 'Select a subject to access your weekly study materials.'}
            </p>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* SUBJECTS VIEW */}
            {!selectedSubject ? (
                subjects.length === 0 ? (
                    <div className="card" style={{ textAlign: 'center', border: '2px dashed #e5e7eb', background: '#f9fafb' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>No Subjects Available</h3>
                        <p style={{ color: '#888', fontSize: '0.85rem' }}>Your class does not have any subjects assigned yet.</p>
                    </div>
                ) : (
                    <div className="subjects-grid">
                        {subjects.map(subject => (
                            <div 
                                key={subject.id} 
                                className="subject-card"
                                onClick={() => handleSubjectClick(subject)}
                            >
                                <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0 0 8px 0', color: '#1f2937' }}>
                                    {subject.name}
                                </h3>
                                <p style={{ fontSize: '0.85rem', color: '#6b7280', margin: 0 }}>
                                    {subject.code || 'Subject Material'}
                                </p>
                            </div>
                        ))}
                    </div>
                )
            ) : (
                /* WEEKS & FILES VIEW */
                <div>
                    <button 
                        onClick={() => { setSelectedSubject(null); setWeeks([]); setError(''); }}
                        className="btn btn-secondary btn-sm"
                        style={{ marginBottom: '20px' }}
                    >
                        ← Back to Subjects
                    </button>

                    {loading.data ? (
                        <div style={{ textAlign: 'center' }}>
                            <div className="spinner-dark"></div>
                        </div>
                    ) : weeks.length === 0 ? (
                        <div className="card" style={{ textAlign: 'center', border: '2px dashed #e5e7eb', background: '#f9fafb' }}>
                            <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>No Notes Available</h3>
                            <p style={{ color: '#888', fontSize: '0.85rem' }}>No E-Notes have been uploaded for {selectedSubject.name} yet. Please check back later.</p>
                        </div>
                    ) : (
                        weeks.map((week, index) => (
                            <div className="card" key={week.id}>
                                <div style={{ display: 'flex', alignItems: 'center', marginBottom: '15px', borderBottom: '1px solid #f1f5f9', paddingBottom: '10px' }}>
                                    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '28px', width: '28px', borderRadius: '50%', background: '#4f46e5', color: '#fff', fontSize: '0.8rem', fontWeight: '700', marginRight: '12px' }}>
                                        {index + 1}
                                    </span>
                                    <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0', color: '#1e2937' }}>
                                        {week.title}
                                    </h3>
                                </div>

                                {week.files && week.files.length > 0 ? (
                                    <div className="table-container">
                                        <table>
                                            <thead>
                                                <tr>
                                                    <th>File Name</th>
                                                    <th style={{ textAlign: 'right' }}>Action</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {week.files.map(file => (
                                                    <tr 
                                                        key={file.id} 
                                                        onClick={() => setActiveFile(file)}
                                                    >
                                                        <td>
                                                            <span className="badge-pdf" style={{ marginRight: '10px' }}>PDF</span>
                                                            <span style={{ color: '#334155', fontWeight: 500 }}>
                                                                {file.fileName}
                                                            </span>
                                                        </td>
                                                        <td style={{ textAlign: 'right' }}>
                                                            <button className="btn btn-info btn-sm">
                                                                Read Note
                                                            </button>
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                ) : (
                                    <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', padding: '10px 0' }}>No files uploaded for this week yet.</p>
                                )}
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
}