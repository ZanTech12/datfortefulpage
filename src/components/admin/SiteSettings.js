import React, { useState, useEffect } from 'react';
import { siteInfoAPI } from '../../services/api'; // Adjust path if needed (e.g., '../../api')

export default function SiteSettings() {
    const [formData, setFormData] = useState({
        schoolName: '', 
        shortName: '', 
        schoolMotto: '', 
        address: '', 
        state: '',
        country: 'Nigeria', 
        phoneNumber: '', 
        email: '', 
        website: '',
        registrationNumber: '', 
        principalName: '',
        schoolLogo: { url: '' }, 
        principalSignature: { url: '' }, 
        schoolStamp: { url: '' },
        admissionPrefix: 'SCH', 
        admissionCounter: 0 
    });
    
    const [files, setFiles] = useState({
        schoolLogo: null, 
        principalSignature: null, 
        schoolStamp: null
    });

    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [deletingImage, setDeletingImage] = useState(''); // State for individual image deletion loading
    const [error, setError] = useState('');
    const [success, setSuccess] = useState('');

    useEffect(() => { fetchSiteInfo(); }, []);

    const fetchSiteInfo = async () => {
        setLoading(true);
        try {
            const res = await siteInfoAPI.getSiteInfo();
            if (res.success && res.data) {
                setFormData(prev => ({
                    ...prev,
                    ...res.data,
                    schoolLogo: res.data.schoolLogo || { url: '' },
                    principalSignature: res.data.principalSignature || { url: '' },
                    schoolStamp: res.data.schoolStamp || { url: '' },
                    admissionPrefix: res.data.admissionPrefix || 'SCH',
                    admissionCounter: res.data.admissionCounter || 0
                }));
            }
        } catch (err) {
            if (err.response?.status !== 404) setError('Failed to load site information.');
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e) => {
        const { name, value } = e.target;
        // Only force uppercase for admissionPrefix
        if (name === 'admissionPrefix') {
            setFormData(prev => ({ ...prev, [name]: value.toUpperCase() }));
        } else {
            setFormData(prev => ({ ...prev, [name]: value }));
        }
    };

    const handleFileChange = (e, field) => {
        const file = e.target.files[0];
        if (file) {
            const previewUrl = URL.createObjectURL(file);
            setFormData(prev => ({ ...prev, [field]: { url: previewUrl } }));
            setFiles(prev => ({ ...prev, [field]: file }));
        }
    };

    // ✅ NEW: Handle deleting a single image from Cloudinary
    const handleRemoveImage = async (field) => {
        setDeletingImage(field);
        setError('');
        setSuccess('');
        try {
            await siteInfoAPI.deleteSingleImage(field);
            
            // Clear from local state
            setFormData(prev => ({ ...prev, [field]: { url: '' } }));
            setFiles(prev => ({ ...prev, [field]: null }));
            
            setSuccess(`${field} removed successfully!`);
            setTimeout(() => setSuccess(''), 3000);
        } catch (err) {
            setError(err.response?.data?.message || `Failed to remove ${field}.`);
        } finally {
            setDeletingImage('');
        }
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setSaving(true);
        setError('');
        setSuccess('');

        try {
            const submitData = new FormData();
            const { _id, __v, createdAt, updatedAt, schoolLogo, principalSignature, schoolStamp, admissionCounter, ...textFields } = formData;
            
            for (const key in textFields) {
                submitData.append(key, textFields[key]);
            }
            
            if (files.schoolLogo) submitData.append('schoolLogo', files.schoolLogo);
            if (files.principalSignature) submitData.append('principalSignature', files.principalSignature);
            if (files.schoolStamp) submitData.append('schoolStamp', files.schoolStamp);

            const res = await siteInfoAPI.upsertSiteInfo(submitData);
            if (res.success) {
                setSuccess('Site information saved successfully!');
                setFiles({ schoolLogo: null, principalSignature: null, schoolStamp: null });
                setTimeout(() => setSuccess(''), 3000);
            }
        } catch (err) {
            setError(err.response?.data?.message || 'Failed to save site information.');
        } finally {
            setSaving(false);
        }
    };

    // ---------- Inline Style Definitions ----------
    const colors = {
        bg: '#f5f7fb', cardBg: '#ffffff', border: '#e5e9f2', textPrimary: '#1f2937', textSecondary: '#6b7280',
        primary: '#2563eb', primaryHover: '#1d4ed8', dangerBg: '#fef2f2', dangerText: '#b91c1c', dangerBorder: '#fecaca',
        successBg: '#f0fdf4', successText: '#15803d', successBorder: '#bbf7d0', inputBg: '#ffffff', inputBorder: '#d1d5db', inputFocus: '#2563eb',
    };

    const containerStyle = { maxWidth: '1100px', margin: '0 auto', padding: '32px 24px', fontFamily: "'Segoe UI', Tahoma, Geneva, Verdana, sans-serif", color: colors.textPrimary };
    const headerStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '16px', marginBottom: '24px', flexWrap: 'wrap' };
    const titleStyle = { margin: '0 0 6px 0', fontSize: '26px', fontWeight: '700' };
    const subtitleStyle = { margin: 0, fontSize: '14px', color: colors.textSecondary, maxWidth: '600px' };
    const saveBtnBase = { background: colors.primary, color: '#ffffff', border: 'none', padding: '10px 22px', borderRadius: '8px', fontSize: '14px', fontWeight: '600', cursor: 'pointer', transition: 'background 0.2s ease, transform 0.05s ease', whiteSpace: 'nowrap' };
    const saveBtnStyle = { ...saveBtnBase, alignSelf: 'center' };
    const saveBtnMobileStyle = { ...saveBtnBase, width: '100%', marginTop: '8px', padding: '14px', fontSize: '15px' };
    const removeBtnStyle = { marginTop: '8px', background: colors.dangerBg, color: colors.dangerText, border: `1px solid ${colors.dangerBorder}`, padding: '6px 12px', borderRadius: '6px', fontSize: '12px', fontWeight: '600', cursor: 'pointer', width: 'fit-content' };
    
    const alertBase = { padding: '12px 16px', borderRadius: '8px', fontSize: '14px', marginBottom: '16px', border: '1px solid' };
    const alertErrorStyle = { ...alertBase, background: colors.dangerBg, color: colors.dangerText, borderColor: colors.dangerBorder };
    const alertSuccessStyle = { ...alertBase, background: colors.successBg, color: colors.successText, borderColor: colors.successBorder };
    const formGridStyle = { display: 'grid', gridTemplateColumns: '1fr', gap: '20px' };
    const cardStyle = { background: colors.cardBg, borderRadius: '12px', padding: '24px', border: `1px solid ${colors.border}`, boxShadow: '0 1px 3px rgba(0,0,0,0.04)' };
    const cardTitleStyle = { margin: '0 0 18px 0', fontSize: '17px', fontWeight: '700', paddingBottom: '12px', borderBottom: `1px solid ${colors.border}` };
    const inputGroupStyle = { display: 'flex', flexDirection: 'column', marginBottom: '14px', flex: '1 1 0', minWidth: '0' };
    const labelStyle = { fontSize: '13px', fontWeight: '600', marginBottom: '6px' };
    const inputStyle = { width: '100%', padding: '10px 12px', fontSize: '14px', background: colors.inputBg, border: `1px solid ${colors.inputBorder}`, borderRadius: '8px', outline: 'none', transition: 'border-color 0.15s ease, box-shadow 0.15s ease', boxSizing: 'border-box' };
    const inputRowStyle = { display: 'flex', gap: '16px', flexWrap: 'wrap' };
    const imageGridStyle = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px', marginTop: '8px' };
    const previewImgStyle = { marginTop: '8px', maxWidth: '100%', maxHeight: '120px', objectFit: 'contain', borderRadius: '8px', border: `1px solid ${colors.border}`, background: '#fafafa', padding: '4px' };

    const handleFocus = (e) => { e.target.style.borderColor = colors.inputFocus; e.target.style.boxShadow = `0 0 0 3px rgba(37, 99, 235, 0.15)`; };
    const handleBlur = (e) => { e.target.style.borderColor = colors.inputBorder; e.target.style.boxShadow = 'none'; };
    const handleBtnMouseEnter = (e) => { if (!saving) e.currentTarget.style.background = colors.primaryHover; };
    const handleBtnMouseLeave = (e) => { e.currentTarget.style.background = colors.primary; };
    const handleBtnMouseDown = (e) => { e.currentTarget.style.transform = 'translateY(1px)'; };
    const handleBtnMouseUp = (e) => { e.currentTarget.style.transform = 'translateY(0)'; };

    if (loading) {
        return <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: colors.bg }}><div style={{ width: '48px', height: '48px', border: '4px solid #e5e7eb', borderTopColor: colors.primary, borderRadius: '50%', animation: 'spin 0.8s linear infinite' }}></div><style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style></div>;
    }

    const nextAdmissionNumber = `${formData.admissionPrefix || 'SCH'}/${new Date().getFullYear()}/${String((formData.admissionCounter || 0) + 1).padStart(3, '0')}`;

    return (
        <div style={containerStyle}>
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
            <div style={headerStyle}>
                <div>
                    <h1 style={titleStyle}>Site Settings</h1>
                    <p style={subtitleStyle}>Manage your school's profile, contact details, and report card assets.</p>
                </div>
                <button onClick={handleSubmit} disabled={saving} style={{ ...saveBtnStyle, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} onMouseEnter={handleBtnMouseEnter} onMouseLeave={handleBtnMouseLeave} onMouseDown={handleBtnMouseDown} onMouseUp={handleBtnMouseUp}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </div>

            {error && <div style={alertErrorStyle}>{error}</div>}
            {success && <div style={alertSuccessStyle}>{success}</div>}

            <form onSubmit={handleSubmit} style={formGridStyle}>
                {/* Basic Information */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Basic Information</h2>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>School Name</label>
                        <input type="text" name="schoolName" value={formData.schoolName} onChange={handleChange} placeholder="e.g. BimTech SaaS Solutions" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div style={inputRowStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Short Name / Acronym</label>
                            <input type="text" name="shortName" value={formData.shortName} onChange={handleChange} placeholder="e.g. SCH" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>School Motto</label>
                            <input type="text" name="schoolMotto" value={formData.schoolMotto} onChange={handleChange} placeholder="e.g. Knowledge is Power" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                    </div>
                    
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Admission Number Prefix</label>
                        <input 
                            type="text" 
                            name="admissionPrefix" 
                            value={formData.admissionPrefix || ''} 
                            onChange={handleChange} 
                            placeholder="e.g. SCH" 
                            style={{ ...inputStyle, maxWidth: '150px', textTransform: 'uppercase' }} 
                            onFocus={handleFocus} 
                            onBlur={handleBlur} 
                        />
                        <small style={{ color: colors.textSecondary, fontSize: '12px', marginTop: '6px' }}>
                            Next registered student will automatically receive: <strong>{nextAdmissionNumber}</strong>
                        </small>
                    </div>
                </div>

                {/* Contact & Location */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Contact & Location</h2>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Address</label>
                        <input type="text" name="address" value={formData.address} onChange={handleChange} placeholder="e.g. 123 Education Avenue" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                    <div style={inputRowStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>State</label>
                            <input type="text" name="state" value={formData.state} onChange={handleChange} placeholder="e.g. Lagos" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Country</label>
                            <input type="text" name="country" value={formData.country} onChange={handleChange} placeholder="e.g. Nigeria" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                    </div>
                    <div style={inputRowStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Phone Number</label>
                            <input type="text" name="phoneNumber" value={formData.phoneNumber} onChange={handleChange} placeholder="e.g. +234 800 000 0000" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Email Address</label>
                            <input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="e.g. info@school.com" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                    </div>
                    <div style={inputGroupStyle}>
                        <label style={labelStyle}>Website</label>
                        <input type="text" name="website" value={formData.website} onChange={handleChange} placeholder="e.g. www.school.com" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                    </div>
                </div>

                {/* Official Details & Assets */}
                <div style={cardStyle}>
                    <h2 style={cardTitleStyle}>Official Details & Assets</h2>
                    <div style={inputRowStyle}>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Registration Number</label>
                            <input type="text" name="registrationNumber" value={formData.registrationNumber} onChange={handleChange} placeholder="e.g. RC123456" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Principal / Headteacher Name</label>
                            <input type="text" name="principalName" value={formData.principalName} onChange={handleChange} placeholder="e.g. Dr. John Doe" style={inputStyle} onFocus={handleFocus} onBlur={handleBlur} />
                        </div>
                    </div>
                    
                    <div style={imageGridStyle}>
                        {/* School Logo */}
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Upload School Logo</label>
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'schoolLogo')} style={inputStyle} />
                            {formData.schoolLogo.url && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <img src={formData.schoolLogo.url} alt="Logo Preview" style={previewImgStyle} />
                                    <button 
                                        type="button" 
                                        style={removeBtnStyle} 
                                        disabled={deletingImage === 'schoolLogo'}
                                        onClick={() => handleRemoveImage('schoolLogo')}
                                    >
                                        {deletingImage === 'schoolLogo' ? 'Removing...' : '❌ Remove Logo'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* Principal Signature */}
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Upload Principal Signature</label>
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'principalSignature')} style={inputStyle} />
                            {formData.principalSignature.url && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <img src={formData.principalSignature.url} alt="Signature Preview" style={previewImgStyle} />
                                    <button 
                                        type="button" 
                                        style={removeBtnStyle} 
                                        disabled={deletingImage === 'principalSignature'}
                                        onClick={() => handleRemoveImage('principalSignature')}
                                    >
                                        {deletingImage === 'principalSignature' ? 'Removing...' : '❌ Remove Signature'}
                                    </button>
                                </div>
                            )}
                        </div>

                        {/* School Stamp */}
                        <div style={inputGroupStyle}>
                            <label style={labelStyle}>Upload School Stamp</label>
                            <input type="file" accept="image/*" onChange={(e) => handleFileChange(e, 'schoolStamp')} style={inputStyle} />
                            {formData.schoolStamp.url && (
                                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start' }}>
                                    <img src={formData.schoolStamp.url} alt="Stamp Preview" style={previewImgStyle} />
                                    <button 
                                        type="button" 
                                        style={removeBtnStyle} 
                                        disabled={deletingImage === 'schoolStamp'}
                                        onClick={() => handleRemoveImage('schoolStamp')}
                                    >
                                        {deletingImage === 'schoolStamp' ? 'Removing...' : '❌ Remove Stamp'}
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                <button type="submit" disabled={saving} style={{ ...saveBtnMobileStyle, opacity: saving ? 0.7 : 1, cursor: saving ? 'not-allowed' : 'pointer' }} onMouseEnter={handleBtnMouseEnter} onMouseLeave={handleBtnMouseLeave} onMouseDown={handleBtnMouseDown} onMouseUp={handleBtnMouseUp}>
                    {saving ? 'Saving...' : 'Save Changes'}
                </button>
            </form>
        </div>
    );
}