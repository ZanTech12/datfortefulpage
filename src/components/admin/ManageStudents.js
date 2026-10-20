import React, { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { studentsAPI, classesAPI } from '../../api';
import Loading from '../common/Loading';

const ManageStudents = () => {
  const queryClient = useQueryClient();
  const fileInputRef = useRef(null);
  const imageInputRef = useRef(null);
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const streamRef = useRef(null);

  const [showModal, setShowModal] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [showCameraModal, setShowCameraModal] = useState(false);
  const [editingStudent, setEditingStudent] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterClass, setFilterClass] = useState('');   // ✅ NEW: class filter
  const [openActionMenu, setOpenActionMenu] = useState(null);
  const [menuPos, setMenuPos] = useState(null); // ✅ NEW: smart position for action menu
  const [imageUploadStudentId, setImageUploadStudentId] = useState(null);
  const [cameraFacingMode, setCameraFacingMode] = useState('user');
  const [cameraReady, setCameraReady] = useState(false);
  const [cameraError, setCameraError] = useState('');
  const [formData, setFormData] = useState({
    firstName: '', lastName: '', admissionNumber: '', classId: '', gender: '',
  });
  const [parsedStudents, setParsedStudents] = useState([]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState({ current: 0, total: 0 });
  const [uploadLog, setUploadLog] = useState([]);
  const [csvError, setCsvError] = useState('');
  const [error, setError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [imageUploadProgress, setImageUploadProgress] = useState(0);
  const [imageUploading, setImageUploading] = useState(false);

  const { data: students, isLoading: studentsLoading } = useQuery({
    queryKey: ['students'],
    queryFn: studentsAPI.getAll
  });

  const { data: classes, isLoading: classesLoading } = useQuery({
    queryKey: ['classes'],
    queryFn: () => classesAPI.getAll({ limit: 1000 })
  });

  const createMutation = useMutation({
    mutationFn: studentsAPI.create,
    onSuccess: (response) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(`Student created successfully! Admission No: ${response.data.admissionNumber}`);
      setError('');
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to create student'),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }) => studentsAPI.update(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      handleCloseModal();
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to update student'),
  });

  const deleteMutation = useMutation({
    mutationFn: studentsAPI.delete,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['students'] }),
  });

  const toggleFeesAccessMutation = useMutation({
    mutationFn: ({ studentId }) => studentsAPI.toggleFeesAccess(studentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(data.message);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to toggle fees access');
      setTimeout(() => setError(''), 3000);
    }
  });

  const toggleOwingMutation = useMutation({
    mutationFn: ({ studentId }) => studentsAPI.toggleOwing(studentId),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage(data.message);
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to toggle owing status');
      setTimeout(() => setError(''), 3000);
    }
  });

  const uploadImageMutation = useMutation({
    mutationFn: ({ studentId, file, onUploadProgress }) => studentsAPI.uploadProfileImage(studentId, file, { onUploadProgress }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage('Profile image uploaded successfully.');
      setTimeout(() => setSuccessMessage(''), 3000);
      setImageUploading(false);
      setImageUploadProgress(0);
    },
    onError: (err) => {
      setError(err.response?.data?.message || 'Failed to upload image');
      setImageUploading(false);
      setImageUploadProgress(0);
    },
  });

  const removeImageMutation = useMutation({
    mutationFn: (studentId) => studentsAPI.removeProfileImage(studentId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['students'] });
      setSuccessMessage('Profile image removed.');
      setTimeout(() => setSuccessMessage(''), 3000);
    },
    onError: (err) => setError(err.response?.data?.message || 'Failed to remove image'),
  });

  // ========== CAMERA LOGIC ==========
  const stopCamera = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
    setCameraError('');
  }, []);

  const startCamera = useCallback(async (facingMode) => {
    stopCamera();
    setCameraError('');
    try {
      const constraints = {
        video: { facingMode: facingMode || 'user', width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: false
      };
      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setCameraReady(true);
      }
    } catch (err) {
      console.error('Camera error:', err);
      if (err.name === 'NotAllowedError') {
        setCameraError('Camera permission denied. Please allow camera access in your browser settings and try again.');
      } else if (err.name === 'NotFoundError') {
        setCameraError('No camera found on this device.');
      } else if (err.name === 'NotReadableError') {
        setCameraError('Camera is already in use by another application.');
      } else {
        setCameraError(`Could not access camera: ${err.message}`);
      }
    }
  }, [stopCamera]);

  const handleOpenCamera = (studentId, e) => {
    if (e) e.stopPropagation();
    setOpenActionMenu(null);
    setMenuPos(null); // ✅ clear menu position
    setImageUploadStudentId(studentId);
    setCameraFacingMode('user');
    setShowCameraModal(true);
  };

  const handleFlipCamera = () => {
    setCameraFacingMode(prev => prev === 'user' ? 'environment' : 'user');
  };

  useEffect(() => {
    if (showCameraModal) {
      const timer = setTimeout(() => startCamera(cameraFacingMode), 300);
      return () => { clearTimeout(timer); stopCamera(); };
    } else {
      stopCamera();
    }
  }, [showCameraModal, cameraFacingMode, startCamera, stopCamera]);

  const handleSnapPhoto = () => {
    if (!videoRef.current || !canvasRef.current || !imageUploadStudentId) return;
    const video = videoRef.current;
    const canvas = canvasRef.current;
    const size = Math.min(video.videoWidth, video.videoHeight);
    const offsetX = (video.videoWidth - size) / 2;
    const offsetY = (video.videoHeight - size) / 2;
    canvas.width = 800;
    canvas.height = 800;
    const ctx = canvas.getContext('2d');
    ctx.drawImage(video, offsetX, offsetY, size, size, 0, 0, 800, 800);
    canvas.toBlob((blob) => {
      if (blob) {
        const file = new File([blob], `snap_${imageUploadStudentId}_${Date.now()}.jpg`, { type: 'image/jpeg', lastModified: Date.now() });
        setImageUploadProgress(0);
        setImageUploading(true);
        uploadImageMutation.mutate({
          studentId: imageUploadStudentId,
          file,
          onUploadProgress: (progressEvent) => {
            const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
            setImageUploadProgress(percent);
          }
        });
      }
      handleCloseCameraModal();
    }, 'image/jpeg', 0.92);
  };

  const handleCloseCameraModal = () => {
    setShowCameraModal(false);
    setImageUploadStudentId(null);
  };
  // ========== END CAMERA LOGIC ==========

  const filteredStudents = useMemo(() => {
    if (!students?.data) return [];
    let list = students.data;

    if (filterClass === 'none') {
      list = list.filter((student) => {
        const studentClassId = student.classId?._id || student.classId?.id || student.classId;
        return studentClassId === null || studentClassId === undefined || studentClassId === '';
      });
    } else if (filterClass) {
      list = list.filter((student) => {
        const studentClassId = student.classId?._id || student.classId?.id || student.classId;
        return String(studentClassId) === String(filterClass);
      });
    }

    if (!searchTerm.trim()) return list;
    const lowerCaseTerm = searchTerm.toLowerCase();
    return list.filter((student) => {
      const fullName = `${student.firstName} ${student.lastName}`.toLowerCase();
      return (
        student.admissionNumber?.toLowerCase().includes(lowerCaseTerm) ||
        fullName.includes(lowerCaseTerm)
      );
    });
  }, [students?.data, searchTerm, filterClass]);

  const getFeesStatusBadge = (student) => {
    if (!student.owingFees) return { label: 'Clear', color: 'green', icon: '✓' };
    if (student.owingFees && student.feesAccessGranted) return { label: 'Access Granted', color: 'amber', icon: '⚡' };
    return { label: 'Blocked', color: 'red', icon: '🚫' };
  };

  const handleToggleFeesAccess = (studentId, e) => {
    if (e) e.stopPropagation();
    toggleFeesAccessMutation.mutate({ studentId });
  };

  const handleToggleOwing = (studentId, e) => {
    if (e) e.stopPropagation();
    if (window.confirm("Are you sure you want to toggle this student's owing status?")) {
      toggleOwingMutation.mutate({ studentId });
    }
  };

  const handleImageClick = (studentId, e) => {
    if (e) e.stopPropagation();
    setOpenActionMenu(null);
    setMenuPos(null); // ✅ clear menu position
    setImageUploadStudentId(studentId);
    setTimeout(() => imageInputRef.current?.click(), 100);
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file || !imageUploadStudentId) return;

    if (file.size > 5 * 1024 * 1024) {
      setError('File too large. Maximum 5MB.');
      setTimeout(() => setError(''), 3000);
      if (imageInputRef.current) imageInputRef.current.value = '';
      setImageUploadStudentId(null);
      return;
    }

    setImageUploadProgress(0);
    setImageUploading(true);
    uploadImageMutation.mutate({
      studentId: imageUploadStudentId,
      file,
      onUploadProgress: (progressEvent) => {
        const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
        setImageUploadProgress(percent);
      }
    });
    if (imageInputRef.current) imageInputRef.current.value = '';
    setImageUploadStudentId(null);
  };

  const handleRemoveImage = (studentId, e) => {
    if (e) e.stopPropagation();
    setOpenActionMenu(null);
    setMenuPos(null); // ✅ clear menu position
    if (window.confirm("Remove this student's profile image?")) {
      removeImageMutation.mutate(studentId);
    }
  };

  // =====================================================
  // CSV EXPORT (includes Photo URL + Photo Public ID)
  // =====================================================
  const exportStudentsCSV = () => {
    const dataToExport = (searchTerm.trim() || filterClass) ? filteredStudents : (students?.data || []);
    if (dataToExport.length === 0) {
      setError('No students available to export.');
      setTimeout(() => setError(''), 3000);
      return;
    }
    const headers = ['Admission Number', 'First Name', 'Last Name', 'Full Name', 'Gender',
      'Class Name', 'Section', 'Owing Fees', 'Fees Access Granted', 'Photo URL', 'Photo Public ID'];
    const escapeCSV = (value) => {
      const stringValue = String(value);
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };
    const rows = dataToExport.map(student => {
      const cls = classes?.data?.find(c => (c._id || c.id) === student.classId || (c._id || c.id) === student.classId?._id || (c._id || c.id) === student.classId?.id);
      return [
        student.admissionNumber || '', student.firstName || '', student.lastName || '',
        `${student.firstName || ''} ${student.lastName || ''}`.trim(),
        student.gender || '', cls?.name || 'Not Assigned', cls?.section || '',
        student.owingFees ? 'Yes' : 'No', student.feesAccessGranted ? 'Yes' : 'No',
        student.profileImage?.url || '',
        student.profileImage?.publicId || ''
      ];
    });
    const csvContent = [headers.map(escapeCSV).join(','), ...rows.map(row => row.map(escapeCSV).join(','))].join('\n');
    const blob = new Blob(['\ufeff' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    const timestamp = new Date().toISOString().slice(0, 10);
    const searchSuffix = (searchTerm.trim() || filterClass) ? '_filtered' : '';
    link.setAttribute('download', `students_export${searchSuffix}_${timestamp}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // =====================================================
  // CSV IMPORT (Admission Number + Photo + Fees flags)
  // =====================================================

  const parseCSVLine = (line) => {
    const fields = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const ch = line[i];
      if (inQuotes) {
        if (ch === '"') {
          if (line[i + 1] === '"') { current += '"'; i++; }
          else inQuotes = false;
        } else current += ch;
      } else {
        if (ch === '"') inQuotes = true;
        else if (ch === ',') { fields.push(current); current = ''; }
        else current += ch;
      }
    }
    fields.push(current);
    return fields.map(f => f.trim());
  };

  const normalize = (s) => String(s || '').replace(/\s+/g, ' ').trim().toLowerCase();

  const extractPublicIdFromUrl = (url) => {
    const match = String(url).match(/\/upload\/(?:v\d+\/)?(.+)\.[a-zA-Z0-9]+$/);
    return match ? match[1] : '';
  };

  const downloadSampleCSV = () => {
    const csvContent = [
      'FirstName,LastName,Gender,ClassName,Section,Admission Number,Photo URL,Photo Public ID,Owing Fees,Fees Access Granted',
      'John,Doe,Male,JSS 1,A,,,,No,No',
      'Jane,Smith,Female,JSS 2,B,DIS/2026/101,,,No,No',
      'Samuel,Ethan,Male,SSS 1,C,,,https://res.cloudinary.com/demo/image/upload/v1234/school/abc123.jpg,,No,No',
      'Alice,Johnson,Female,SSS 2,A,,,,Yes,Yes'
    ].join('\n');
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.setAttribute('href', url);
    link.setAttribute('download', 'student_upload_format.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const handleOpenUploadModal = () => {
    setParsedStudents([]);
    setUploadLog([]);
    setCsvError('');
    setUploadProgress({ current: 0, total: 0 });
    if (fileInputRef.current) fileInputRef.current.value = '';
    setShowUploadModal(true);
  };

  const handleCloseUploadModal = () => {
    if (isUploading) return;
    setShowUploadModal(false);
    setParsedStudents([]);
    setUploadLog([]);
    setCsvError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.name.endsWith('.csv')) {
      setCsvError('Invalid file type. Please upload a .csv file.');
      setParsedStudents([]);
      return;
    }
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = String(event.target.result).replace(/^\ufeff/, '');
        const lines = text.split(/\r\n|\n/).filter(line => line.trim() !== '');
        if (lines.length < 2) { setCsvError('CSV file is empty or missing data rows.'); return; }
        const rawHeaders = parseCSVLine(lines[0]).map(h => h.toLowerCase().replace(/['"]/g, ''));
        const getVal = (row, possibleKeys) => {
          const foundKey = possibleKeys.find(k => rawHeaders.includes(k));
          return foundKey ? (row[rawHeaders.indexOf(foundKey)] || '').trim() : '';
        };

        const existingAdmissionNumbers = new Set(
          (students?.data || []).map(s => (s.admissionNumber || '').toLowerCase())
        );
        const seenAdmissionNumbers = new Set();

        const mappedData = [];
        let errors = [];
        const missingClasses = new Set();

        for (let i = 1; i < lines.length; i++) {
          const values = parseCSVLine(lines[i]);
          if (values.length < 2 || !values[0]) continue;

          const firstName = getVal(values, ['firstname', 'first_name', 'first name']);
          const lastName = getVal(values, ['lastname', 'last_name', 'last name']);
          const gender = getVal(values, ['gender', 'sex']);
          const className = getVal(values, ['classname', 'class_name', 'class name', 'class']);
          const section = getVal(values, ['section', 'sec']);
          const admissionNumber = getVal(values, ['admission number', 'admissionnumber', 'admission_no', 'admission no', 'admissionno']);
          const photoUrl = getVal(values, ['photo url', 'photourl', 'photo link', 'profile image', 'image url', 'photo']);
          const photoPublicId = getVal(values, ['photo public id', 'photo publicid', 'public id', 'publicid']);
          const owingRaw = getVal(values, ['owing fees', 'owingfees', 'owing']);
          const feesAccessRaw = getVal(values, ['fees access granted', 'feesaccessgranted', 'access granted']);

          if (!firstName || !lastName) { errors.push(`Row ${i + 1}: Missing First or Last name.`); continue; }

          if (admissionNumber) {
            const admLower = admissionNumber.toLowerCase();
            if (existingAdmissionNumbers.has(admLower)) {
              errors.push(`Row ${i + 1}: Admission number ${admissionNumber} already exists in the system.`);
            } else if (seenAdmissionNumbers.has(admLower)) {
              errors.push(`Row ${i + 1}: Duplicate admission number ${admissionNumber} within this file.`);
            }
            seenAdmissionNumbers.add(admLower);
          }

          let classId = '';
          if (className) {
            const n = normalize(className);
            const s = normalize(section);
            const combined = n.replace(/\s*-\s*/g, ' ');
            const matchedClass = (classes?.data || []).find(c => {
              const cn = normalize(c.name);
              const cs = normalize(c.section);
              if (s) return cn === n && cs === s;
              if (cn === n) return true;
              return normalize(`${c.name} ${c.section || ''}`) === combined;
            });
            if (matchedClass) {
              classId = matchedClass._id || matchedClass.id;
            } else {
              const label = `${className}${section ? ' - ' + section : ''}`;
              const sameName = (classes?.data || []).filter(c => normalize(c.name) === n);
              const hint = sameName.length > 0
                ? ` ("${className}" exists but only with section(s): ${sameName.map(c => c.section).join(', ')})`
                : '';
              errors.push(`Row ${i + 1}: Class "${label}" not found${hint} - student will be imported WITHOUT a class.`);
              missingClasses.add(label);
            }
          }

          const g = (gender || '').toLowerCase();
          const normalizedGender = g === 'male' ? 'Male' : g === 'female' ? 'Female' : g === 'other' ? 'Other' : '';

          const hasPhoto = photoUrl && /^https?:\/\//i.test(photoUrl);
          const profileImage = hasPhoto
            ? { url: photoUrl, publicId: photoPublicId || extractPublicIdFromUrl(photoUrl) }
            : null;

          mappedData.push({
            firstName: firstName.trim(),
            lastName: lastName.trim(),
            gender: normalizedGender,
            classId,
            admissionNumber: admissionNumber || '',
            owingFees: ['yes', 'true', '1'].includes((owingRaw || '').toLowerCase()),
            feesAccessGranted: ['yes', 'true', '1'].includes((feesAccessRaw || '').toLowerCase()),
            ...(profileImage ? { profileImage } : {}),
            _rowNumber: i + 1,
            _className: className,
            _section: section,
            _hasPhoto: !!profileImage
          });
        }

        let summary = '';
        if (missingClasses.size > 0) {
          summary = `MISSING CLASSES (${missingClasses.size}): ${[...missingClasses].join(', ')} - those students will import WITHOUT a class. Create the class(es) first to assign them.`;
        }
        setCsvError([summary, errors.join(' | ')].filter(Boolean).join(' | '));

        setParsedStudents(mappedData);
      } catch (err) {
        console.error(err);
        setCsvError('Failed to parse CSV file. Ensure it is formatted correctly.');
      }
    };
    reader.readAsText(file);
  };

  const handleBulkUpload = async () => {
    if (parsedStudents.length === 0) return;
    setIsUploading(true);
    setUploadLog([]);
    setUploadProgress({ current: 0, total: parsedStudents.length });
    let successCount = 0;
    let updateCount = 0;
    let failCount = 0;

    const existingByAdmission = new Map(
      (students?.data || []).map(s => [String(s.admissionNumber || '').toLowerCase(), s])
    );

    for (const student of parsedStudents) {
      const { _rowNumber, _className, _section, _hasPhoto, ...payload } = student;
      if (!payload.admissionNumber) delete payload.admissionNumber;

      const existing = payload.admissionNumber
        ? existingByAdmission.get(String(payload.admissionNumber).toLowerCase())
        : null;

      if (existing) {
        const existingId = existing._id || existing.id;
        const existingClassId = existing.classId?._id || existing.classId?.id || existing.classId;
        const needsClassUpdate = payload.classId && String(payload.classId) !== String(existingClassId);

        if (needsClassUpdate) {
          try {
            await studentsAPI.update(existingId, { classId: payload.classId });
            updateCount++;
            setUploadLog(prev => [...prev, `🔄 Row ${_rowNumber}: ${student.firstName} ${student.lastName} UPDATED - class set to ${_className}${_section ? ' - ' + _section : ''}`]);
          } catch (err) {
            failCount++;
            setUploadLog(prev => [...prev, `❌ Row ${_rowNumber}: Update failed (${err.response?.data?.message || 'Unknown error'})`]);
          }
        } else {
          setUploadLog(prev => [...prev, `⏭️ Row ${_rowNumber}: ${student.firstName} ${student.lastName} already up to date - skipped`]);
        }
      } else {
        try {
          const response = await studentsAPI.create(payload);
          successCount++;
          const adm = response?.data?.admissionNumber || payload.admissionNumber || 'auto';
          setUploadLog(prev => [...prev, `✅ Row ${_rowNumber}: ${student.firstName} ${student.lastName} added (Adm: ${adm})${_hasPhoto ? ' + photo' : ''}${student.classId ? '' : ' [NO CLASS]'}`]);
        } catch (err) {
          failCount++;
          const errMsg = err.response?.data?.message || 'Unknown error';
          setUploadLog(prev => [...prev, `❌ Row ${_rowNumber}: Failed (${errMsg})`]);
        }
      }
      setUploadProgress(prev => ({ ...prev, current: prev.current + 1 }));
    }
    setIsUploading(false);
    queryClient.invalidateQueries({ queryKey: ['students'] });
    setUploadLog(prev => [...prev, `--- Import Complete: ${successCount} created, ${updateCount} updated, ${failCount} failed ---`]);
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({ ...formData, [name]: value });
    setError('');
    setSuccessMessage('');
  };

  const handleOpenCreate = () => {
    setEditingStudent(null);
    setFormData({ firstName: '', lastName: '', admissionNumber: '', classId: '', gender: '' });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };

  const handleOpenEdit = (student) => {
    setEditingStudent(student);
    setFormData({
      firstName: student.firstName || '', lastName: student.lastName || '',
      admissionNumber: student.admissionNumber || '',
      classId: student.classId?._id || student.classId?.id || '',
      gender: student.gender || '',
    });
    setError(''); setSuccessMessage('');
    setShowModal(true);
  };

  const handleCloseModal = () => {
    setShowModal(false); setEditingStudent(null); setError(''); setSuccessMessage('');
  };

  const handleSubmit = (e) => {
    if (e && e.preventDefault) e.preventDefault();
    if (editingStudent) updateMutation.mutate({ id: editingStudent._id || editingStudent.id, data: formData });
    else createMutation.mutate(formData);
  };

  const handleDelete = (id) => {
    if (window.confirm('Are you sure you want to delete this student?')) deleteMutation.mutate(id);
  };

  // ✅ SMART POSITIONING: opens upward when last rows would clip below viewport
  const toggleActionMenu = (id, e) => {
    e.stopPropagation();
    if (openActionMenu === id) {
      setOpenActionMenu(null);
      setMenuPos(null);
      return;
    }

    const trigger = e.currentTarget;
    const rect = trigger.getBoundingClientRect();
    const MENU_HEIGHT = 270; // 5 items + 2 separators + padding
    const MENU_WIDTH = 200;
    const GAP = 4;

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;

    // Open upward if not enough room below AND more room above (last-row case)
    const openUp = spaceBelow < MENU_HEIGHT && spaceAbove >= spaceBelow;

    const pos = {
      position: 'fixed',
      left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)),
      right: 'auto',
      zIndex: 9999,
    };

    if (openUp) {
      pos.top = 'auto';
      pos.bottom = window.innerHeight - rect.top + GAP;
    } else {
      pos.top = rect.bottom + GAP;
      pos.bottom = 'auto';
    }

    // If neither direction has full room, cap with max-height + internal scroll
    const available = openUp ? spaceAbove - GAP - 8 : spaceBelow - GAP - 8;
    if (available < MENU_HEIGHT) {
      pos.maxHeight = Math.max(160, available);
      pos.overflowY = 'auto';
    }

    setMenuPos(pos);
    setOpenActionMenu(id);
  };

  // ✅ NEW: Close the menu when user scrolls or resizes (prevents stranded menus)
  useEffect(() => {
    if (!openActionMenu) return;
    const handleClose = () => {
      setOpenActionMenu(null);
      setMenuPos(null);
    };
    window.addEventListener('scroll', handleClose, true);
    window.addEventListener('resize', handleClose);
    return () => {
      window.removeEventListener('scroll', handleClose, true);
      window.removeEventListener('resize', handleClose);
    };
  }, [openActionMenu]);

  if (studentsLoading || classesLoading) return <Loading message="Loading students..." />;

  const getClassName = (classId) => {
    if (!classId) return 'Not Assigned';
    const cls = classes?.data?.find(c => (c._id || c.id) === classId || (c._id || c.id) === classId?._id || (c._id || c.id) === classId?.id);
    return cls ? `${cls.name} - ${cls.section}` : 'Unknown';
  };

  const getResultText = () => {
    const hasFilter = searchTerm.trim() || filterClass;
    if (hasFilter && filteredStudents.length !== students?.data?.length) return `Showing ${filteredStudents.length} of ${students?.data?.length}`;
    return `${students?.data?.length || 0} students`;
  };

  const getInitials = (firstName, lastName) => {
    return `${(firstName || '')[0] || ''}${(lastName || '')[0] || ''}`.toUpperCase();
  };

  const getAvatarColor = (name) => {
    const colors = ['#6366f1', '#8b5cf6', '#a855f7', '#d946ef', '#ec4899', '#f43f5e', '#ef4444', '#f97316', '#eab308', '#22c55e', '#14b8a6', '#06b6d4', '#0ea5e9', '#3b82f6'];
    let hash = 0;
    for (let i = 0; i < (name || '').length; i++) hash = name.charCodeAt(i) + ((hash << 5) - hash);
    return colors[Math.abs(hash) % colors.length];
  };

  const StudentAvatar = ({ student, size = 36, fontSize = '0.78rem' }) => {
    if (student.profileImage?.url) {
      return (
        <img
          src={student.profileImage.url}
          alt={`${student.firstName} ${student.lastName}`}
          style={{
            width: size, height: size, borderRadius: '50%', objectFit: 'cover',
            border: '2px solid var(--border)', background: '#f1f5f9'
          }}
        />
      );
    }
    return (
      <div className="ms-avatar" style={{ background: getAvatarColor(`${student.firstName}${student.lastName}`), width: size, height: size, fontSize }}>
        {getInitials(student.firstName, student.lastName)}
      </div>
    );
  };

  const sortedClasses = (classes?.data || [])
    .slice()
    .sort((a, b) => String(a.name || '').localeCompare(String(b.name || '')));

  return (
    <div className="ms-root">
      <style>{`
        .ms-root { --bg: #f1f5f9; --surface: #ffffff; --border: #e2e8f0; --text: #0f172a; --text-secondary: #475569; --text-muted: #94a3b8; --primary: #4f46e5; --primary-hover: #4338ca; --primary-light: #eef2ff; --danger: #ef4444; --danger-hover: #dc2626; --success: #10b981; --success-light: #ecfdf5; --warning: #f59e0b; --warning-light: #fffbeb; --radius: 12px; --radius-sm: 8px; --shadow-sm: 0 1px 2px rgba(0,0,0,0.05); --shadow: 0 1px 3px rgba(0,0,0,0.1), 0 1px 2px rgba(0,0,0,0.06); --shadow-lg: 0 10px 15px -3px rgba(0,0,0,0.1), 0 4px 6px -4px rgba(0,0,0,0.1); --transition: 150ms cubic-bezier(0.4, 0, 0.2, 1); font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; color: var(--text); -webkit-font-smoothing: antialiased; }
        .ms-header { background: var(--surface); border-bottom: 1px solid var(--border); padding: 20px 24px; position: sticky; top: 0; z-index: 30; }
        .ms-header-top { display: flex; align-items: center; justify-content: space-between; gap: 12px; flex-wrap: wrap; }
        .ms-header-title { font-size: 1.35rem; font-weight: 700; color: var(--text); margin: 0; letter-spacing: -0.02em; }
        .ms-header-sub { font-size: 0.82rem; color: var(--text-muted); margin: 2px 0 0; }
        .ms-header-actions { display: flex; gap: 8px; flex-wrap: wrap; }
        .ms-btn { display: inline-flex; align-items: center; gap: 6px; padding: 9px 16px; border-radius: var(--radius-sm); font-size: 0.82rem; font-weight: 600; border: none; cursor: pointer; transition: all var(--transition); white-space: nowrap; text-decoration: none; line-height: 1.4; }
        .ms-btn:active { transform: scale(0.97); }
        .ms-btn-primary { background: var(--primary); color: #fff; }
        .ms-btn-primary:hover { background: var(--primary-hover); }
        .ms-btn-success { background: var(--success); color: #fff; }
        .ms-btn-success:hover { background: #059669; }
        .ms-btn-ghost { background: var(--surface); color: var(--text-secondary); border: 1px solid var(--border); }
        .ms-btn-ghost:hover { background: #f8fafc; border-color: #cbd5e1; }
        .ms-btn-danger { background: var(--danger); color: #fff; }
        .ms-btn-danger:hover { background: var(--danger-hover); }
        .ms-btn-sm { padding: 6px 12px; font-size: 0.78rem; }
        .ms-btn:disabled { opacity: 0.5; cursor: not-allowed; transform: none !important; }
        .ms-search-bar { padding: 12px 24px; background: var(--bg); border-bottom: 1px solid var(--border); display: flex; align-items: center; gap: 12px; flex-wrap: wrap; }
        .ms-search-wrap { flex: 1; min-width: 200px; max-width: 420px; position: relative; }
        .ms-search-wrap svg { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: var(--text-muted); width: 16px; height: 16px; pointer-events: none; }
        .ms-search-input { width: 100%; padding: 10px 36px 10px 38px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; box-sizing: border-box; -webkit-appearance: none; }
        .ms-search-input::placeholder { color: var(--text-muted); }
        .ms-search-input:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .ms-search-clear { position: absolute; right: 8px; top: 50%; transform: translateY(-50%); background: #e2e8f0; border: none; border-radius: 50%; width: 22px; height: 22px; display: flex; align-items: center; justify-content: center; cursor: pointer; color: var(--text-muted); font-size: 14px; line-height: 1; }
        .ms-filter-select { padding: 10px 32px 10px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.84rem; color: var(--text); outline: none; transition: border-color var(--transition), box-shadow var(--transition); box-sizing: border-box; appearance: none; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='14' height='14' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2'%3E%3Cpolyline points='6 9 12 15 18 9'/%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 10px center; cursor: pointer; min-width: 170px; }
        .ms-filter-select:focus { border-color: var(--primary); box-shadow: 0 0 0 3px rgba(79,70,229,0.12); }
        .ms-filter-select option { color: var(--text); background: var(--surface); }
        .ms-result-count { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; white-space: nowrap; margin-left: auto; }
        .ms-alert { padding: 12px 16px; border-radius: var(--radius-sm); font-size: 0.84rem; font-weight: 500; display: flex; align-items: center; gap: 8px; margin: 12px 24px 0; animation: msSlideDown 0.25s ease; }
        .ms-alert-success { background: var(--success-light); color: #065f46; border: 1px solid #a7f3d0; }
        .ms-alert-danger { background: #fef2f2; color: #991b1b; border: 1px solid #fecaca; }
        .ms-alert-close { margin-left: auto; background: none; border: none; cursor: pointer; font-size: 1.2rem; line-height: 1; opacity: 0.6; color: inherit; padding: 0 2px; }
        @keyframes msSlideDown { from { opacity: 0; transform: translateY(-8px); } to { opacity: 1; transform: translateY(0); } }
        .ms-table-wrap { overflow-x: auto; -webkit-overflow-scrolling: touch; }
        .ms-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; min-width: 700px; }
        .ms-table thead { background: #f8fafc; position: sticky; top: 0; z-index: 5; }
        .ms-table th { padding: 12px 16px; text-align: left; font-weight: 600; font-size: 0.76rem; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); border-bottom: 1px solid var(--border); white-space: nowrap; }
        .ms-table td { padding: 14px 16px; border-bottom: 1px solid var(--border); vertical-align: middle; }
        .ms-table tbody tr { transition: background var(--transition); position: relative; }
        .ms-table tbody tr:hover { background: #f8fafc; }
        .ms-table tbody tr:last-child td { border-bottom: none; }
        .ms-empty { text-align: center; padding: 48px 24px; color: var(--text-muted); }
        .ms-empty-icon { font-size: 2.5rem; margin-bottom: 8px; display: block; }
        .ms-empty strong { color: var(--text-secondary); }
        .ms-badge { display: inline-flex; align-items: center; gap: 4px; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 600; white-space: nowrap; }
        .ms-badge-green { background: #dcfce7; color: #166534; }
        .ms-badge-amber { background: #fef3c7; color: #92400e; }
        .ms-badge-red { background: #fee2e2; color: #991b1b; }
        .ms-badge-blue { background: #dbeafe; color: #1e40af; }
        .ms-badge-indicator { width: 7px; height: 7px; border-radius: 50%; display: inline-block; flex-shrink: 0; }
        .ms-badge-indicator-green { background: #22c55e; }
        .ms-badge-indicator-red { background: #ef4444; }
        .ms-badge-indicator-amber { background: #f59e0b; }
        .ms-cards { display: none; flex-direction: column; gap: 10px; padding: 12px 16px; }
        .ms-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius); padding: 16px; }
        .ms-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 12px; }
        .ms-avatar { width: 42px; height: 42px; border-radius: '50%'; display: flex; align-items: center; justify-content: center; color: #fff; font-weight: 700; font-size: 0.85rem; flex-shrink: 0; letter-spacing: 0.02em; }
        .ms-card-name { font-weight: 600; font-size: 0.95rem; color: var(--text); line-height: 1.3; }
        .ms-card-adm { font-size: 0.78rem; color: var(--text-muted); font-weight: 500; margin-top: 1px; }
        .ms-card-badges { display: flex; gap: 6px; flex-wrap: wrap; margin-left: auto; }
        .ms-card-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 8px; margin-bottom: 14px; }
        .ms-card-field { display: flex; flex-direction: column; gap: 2px; }
        .ms-card-field-label { font-size: 0.7rem; font-weight: 600; text-transform: uppercase; letter-spacing: 0.04em; color: var(--text-muted); }
        .ms-card-field-value { font-size: 0.85rem; color: var(--text); font-weight: 500; }
        .ms-card-actions { display: flex; gap: 6px; flex-wrap: wrap; padding-top: 12px; border-top: 1px solid var(--border); }
        .ms-fees-btn { display: inline-flex; align-items: center; gap: 4px; padding: 4px 10px; border-radius: 6px; border: 1px solid; font-size: 0.72rem; font-weight: 600; cursor: pointer; white-space: nowrap; background: var(--surface); }
        .ms-fees-btn-grant { border-color: #f59e0b; color: #92400e; background: #fffbeb; }
        .ms-fees-btn-revoke { border-color: #22c55e; color: #166534; background: #f0fdf4; }
        .ms-fees-btn-owing { border-color: #ef4444; color: #991b1b; background: #fef2f2; }
        .ms-action-menu-wrap { position: relative; }
        .ms-action-trigger { width: 32px; height: 32px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); cursor: pointer; display: flex; align-items: center; justify-content: center; transition: all var(--transition); }
        .ms-action-trigger:hover { background: #f8fafc; border-color: #cbd5e1; }
        .ms-action-trigger svg { width: 16px; height: 16px; color: var(--text-muted); }
        .ms-action-menu { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-sm); box-shadow: var(--shadow-lg); min-width: 200px; overflow: hidden; animation: msMenuIn 0.15s ease; }
        @keyframes msMenuIn { from { opacity: 0; transform: translateY(-4px) scale(0.97); } to { opacity: 1; transform: translateY(0) scale(1); } }
        .ms-action-menu-item { display: flex; align-items: center; gap: 8px; width: 100%; padding: 10px 14px; border: none; background: none; font-size: 0.82rem; font-weight: 500; color: var(--text-secondary); cursor: pointer; transition: background var(--transition); text-align: left; }
        .ms-action-menu-item:hover { background: #f8fafc; }
        .ms-action-menu-item.danger { color: var(--danger); }
        .ms-action-menu-item.danger:hover { background: #fef2f2; }
        .ms-action-menu-sep { height: 1px; background: var(--border); margin: 2px 0; }
        .ms-modal-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.5); backdrop-filter: blur(4px); z-index: 100; display: flex; align-items: flex-end; justify-content: center; animation: msFadeIn 0.2s ease; }
        @keyframes msFadeIn { from { opacity: 0; } to { opacity: 1; } }
        .ms-modal { background: var(--surface); border-radius: 20px 20px 0 0; width: 100%; max-width: 560px; max-height: 90vh; overflow-y: auto; -webkit-overflow-scrolling: touch; animation: msSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        @keyframes msSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .ms-modal-handle { width: 36px; height: 4px; border-radius: 2px; background: #cbd5e1; margin: 10px auto 0; }
        .ms-modal-header { display: flex; align-items: center; justify-content: space-between; padding: 16px 20px 0; }
        .ms-modal-title { font-size: 1.1rem; font-weight: 700; color: var(--text); margin: 0; }
        .ms-modal-close { width: 32px; height: 32px; border-radius: 50%; border: none; background: #f1f5f9; cursor: pointer; display: flex; align-items: center; justify-content: center; color: var(--text-muted); font-size: 1.2rem; transition: all var(--transition); }
        .ms-modal-close:hover { background: #e2e8f0; color: var(--text); }
        .ms-modal-body { padding: 20px; }
        .ms-modal-footer { display: flex; gap: 10px; padding: 0 20px 24px; justify-content: flex-end; flex-wrap: wrap; }
        .ms-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 14px; margin-bottom: 14px; }
        .ms-form-group { display: flex; flex-direction: column; gap: 5px; }
        .ms-form-group.full { grid-column: 1 / -1; }
        .ms-form-label { font-size: 0.78rem; font-weight: 600; color: var(--text-secondary); }
        .ms-form-input, .ms-form-select { width: 100%; padding: 10px 14px; border-radius: var(--radius-sm); border: 1px solid var(--border); background: var(--surface); font-size: 0.88rem; color: var(--text); outline: none; box-sizing: border-box; -webkit-appearance: none; appearance: none; }
        .ms-form-input:disabled { background: #f8fafc; color: var(--text-muted); cursor: not-allowed; }
        .ms-form-select { background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 24 24' fill='none' stroke='%2394a3b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E"); background-repeat: no-repeat; background-position: right 12px center; padding-right: 36px; }
        .ms-form-hint { font-size: 0.75rem; color: var(--text-muted); font-style: italic; }
        .ms-progress-bar { height: 6px; background: #e2e8f0; border-radius: 3px; overflow: hidden; }
        .ms-progress-fill { height: 100%; background: var(--primary); border-radius: 3px; transition: width 0.3s ease; }
        .ms-upload-log { max-height: 160px; overflow-y: auto; background: #f8fafc; padding: 12px; border-radius: var(--radius-sm); font-family: 'SF Mono', 'Fira Code', monospace; font-size: 0.76rem; line-height: 1.6; color: var(--text-secondary); }
        .ms-upload-preview { max-height: 200px; overflow-y: auto; border: 1px solid var(--border); border-radius: var(--radius-sm); }
        .ms-upload-preview table { width: 100%; border-collapse: collapse; font-size: 0.8rem; }
        .ms-upload-preview th { padding: 8px 10px; text-align: left; font-weight: 600; font-size: 0.72rem; text-transform: uppercase; letter-spacing: 0.03em; color: var(--text-muted); background: #f8fafc; position: sticky; top: 0; }
        .ms-upload-preview td { padding: 7px 10px; border-top: 1px solid var(--border); }
        .ms-img-progress-overlay { position: fixed; inset: 0; background: rgba(15,23,42,0.45); backdrop-filter: blur(4px); z-index: 160; display: flex; align-items: center; justify-content: center; animation: msFadeIn 0.2s ease; }
        .ms-img-progress-card { background: var(--surface); border-radius: var(--radius); padding: 28px 32px; box-shadow: var(--shadow-lg); min-width: 300px; max-width: 380px; text-align: center; animation: msSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1); }
        .ms-img-progress-icon { font-size: 2rem; margin-bottom: 12px; display: block; }
        .ms-img-progress-title { font-size: 0.95rem; font-weight: 700; color: var(--text); margin: 0 0 4px; }
        .ms-img-progress-subtitle { font-size: 0.78rem; color: var(--text-muted); margin: 0 0 18px; }
        .ms-img-progress-pct { font-size: 1.6rem; font-weight: 800; color: var(--primary); margin-bottom: 10px; }
        .ms-img-progress-bar { height: 10px; background: #e2e8f0; border-radius: 5px; overflow: hidden; margin-bottom: 6px; }
        .ms-img-progress-fill { height: 100%; background: linear-gradient(90deg, #4f46e5, #818cf8); border-radius: 5px; transition: width 0.2s ease; }
        .ms-camera-overlay { position: fixed; inset: 0; background: #000; z-index: 200; display: flex; flex-direction: column; animation: msFadeIn 0.2s ease; }
        .ms-camera-header { display: flex; align-items: center; justify-content: space-between; padding: 14px 18px; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); z-index: 5; flex-shrink: 0; }
        .ms-camera-title { font-size: 0.92rem; font-weight: 600; color: #fff; margin: 0; }
        .ms-camera-close { width: 36px; height: 36px; border-radius: 50%; border: none; background: rgba(255,255,255,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; font-size: 1.3rem; }
        .ms-camera-close:hover { background: rgba(255,255,255,0.25); }
        .ms-camera-viewport { flex: 1; display: flex; align-items: center; justify-content: center; position: relative; overflow: hidden; background: #0a0a0a; }
        .ms-camera-video { width: 100%; height: 100%; object-fit: cover; display: block; }
        .ms-camera-guide { position: absolute; width: min(65vw, 320px); height: min(65vw, 320px); border-radius: 50%; border: 3px solid rgba(255,255,255,0.45); box-shadow: 0 0 0 9999px rgba(0,0,0,0.45); pointer-events: none; }
        .ms-camera-guide-label { position: absolute; bottom: -32px; left: 50%; transform: translateX(-50%); font-size: 0.72rem; color: rgba(255,255,255,0.5); white-space: nowrap; font-weight: 500; }
        .ms-camera-loading { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 12px; color: rgba(255,255,255,0.7); font-size: 0.85rem; }
        .ms-camera-spinner { width: 32px; height: 32px; border: 3px solid rgba(255,255,255,0.2); border-top-color: #fff; border-radius: 50%; animation: msSpin 0.8s linear infinite; }
        @keyframes msSpin { to { transform: rotate(360deg); } }
        .ms-camera-error { position: absolute; display: flex; flex-direction: column; align-items: center; gap: 10px; padding: 24px; text-align: center; max-width: 320px; }
        .ms-camera-error-icon { font-size: 2rem; }
        .ms-camera-error-text { color: rgba(255,255,255,0.8); font-size: 0.85rem; line-height: 1.5; }
        .ms-camera-footer { display: flex; align-items: center; justify-content: center; gap: 24px; padding: 20px 18px 28px; background: rgba(0,0,0,0.6); backdrop-filter: blur(8px); flex-shrink: 0; }
        .ms-camera-snap-btn { width: 72px; height: 72px; border-radius: 50%; border: 4px solid #fff; background: transparent; cursor: pointer; position: relative; flex-shrink: 0; }
        .ms-camera-snap-btn::after { content: ''; position: absolute; inset: 4px; border-radius: 50%; background: #fff; }
        .ms-camera-snap-btn:active { transform: scale(0.92); }
        .ms-camera-snap-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .ms-camera-side-btn { width: 48px; height: 48px; border-radius: 50%; border: none; background: rgba(255,255,255,0.15); cursor: pointer; display: flex; align-items: center; justify-content: center; color: #fff; flex-shrink: 0; }
        .ms-camera-side-btn:disabled { opacity: 0.3; cursor: not-allowed; }
        .ms-camera-side-btn svg { width: 22px; height: 22px; }
        .ms-click-outside { position: fixed; inset: 0; z-index: 40; }
        @media (min-width: 768px) {
          .ms-modal-overlay { align-items: center; }
          .ms-modal { border-radius: 20px; max-width: 560px; }
          .ms-modal-handle { display: none; }
          .ms-cards { display: none !important; }
          .ms-table-section { display: block !important; }
          .ms-header { padding: 24px 32px; }
          .ms-search-bar { padding: 12px 32px; }
          .ms-alert { margin-left: 32px; margin-right: 32px; }
        }
        @media (max-width: 767px) {
          .ms-header { padding: 16px; }
          .ms-header-actions { width: 100%; }
          .ms-header-actions .ms-btn { flex: 1; justify-content: center; padding: 10px 10px; font-size: 0.78rem; }
          .ms-search-bar { padding: 10px 16px; }
          .ms-search-wrap { flex: 1 1 100%; max-width: 100%; }
          .ms-filter-select { flex: 1 1 100%; min-width: 100%; }
          .ms-alert { margin-left: 16px; margin-right: 16px; }
          .ms-table-section { display: none !important; }
          .ms-cards { display: flex !important; }
          .ms-form-row { grid-template-columns: 1fr; }
          .ms-modal { max-height: 95vh; border-radius: 16px 16px 0 0; }
        }
        @media (max-width: 380px) {
          .ms-header-actions { flex-direction: column; }
          .ms-card-grid { grid-template-columns: 1fr; }
        }
        .ms-root ::-webkit-scrollbar { width: 6px; height: 6px; }
        .ms-root ::-webkit-scrollbar-thumb { background: #cbd5e1; border-radius: 3px; }
      `}</style>

      <input
        type="file"
        ref={imageInputRef}
        accept="image/jpeg,image/png,image/webp,image/gif"
        onChange={handleImageChange}
        style={{ display: 'none' }}
      />

      <canvas ref={canvasRef} style={{ display: 'none' }} />

      {imageUploading && (
        <div className="ms-img-progress-overlay">
          <div className="ms-img-progress-card">
            <span className="ms-img-progress-icon">📤</span>
            <p className="ms-img-progress-title">Uploading Photo</p>
            <p className="ms-img-progress-subtitle">Please wait while the image uploads...</p>
            <div className="ms-img-progress-pct">{imageUploadProgress}%</div>
            <div className="ms-img-progress-bar">
              <div className="ms-img-progress-fill" style={{ width: `${imageUploadProgress}%` }}></div>
            </div>
          </div>
        </div>
      )}

      <div className="ms-header">
        <div className="ms-header-top">
          <div>
            <h1 className="ms-header-title">Students</h1>
            <p className="ms-header-sub">Manage student accounts, photos &amp; fees access</p>
          </div>
          <div className="ms-header-actions">
            <button className="ms-btn ms-btn-ghost" onClick={exportStudentsCSV} disabled={!students?.data?.length} title={(searchTerm.trim() || filterClass) ? 'Export filtered results' : 'Export all students'}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>
              <span>Export</span>
            </button>
            <button className="ms-btn ms-btn-success" onClick={handleOpenUploadModal}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{width:15,height:15}}><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
              <span>Upload CSV</span>
            </button>
            <button className="ms-btn ms-btn-primary" onClick={handleOpenCreate}>
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" style={{width:15,height:15}}><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
              <span>Add Student</span>
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="ms-alert ms-alert-danger">
          {error}
          <button className="ms-alert-close" onClick={() => setError('')}>×</button>
        </div>
      )}
      {successMessage && (
        <div className="ms-alert ms-alert-success">
          {successMessage}
          <button className="ms-alert-close" onClick={() => setSuccessMessage('')}>×</button>
        </div>
      )}

      <div className="ms-search-bar">
        <div className="ms-search-wrap">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
          <input type="text" className="ms-search-input" placeholder="Search by name or admission no..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} />
          {searchTerm && <button className="ms-search-clear" onClick={() => setSearchTerm('')}>×</button>}
        </div>

        <select className="ms-filter-select" value={filterClass} onChange={(e) => setFilterClass(e.target.value)} title="Filter by class">
          <option value="">All Classes</option>
          {sortedClasses.map((cls) => (
            <option key={cls._id || cls.id} value={cls._id || cls.id}>
              {cls.name}{cls.section ? ` - ${cls.section}` : ''}
            </option>
          ))}
        </select>

        <span className="ms-result-count">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>
          {getResultText()}
        </span>
      </div>

      <div className="ms-table-section" style={{ background: 'var(--surface)', minHeight: '200px' }}>
        <div className="ms-table-wrap">
          <table className="ms-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Fees</th>
                <th>Gender</th>
                <th>Class</th>
                <th style={{width: 50}}></th>
              </tr>
            </thead>
            <tbody>
              {filteredStudents.length === 0 ? (
                <tr><td colSpan="5" className="ms-empty">
                  <span className="ms-empty-icon">👨‍🎓</span>
                  {(searchTerm.trim() || filterClass) ? (
                    <>No students found{searchTerm.trim() ? <> for "<strong>{searchTerm}</strong>"</> : ''}{filterClass ? ' with this class filter' : ''}.</>
                  ) : 'No students yet. Add your first student to get started.'}
                </td></tr>
              ) : filteredStudents.map((student) => {
                const studentId = student._id || student.id;
                const feesBadge = getFeesStatusBadge(student);
                return (
                  <tr key={studentId}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                        <StudentAvatar student={student} />
                        <div>
                          <div style={{ fontWeight: 600, fontSize: '0.9rem', lineHeight: 1.3 }}>{student.firstName} {student.lastName}</div>
                          <div style={{ fontSize: '0.78rem', color: 'var(--text-muted)', fontWeight: 500 }}>{student.admissionNumber}</div>
                        </div>
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                        <span className={`ms-badge ms-badge-${feesBadge.color}`}>
                          <span className={`ms-badge-indicator ms-badge-indicator-${feesBadge.color}`} />
                          {feesBadge.label}
                        </span>
                        {student.owingFees && (
                          <button className={`ms-fees-btn ${student.feesAccessGranted ? 'ms-fees-btn-revoke' : 'ms-fees-btn-grant'}`}
                            onClick={(e) => handleToggleFeesAccess(studentId, e)}
                            title={student.feesAccessGranted ? 'Revoke fees access' : 'Grant fees access'}>
                            {student.feesAccessGranted ? 'Revoke' : 'Grant'}
                          </button>
                        )}
                        <button className="ms-fees-btn ms-fees-btn-owing" onClick={(e) => handleToggleOwing(studentId, e)} title="Toggle owing status">
                          Owing
                        </button>
                      </div>
                    </td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{student.gender || '—'}</td>
                    <td style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>{getClassName(student.classId)}</td>
                    <td>
                      <div className="ms-action-menu-wrap">
                        <button className="ms-action-trigger" onClick={(e) => toggleActionMenu(studentId, e)}>
                          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>
                        </button>
                        {openActionMenu === studentId && menuPos && (
                          <>
                            <div className="ms-click-outside" onClick={() => { setOpenActionMenu(null); setMenuPos(null); }} />
                            <div className="ms-action-menu" style={menuPos}>
                              <button className="ms-action-menu-item" onClick={(e) => { setOpenActionMenu(null); setMenuPos(null); handleOpenCamera(studentId, e); }}>📷 Take Photo</button>
                              <button className="ms-action-menu-item" onClick={(e) => { setOpenActionMenu(null); setMenuPos(null); handleImageClick(studentId, e); }}>🖼️ Upload Photo</button>
                              {student.profileImage?.url && (
                                <button className="ms-action-menu-item danger" onClick={(e) => { setOpenActionMenu(null); setMenuPos(null); handleRemoveImage(studentId, e); }}>🗑️ Remove Photo</button>
                              )}
                              <div className="ms-action-menu-sep" />
                              <button className="ms-action-menu-item" onClick={() => { setOpenActionMenu(null); setMenuPos(null); handleOpenEdit(student); }}>✏️ Edit Student</button>
                              <div className="ms-action-menu-sep" />
                              <button className="ms-action-menu-item danger" onClick={() => { setOpenActionMenu(null); setMenuPos(null); handleDelete(studentId); }}>🗑️ Delete Student</button>
                            </div>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className="ms-cards">
        {filteredStudents.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '48px 16px', color: 'var(--text-muted)' }}>
            <span style={{ fontSize: '2.5rem', display: 'block', marginBottom: 8 }}>👨‍🎓</span>
            {(searchTerm.trim() || filterClass) ? 'No students found.' : 'No students yet.'}
          </div>
        ) : filteredStudents.map((student) => {
          const studentId = student._id || student.id;
          const feesBadge = getFeesStatusBadge(student);
          return (
            <div className="ms-card" key={studentId}>
              <div className="ms-card-top">
                <StudentAvatar student={student} size={42} fontSize="0.85rem" />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="ms-card-name">{student.firstName} {student.lastName}</div>
                  <div className="ms-card-adm">{student.admissionNumber}</div>
                </div>
                <div className="ms-card-badges">
                  <span className={`ms-badge ms-badge-${feesBadge.color}`}>{feesBadge.icon} {feesBadge.label}</span>
                </div>
              </div>
              <div className="ms-card-grid">
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Gender</span>
                  <span className="ms-card-field-value">{student.gender || '—'}</span>
                </div>
                <div className="ms-card-field">
                  <span className="ms-card-field-label">Class</span>
                  <span className="ms-card-field-value">{getClassName(student.classId)}</span>
                </div>
              </div>
              <div className="ms-card-actions">
                <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={() => handleOpenEdit(student)}>Edit</button>
                <button className="ms-btn ms-btn-ghost ms-btn-sm" onClick={(e) => handleImageClick(studentId, e)}>Photo</button>
                <button className="ms-btn ms-btn-danger ms-btn-sm" onClick={() => handleDelete(studentId)}>Delete</button>
              </div>
            </div>
          );
        })}
      </div>

      {showModal && (
        <div className="ms-modal-overlay" onClick={handleCloseModal}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-handle" />
            <div className="ms-modal-header">
              <h3 className="ms-modal-title">{editingStudent ? 'Edit Student' : 'Add New Student'}</h3>
              <button className="ms-modal-close" onClick={handleCloseModal}>×</button>
            </div>
            <div className="ms-modal-body">
              {error && <div className="ms-alert ms-alert-danger" style={{ margin: 0, marginBottom: 14 }}>{error}</div>}
              <form onSubmit={handleSubmit}>
                <div className="ms-form-row">
                  <div className="ms-form-group">
                    <label className="ms-form-label">First Name *</label>
                    <input type="text" name="firstName" className="ms-form-input" value={formData.firstName} onChange={handleChange} required />
                  </div>
                  <div className="ms-form-group">
                    <label className="ms-form-label">Last Name *</label>
                    <input type="text" name="lastName" className="ms-form-input" value={formData.lastName} onChange={handleChange} required />
                  </div>
                </div>
                <div className="ms-form-row">
                  <div className="ms-form-group">
                    <label className="ms-form-label">Admission Number</label>
                    <input type="text" name="admissionNumber" className="ms-form-input" value={formData.admissionNumber} onChange={handleChange} disabled={!editingStudent} />
                    {!editingStudent && <span className="ms-form-hint">Auto-generated when left blank</span>}
                  </div>
                  <div className="ms-form-group">
                    <label className="ms-form-label">Gender</label>
                    <select name="gender" className="ms-form-input ms-form-select" value={formData.gender} onChange={handleChange}>
                      <option value="">Select Gender</option>
                      <option value="Male">Male</option>
                      <option value="Female">Female</option>
                      <option value="Other">Other</option>
                    </select>
                  </div>
                </div>
                <div className="ms-form-group full" style={{ marginBottom: 0 }}>
                  <label className="ms-form-label">Class</label>
                  <select name="classId" className="ms-form-input ms-form-select" value={formData.classId} onChange={handleChange}>
                    <option value="">Not Assigned</option>
                    {classes?.data?.map(c => (
                      <option key={c._id || c.id} value={c._id || c.id}>{c.name} {c.section ? `- ${c.section}` : ''}</option>
                    ))}
                  </select>
                </div>
              </form>
            </div>
            <div className="ms-modal-footer">
              <button type="button" className="ms-btn ms-btn-ghost" onClick={handleCloseModal}>Cancel</button>
              <button type="button" className="ms-btn ms-btn-primary" onClick={handleSubmit}
                disabled={createMutation.isPending || createMutation.isLoading || updateMutation.isPending || updateMutation.isLoading}>
                {(createMutation.isPending || createMutation.isLoading || updateMutation.isPending || updateMutation.isLoading) ? 'Saving...' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showUploadModal && (
        <div className="ms-modal-overlay" onClick={handleCloseUploadModal}>
          <div className="ms-modal" onClick={(e) => e.stopPropagation()}>
            <div className="ms-modal-handle" />
            <div className="ms-modal-header">
              <h3 className="ms-modal-title">Bulk Upload Students</h3>
              <button className="ms-modal-close" onClick={handleCloseUploadModal} disabled={isUploading}>×</button>
            </div>
            <div className="ms-modal-body">
              <div style={{ marginBottom: 12, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                <span className="ms-form-hint">Admission Number, Photo URL &amp; fees columns are optional. Leave Admission Number blank to auto-generate.</span>
                <button type="button" className="ms-btn ms-btn-ghost ms-btn-sm" onClick={downloadSampleCSV}>Download Sample</button>
              </div>
              <input type="file" accept=".csv" ref={fileInputRef} onChange={handleFileChange}
                style={{ width: '100%', padding: 10, border: '1px dashed #cbd5e1', borderRadius: 'var(--radius-sm)', boxSizing: 'border-box', cursor: 'pointer' }}
                disabled={isUploading} />

              {csvError && <div className="ms-alert ms-alert-danger" style={{ margin: '12px 0 0' }}>{csvError}</div>}

              {parsedStudents.length > 0 && (
                <div className="ms-upload-preview" style={{ marginTop: 12 }}>
                  <table>
                    <thead>
                      <tr><th>Row</th><th>Adm No</th><th>Name</th><th>Class</th><th>Photo</th></tr>
                    </thead>
                    <tbody>
                      {parsedStudents.map(s => (
                        <tr key={s._rowNumber}>
                          <td>{s._rowNumber}</td>
                          <td>{s.admissionNumber || <span style={{ color: 'var(--text-muted)', fontStyle: 'italic' }}>auto</span>}</td>
                          <td>{s.firstName} {s.lastName}</td>
                          <td>
                            {s.classId
                              ? `${s._className}${s._section ? ' - ' + s._section : ''}`
                              : <span style={{ color: '#92400e', fontStyle: 'italic' }}>no class</span>}
                          </td>
                          <td>{s._hasPhoto ? '📷' : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {isUploading && (
                <div style={{ marginTop: 16 }}>
                  <div className="ms-progress-bar">
                    <div className="ms-progress-fill" style={{ width: `${(uploadProgress.current / uploadProgress.total) * 100}%` }} />
                  </div>
                  <p className="ms-form-hint" style={{ marginTop: 6 }}>Uploading {uploadProgress.current} of {uploadProgress.total}...</p>
                </div>
              )}

              {uploadLog.length > 0 && (
                <div className="ms-upload-log" style={{ marginTop: 12 }}>
                  {uploadLog.map((log, i) => <div key={i}>{log}</div>)}
                </div>
              )}
            </div>
            <div className="ms-modal-footer">
              <button className="ms-btn ms-btn-ghost" onClick={handleCloseUploadModal} disabled={isUploading}>Close</button>
              <button className="ms-btn ms-btn-success" onClick={handleBulkUpload} disabled={parsedStudents.length === 0 || isUploading}>
                {isUploading ? 'Importing...' : `Import ${parsedStudents.length} Student(s)`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCameraModal && (
        <div className="ms-camera-overlay">
          <div className="ms-camera-header">
            <h3 className="ms-camera-title">Take Profile Photo</h3>
            <button className="ms-camera-close" onClick={handleCloseCameraModal}>×</button>
          </div>
          <div className="ms-camera-viewport">
            <video ref={videoRef} className="ms-camera-video" autoPlay playsInline muted style={{ display: cameraReady ? 'block' : 'none' }} />
            {cameraReady && (
              <div className="ms-camera-guide">
                <span className="ms-camera-guide-label">Position the face inside the circle</span>
              </div>
            )}
            {!cameraReady && !cameraError && (
              <div className="ms-camera-loading">
                <div className="ms-camera-spinner" />
                <span>Starting camera...</span>
              </div>
            )}
            {cameraError && (
              <div className="ms-camera-error">
                <span className="ms-camera-error-icon">📷</span>
                <span className="ms-camera-error-text">{cameraError}</span>
                <button className="ms-btn ms-btn-primary ms-btn-sm" onClick={() => startCamera(cameraFacingMode)}>Retry</button>
              </div>
            )}
          </div>
          <div className="ms-camera-footer">
            <button className="ms-camera-side-btn" onClick={handleFlipCamera} disabled={!cameraReady} title="Flip camera">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg>
            </button>
            <button className="ms-camera-snap-btn" onClick={handleSnapPhoto} disabled={!cameraReady} aria-label="Take photo" />
            <div style={{ width: 48 }} />
          </div>
        </div>
      )}
    </div>
  );
};

export default ManageStudents;
