import React, { useState, useEffect, useCallback } from 'react';
import { 
    eNotesAPI, 
    getAuthData,
    getApiBaseUrl // ✅ CHANGED: Import the dynamic function
} from '../services/api';

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
  tbody tr:hover { background: #f8fafc; }
  .btn { border: none; border-radius: 8px; padding: 8px 14px; font-size: 0.85rem; cursor: pointer; transition: all 0.25s ease; text-decoration: none; display: inline-flex; align-items: center; justify-content: center; }
  .btn-group { display: flex; gap: 8px; }
  .btn-primary { background: linear-gradient(135deg, #4f46e5, #6366f1); color: #fff; }
  .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 8px 18px rgba(99, 102, 241, 0.4); }
  .btn-info { background: #0ea5e9; color: #fff; }
  .btn-info:hover { background: #0284c7; }
  .btn-danger { background: #ef4444; color: #fff; }
  .btn-danger:hover { background: #dc2626; }
  .btn-sm { padding: 6px 10px; font-size: 0.75rem; }
  .alert { padding: 10px; border-radius: 8px; font-size: 0.8rem; margin-bottom: 12px; }
  .alert-danger { background: #fee2e2; color: #b91c1c; }
  .form-group { margin-bottom: 14px; }
  .form-label { display: block; font-size: 0.8rem; margin-bottom: 4px; font-weight: 500; color: #374151; }
  .form-control { width: 100%; padding: 10px; border-radius: 8px; border: 1px solid #d1d5db; font-size: 0.9rem; transition: 0.2s ease; box-sizing: border-box; }
  .form-control:focus { outline: none; border-color: #6366f1; box-shadow: 0 0 6px rgba(99, 102, 241, 0.4); }
  .spinner { display: inline-block; width: 16px; height: 16px; border: 2px solid rgba(255, 255, 255, 0.3); border-top-color: #ffffff; border-radius: 50%; animation: spin 0.6s linear infinite; }
  .spinner-dark { display: inline-block; width: 24px; height: 24px; border: 3px solid rgba(99, 102, 241, 0.2); border-top-color: #6366f1; border-radius: 50%; animation: spin 0.6s linear infinite; margin: 20px auto; }
  @keyframes spin { to { transform: rotate(360deg); } }
  .enotes-grid { display: grid; grid-template-columns: 1fr 2fr; gap: 20px; }
  @media screen and (max-width: 768px) { .enotes-grid { grid-template-columns: 1fr; } }
  .flex-row { display: flex; gap: 10px; align-items: center; }
  .badge-pdf { background: linear-gradient(135deg, #ef4444, #f87171); color: #fff; padding: 4px 8px; border-radius: 6px; font-size: 0.7rem; font-weight: 700; }
`;

export default function ENotesManager() {
    const { user } = getAuthData();
    
    const [classes, setClasses] = useState([]);
    const [subjects, setSubjects] = useState([]);
    const [selectedClassId, setSelectedClassId] = useState('');
    const [selectedSubjectId, setSelectedSubjectId] = useState('');
    const [students, setStudents] = useState([]);
    const [weeks, setWeeks] = useState([]);
    const [newWeekTitle, setNewWeekTitle] = useState('');
    const [applyToAll, setApplyToAll] = useState(false);
    const [loading, setLoading] = useState({});
    const [error, setError] = useState('');

    // Fetch Classes on Mount
    useEffect(() => {
        const fetchClasses = async () => {
            setLoading(prev => ({ ...prev, classes: true }));
            try {
                const res = await eNotesAPI.getMyClasses();
                let classData = res?.data?.data || res?.data || [];
                if (!Array.isArray(classData)) classData = [];
                setClasses(classData);
            } catch (err) {
                console.error('Error fetching classes:', err);
                setError('Failed to load classes.');
            } finally {
                setLoading(prev => ({ ...prev, classes: false }));
            }
        };
        fetchClasses();
    }, []);

        // Fetch Students, Subjects, and Weeks when Class changes
    const handleClassChange = useCallback(async (e) => {
        const classId = e.target.value;
        setSelectedClassId(classId);
        setSelectedSubjectId('');
        setStudents([]);
        setWeeks([]);
        setSubjects([]);
        setError('');

        if (!classId) return;

        setLoading(prev => ({ ...prev, data: true }));

        // 1. Fetch Students
        try {
            const studentsRes = await eNotesAPI.getStudents(classId);
            let studentData = [];
            if (Array.isArray(studentsRes)) studentData = studentsRes;
            else if (studentsRes?.data && Array.isArray(studentsRes.data)) studentData = studentsRes.data;
            else if (studentsRes?.data?.data && Array.isArray(studentsRes.data.data)) studentData = studentsRes.data.data;
            setStudents(studentData);
        } catch (err) {
            console.error('Error fetching students:', err);
        }

        // 2. Fetch Subjects
        try {
            const subRes = await eNotesAPI.getMySubjects(classId);
            let subjectData = [];
            if (Array.isArray(subRes)) subjectData = subRes;
            else if (subRes?.data && Array.isArray(subRes.data)) subjectData = subRes.data;
            else if (subRes?.data?.data && Array.isArray(subRes.data.data)) subjectData = subRes.data.data;
            setSubjects(subjectData);
        } catch (err) {
            console.error('Error fetching subjects:', err);
        }

        // 3. Fetch Weeks
        try {
            const weeksRes = await eNotesAPI.getWeeks(classId);
            let weeksData = [];
            if (Array.isArray(weeksRes)) weeksData = weeksRes;
            else if (weeksRes?.data && Array.isArray(weeksRes.data)) weeksData = weeksRes.data;
            else if (weeksRes?.data?.data && Array.isArray(weeksRes.data.data)) weeksData = weeksRes.data.data;
            setWeeks(weeksData);
        } catch (err) {
            console.error('Error fetching weeks:', err);
        }

        setLoading(prev => ({ ...prev, data: false }));
    }, []);
    
    // Filter Weeks by Subject when Subject changes
    const handleSubjectChange = useCallback(async (e) => {
        const subjectId = e.target.value;
        setSelectedSubjectId(subjectId);
        setWeeks([]);
        setError('');

        if (!selectedClassId) return;

        setLoading(prev => ({ ...prev, data: true }));
        try {
            const weeksRes = await eNotesAPI.getWeeks(selectedClassId, subjectId || null);
            let weeksData = weeksRes?.data?.data || weeksRes?.data || [];
            if (!Array.isArray(weeksData)) weeksData = [];
            setWeeks(weeksData);
        } catch (err) {
            console.error('Error fetching weeks:', err);
            setError('Failed to load weeks.');
        } finally {
            setLoading(prev => ({ ...prev, data: false }));
        }
    }, [selectedClassId]);
    
    // Handle Create Week with "Apply to All" logic
    const handleCreateWeek = async (e) => {
        e.preventDefault();
        if (!newWeekTitle.trim() || (!selectedClassId && !applyToAll)) return;

        try {
            let payload = { title: newWeekTitle.trim() };
            if (applyToAll) {
                payload.classIds = classes.map(c => c.id);
            } else {
                payload.classId = selectedClassId;
            }

            await eNotesAPI.createWeek(payload);
            
            // Refresh the weeks list for the currently selected class
            const weeksRes = await eNotesAPI.getWeeks(selectedClassId, selectedSubjectId || null);
            let weeksData = weeksRes?.data?.data || weeksRes?.data || [];
            if (!Array.isArray(weeksData)) weeksData = [];
            setWeeks(weeksData);
            
            setNewWeekTitle('');
        } catch (err) {
            console.error('Error creating week:', err);
            setError('Failed to create week.');
        }
    };

    const handleFileUpload = async (weekId, files) => {
        if (!files || files.length === 0) return;
        if (!selectedSubjectId) {
            setError('Please select a subject before uploading.');
            return;
        }

        const formData = new FormData();
        for (let i = 0; i < files.length; i++) {
            formData.append('pdfFiles', files[i]);
        }
        
        formData.append('subjectId', selectedSubjectId);
        const subject = subjects.find(s => s.id === parseInt(selectedSubjectId));
        formData.append('subjectName', subject?.name || '');

        try {
            setLoading(prev => ({ ...prev, uploading: true }));
            setError('');
            const res = await eNotesAPI.uploadFiles(weekId, formData);
            const updatedWeek = res?.data?.data || res?.data;
            
            if (updatedWeek) {
                setWeeks(prev => prev.map(w => w.id === weekId ? updatedWeek : w));
            }
        } catch (err) {
            console.error('Error uploading files:', err);
            // ✅ IMPROVED ERROR HANDLING: Show the exact backend error message
            const backendError = err.response?.data?.message || 'Failed to upload files. Check console for details.';
            setError(backendError);
        } finally {
            setLoading(prev => ({ ...prev, uploading: false }));
        }
    };

    const handleDeleteFile = async (weekId, fileId) => {
        try {
            await eNotesAPI.deleteFile(fileId);
            setWeeks(prev => prev.map(w => {
                if (w.id === weekId) {
                    return { ...w, files: w.files.filter(f => f.id !== fileId) };
                }
                return w;
            }));
        } catch (err) {
            console.error('Error deleting file:', err);
            setError('Failed to delete file.');
        }
    };

    const handleDeleteWeek = async (weekId) => {
        if (window.confirm('Are you sure you want to delete this week and ALL of its PDF files? This cannot be undone.')) {
            try {
                await eNotesAPI.deleteWeek(weekId);
                setWeeks(prev => prev.filter(w => w.id !== weekId));
            } catch (err) {
                console.error('Error deleting week:', err);
                setError('Failed to delete week.');
            }
        }
    };

    return (
        <div style={{ padding: '24px', maxWidth: '1200px', margin: '0 auto', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
            <style>{customStyles}</style>

            <h2 className="page-title">E-Notes Manager</h2>
            <p className="page-subtitle">
                {user?.role === 'admin' 
                    ? 'Create weekly sections for your classes.' 
                    : 'Upload your subject PDFs under the weekly sections.'}
            </p>

            {error && <div className="alert alert-danger">{error}</div>}

            {/* Select Class & Subject */}
            <div className="card">
                <div className="flex-row" style={{ flexWrap: 'wrap', gap: '15px' }}>
                    <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
                        <label className="form-label">Select Class</label>
                        {loading.classes ? (
                            <div className="spinner-dark"></div>
                        ) : classes.length === 0 ? (
                            <p style={{ color: '#888', fontSize: '0.9rem', marginTop: '10px' }}>No classes assigned.</p>
                        ) : (
                            <select 
                                value={selectedClassId}
                                onChange={handleClassChange}
                                className="form-control"
                                disabled={applyToAll}
                            >
                                <option value="">-- Choose Class --</option>
                                {classes.map(cls => (
                                    <option key={cls.id} value={cls.id}>{cls.name}</option>
                                ))}
                            </select>
                        )}
                    </div>

                    <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
                        <label className="form-label">Filter by Subject (Optional for Admins)</label>
                        <select 
                            className="form-control" 
                            value={selectedSubjectId} 
                            onChange={handleSubjectChange}
                            disabled={!selectedClassId}
                        >
                            <option value="">-- All Subjects --</option>
                            {subjects.map(sub => (
                                <option key={sub.id} value={sub.id}>{sub.name}</option>
                            ))}
                        </select>
                    </div>
                </div>
            </div>

            {selectedClassId && (
                <div className="enotes-grid">
                    {/* Students List */}
                    <div className="card" style={{ height: 'fit-content' }}>
                        <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 15px 0', borderBottom: '1px solid #e5e7eb', paddingBottom: '10px' }}>
                            Assigned Students ({students.length})
                        </h3>
                        {loading.data ? (
                            <div className="spinner-dark"></div>
                        ) : students.length === 0 ? (
                            <p style={{ color: '#888', fontSize: '0.85rem', textAlign: 'center', padding: '20px 0' }}>No students found.</p>
                        ) : (
                            <div className="table-container">
                                <table>
                                    <thead>
                                        <tr>
                                            <th>Name</th>
                                            <th>Admission No.</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {students.map(student => (
                                            <tr key={student.id}>
                                                <td style={{ fontWeight: 500 }}>{student.firstName} {student.lastName}</td>
                                                <td style={{ color: '#6b7280' }}>{student.admissionNumber}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </div>

                    {/* Weeks & Uploads */}
                    <div>
                        {/* Create New Week (ADMIN ONLY) */}
                        {user?.role === 'admin' && (
                            <div className="card">
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, margin: '0 0 15px 0' }}>Create New Week</h3>
                                <form onSubmit={handleCreateWeek} className="flex-row" style={{ flexWrap: 'wrap', alignItems: 'flex-end' }}>
                                    <div className="form-group" style={{ flex: 1, minWidth: '200px', margin: 0 }}>
                                        <label className="form-label">Week / Section Title</label>
                                        <input
                                            type="text"
                                            value={newWeekTitle}
                                            onChange={(e) => setNewWeekTitle(e.target.value)}
                                            placeholder="e.g., WEEK 1, MID TERM BREAK"
                                            className="form-control"
                                            required
                                        />
                                    </div>
                                    
                                    {/* Apply to all classes checkbox */}
                                    <div style={{ display: 'flex', alignItems: 'center', marginBottom: '10px', marginLeft: '10px' }}>
                                        <input 
                                            type="checkbox" 
                                            id="applyToAll" 
                                            checked={applyToAll} 
                                            onChange={(e) => setApplyToAll(e.target.checked)} 
                                            style={{ height: '16px', width: '16px', cursor: 'pointer' }}
                                        />
                                        <label htmlFor="applyToAll" style={{ fontSize: '0.85rem', color: '#374151', fontWeight: 500, marginLeft: '8px', cursor: 'pointer' }}>
                                            Apply to ALL Classes
                                        </label>
                                    </div>

                                    <button 
                                        type="submit" 
                                        className="btn btn-primary" 
                                        style={{ marginLeft: '10px' }}
                                        disabled={!selectedClassId && !applyToAll}
                                    >
                                        Add Week
                                    </button>
                                </form>
                            </div>
                        )}

                        {/* Display Weeks */}
                        {loading.data ? (
                            <div className="card" style={{ textAlign: 'center' }}>
                                <div className="spinner-dark"></div>
                            </div>
                        ) : weeks.length === 0 ? (
                            <div className="card" style={{ textAlign: 'center', border: '2px dashed #e5e7eb', background: '#f9fafb' }}>
                                <h3 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#374151', marginBottom: '5px' }}>No Weeks Created Yet</h3>
                                <p style={{ color: '#888', fontSize: '0.85rem' }}>
                                    {user?.role === 'admin' ? 'Start by adding your first week above.' : 'The administrator has not created any weeks yet.'}
                                </p>
                            </div>
                        ) : (
                            weeks.map(week => (
                                <div className="card" key={week.id}>
                                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '15px' }}>
                                        <h3 style={{ fontSize: '1.2rem', fontWeight: 700, margin: '0', color: '#1f2937' }}>
                                            {week.title}
                                        </h3>
                                        {user?.role === 'admin' && (
                                            <button 
                                                onClick={() => handleDeleteWeek(week.id)}
                                                className="btn btn-danger btn-sm"
                                            >
                                                Delete Week
                                            </button>
                                        )}
                                    </div>
                                    
                                    {selectedSubjectId && (
                                        <div style={{ marginBottom: '20px' }}>
                                            <input 
                                                type="file" 
                                                multiple 
                                                accept="application/pdf" 
                                                id={`file-upload-${week.id}`}
                                                style={{ display: 'none' }}
                                                onChange={(e) => handleFileUpload(week.id, e.target.files)}
                                            />
                                            <label 
                                                htmlFor={`file-upload-${week.id}`} 
                                                className="btn btn-primary"
                                                style={{ cursor: 'pointer' }}
                                            >
                                                Upload PDF
                                            </label>
                                        </div>
                                    )}

                                    {week.files && week.files.length > 0 ? (
                                        <div className="table-container">
                                            <table>
                                                <thead>
                                                    <tr>
                                                        <th>File Name</th>
                                                        <th style={{ textAlign: 'right' }}>Actions</th>
                                                    </tr>
                                                </thead>
                                                <tbody>
                                                    {week.files.map(file => {
                                                        // ✅ FIXED: Use getApiBaseUrl() for dynamic URL
                                                        const fileUrl = file.fileUrl.startsWith('http') ? file.fileUrl : `${getApiBaseUrl()}${file.fileUrl}`;
                                                        // ✅ BYPASS CLOUDINARY: Wrap the URL in Google's PDF Viewer to force inline viewing
                                                        const viewUrl = `https://docs.google.com/viewer?url=${encodeURIComponent(fileUrl)}&embedded=true`;
                                                        return (
                                                            <tr key={file.id}>
                                                                <td>
                                                                    <span className="badge-pdf" style={{ marginRight: '10px' }}>PDF</span>
                                                                    <a 
                                                                        href={viewUrl} 
                                                                        target="_blank" 
                                                                        rel="noreferrer"
                                                                        style={{ color: '#334155', textDecoration: 'none', fontWeight: 500 }}
                                                                    >
                                                                        {file.fileName}
                                                                    </a>
                                                                </td>
                                                                <td style={{ textAlign: 'right' }}>
                                                                    <div className="btn-group" style={{ justifyContent: 'flex-end' }}>
                                                                        <a 
                                                                            href={viewUrl} 
                                                                            target="_blank" 
                                                                            rel="noreferrer"
                                                                            className="btn btn-info btn-sm"
                                                                        >
                                                                            View
                                                                        </a>
                                                                        <button 
                                                                            onClick={() => handleDeleteFile(week.id, file.id)}
                                                                            className="btn btn-danger btn-sm"
                                                                        >
                                                                            Delete
                                                                        </button>
                                                                    </div>
                                                                </td>
                                                            </tr>
                                                        );
                                                    })}
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
                </div>
            )}
            
            {loading.uploading && (
                <div style={{ position: 'fixed', bottom: '20px', right: '20px', background: '#4f46e5', color: '#fff', padding: '12px 20px', borderRadius: '8px', boxShadow: '0 10px 25px rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', gap: '10px', fontSize: '0.9rem', fontWeight: 500 }}>
                    <div className="spinner"></div>
                    Uploading Files...
                </div>
            )}
        </div>
    );
}