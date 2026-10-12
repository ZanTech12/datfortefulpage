import axios from 'axios';

// ✅ Dynamic URL Logic for Network Settings
const DEFAULT_PROD_URL = 'https://aback-xi.vercel.app';
const DEFAULT_LOCAL_URL = 'https://aback-xi.vercel.app';

const getDefaultUrl = () => {
  // 1. Optional build-time override (set REACT_APP_API_URL when building)
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // 2. Runtime detection: if the app is served from a local address
  //    (desktop .exe via Electron, or testing the build locally),
  //    the API is on the local machine — NOT the cloud backend.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return DEFAULT_LOCAL_URL;             // https://aback-xi.vercel.app
    }
    // LAN access via IP (e.g. 10.75.46.121) → backend on same machine
    if (host.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
      return `http://${host}:5000`;
    }
  }

  // 3. Deployed on a real domain (okispecial.com.ng etc.) → cloud backend
  if (process.env.NODE_ENV === 'production') {
    return DEFAULT_PROD_URL;
  }

  // 4. Dev server fallback
  return DEFAULT_LOCAL_URL;
};
export const getApiBaseUrl = () => {
  if (typeof window !== 'undefined') {
    const customUrl = localStorage.getItem('custom_backend_url');
    if (customUrl) return customUrl; // 1. Check Network Settings override
  }
  return getDefaultUrl(); // 2. Auto-detect or fallback
};

const api = axios.create({
  baseURL: getApiBaseUrl(),
  headers: { 'Content-Type': 'application/json' },
});

// ✅ Export AFTER the create call — at the module's top level
export { api };

// Request interceptor to add auth token
api.interceptors.request.use(
    (config) => {
        // ✅ Next.js Fix: Ensure this runs only in the browser
        if (typeof window !== 'undefined') {
            const token = localStorage.getItem('token'); // Fixed to match saveAuthData
            if (token) {
                config.headers.Authorization = `Bearer ${token}`;
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

// ✅ Response interceptor with Auto-Fallback for Network Errors
api.interceptors.response.use(
    (response) => response,
    async (error) => {
        const originalRequest = error.config;
        
        // If Network Error (server unreachable) and we are using a custom URL
        if (error.code === 'ERR_NETWORK' && typeof window !== 'undefined' && localStorage.getItem('custom_backend_url') && !originalRequest._retried) {
            console.warn('⚠️ Custom backend unreachable. Falling back to default server...');
            
            localStorage.removeItem('custom_backend_url');
            localStorage.removeItem('custom_backend_ip');
            localStorage.removeItem('custom_backend_port');
            
            api.defaults.baseURL = getDefaultUrl();
            
            originalRequest._retried = true;
            originalRequest.baseURL = getDefaultUrl();
            return api(originalRequest);
        }
        
        // ✅ FIXED: Only log out on 401s from requests that actually carried
        //    a token. Anonymous 401s (the app's pre-login page-load calls —
        //    the "[DEBUG Auth] No token provided" spam) must NOT wipe the
        //    session or force-reload the page. The old behavior caused a
        //    reload loop on client devices: page loads → anonymous 401 →
        //    reload → form cleared mid-login → repeat.
        if (typeof window !== 'undefined' && error.response?.status === 401) {
            const hadToken = !!error.config?.headers?.Authorization;
            if (hadToken) {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }
        }
        return Promise.reject(error);
    }
);

// ============================================
// AUTHENTICATION API
// ============================================
export const authAPI = {
    loginSuperAdmin: async (credentials) => {
        const response = await api.post('/login/superadmin', credentials);
        return response.data;
    },
    
    // ✅ ADDED: For Admin, SuperAdmin, and Teacher login
    login: async (credentials) => {
        const response = await api.post('/login', credentials);
        return response.data;
    },
    
    // ✅ ADDED: For Student login
    loginStudent: async (credentials) => {
        const response = await api.post('/login/student', credentials);
        return response.data;
    },

    // ✅ Public route for Admin to register using the token
    registerAdmin: async (registrationData) => {
        const response = await api.post('/superadmin/register', registrationData);
        return response.data;
    }
};

// ============================================
// SUPERADMIN API
// ============================================
export const superAdminAPI = {
    getAllAdmins: async () => {
        // ✅ Updated to match backend route: router.get('/', ...)
        const response = await api.get('/superadmin');
        return response.data;
    },
    
    // ✅ CHANGED: Generate token instead of creating account directly
    generateAdminToken: async (tokenData) => {
        // ✅ Updated to match backend route: router.post('/generate-token', ...)
        const response = await api.post('/superadmin/generate-token', tokenData);
        return response.data;
    },
    
    updateAdmin: async (id, adminData) => {
        // ✅ Updated to match backend route: router.put('/:id', ...)
        const response = await api.put(`/superadmin/${id}`, adminData);
        return response.data;
    },
    
    toggleAdminStatus: async (id) => {
        // ✅ Updated to match backend route: router.patch('/:id/toggle', ...)
        const response = await api.patch(`/superadmin/${id}/toggle`);
        return response.data;
    },
    
    deleteAdmin: async (id) => {
        // ✅ Updated to match backend route: router.delete('/:id', ...)
        const response = await api.delete(`/superadmin/${id}`);
        return response.data;
    }
};

// ============================================
// DASHBOARD & STATS API
// ============================================
export const dashboardAPI = {
    getStats: async () => {
        const response = await api.get('/dashboard/stats');
        return response.data;
    },

    getTeacherCount: async () => {
        const response = await api.get('/teachers/count');
        return response.data;
    },

    getStudentCount: async () => {
        const response = await api.get('/students/count');
        return response.data;
    },

    getClassCount: async () => {
        const response = await api.get('/classes/count');
        return response.data;
    },

    getSubjectCount: async () => {
        const response = await api.get('/subjects/count');
        return response.data;
    },

    getQuestionCount: async () => {
        const response = await api.get('/questions/count');
        return response.data;
    },

    getTestCount: async () => {
        const response = await api.get('/tests/count');
        return response.data;
    },

    // Get last teacher logins for teacher dashboard
    getLastTeacherLogins: async () => {
        const response = await api.get('/dashboard/teacher-logins');
        return response.data;
    },

    // ==========================================
    // TEACHER ASSIGNMENTS (For AssignTeachers component)
    // ==========================================

    getTeachers: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },

    getClasses: async () => {
        const response = await api.get('/classes', {
            params: { limit: 1000 }
        });
        return response.data;
    },

    getSubjects: async () => {
        const response = await api.get('/subjects');
        return response.data;
    },

    getTeacherAssignments: async () => {
        const response = await api.get('/teacher-assignments');
        return response.data;
    },

    createTeacherAssignment: async (assignmentData) => {
        const response = await api.post('/teacher-assignments', assignmentData);
        return response.data;
    },

    updateTeacherAssignment: async (id, assignmentData) => {
        const response = await api.put(`/teacher-assignments/${id}`, assignmentData);
        return response.data;
    },

    deleteTeacherAssignment: async (id) => {
        const response = await api.delete(`/teacher-assignments/${id}`);
        return response.data;
    },

    checkAssignmentExists: async (teacherId, classId, subjectId) => {
        const response = await api.get('/teacher-assignments/check', {
            params: { teacher_id: teacherId, class_id: classId, subject_id: subjectId }
        });
        return response.data;
    },

    getAssignmentsByTeacher: async (teacherId) => {
        const response = await api.get(`/teacher-assignments/teacher/${teacherId}`);
        return response.data;
    },

    getAssignmentsByClass: async (classId) => {
        const response = await api.get(`/teacher-assignments/class/${classId}`);
        return response.data;
    },

    getAssignmentsBySubject: async (subjectId) => {
        const response = await api.get(`/teacher-assignments/subject/${subjectId}`);
        return response.data;
    },
};

// ============================================
// TEACHERS API
// ============================================
export const teachersAPI = {
    getAll: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },

    create: async (teacherData) => {
        const response = await api.post('/teachers', teacherData);
        return response.data;
    },

    update: async (id, teacherData) => {
        const response = await api.put(`/teachers/${id}`, teacherData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/teachers/${id}`);
        return response.data;
    },
};

// ============================================
// STUDENTS API (UPDATED WITH RECYCLE BIN FEATURE + RESULT ACCESS BLOCKING)
// ============================================
export const studentsAPI = {
    getAll: async () => {
        const response = await api.get('/students');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/students/${id}`);
        return response.data;
    },

    create: async (studentData) => {
        const { admissionNumber, ...dataToSubmit } = studentData;
        // Only send admissionNumber when explicitly provided (bulk import).
        // Manual creates leave it out so the backend auto-generates.
        if (admissionNumber && String(admissionNumber).trim()) {
            dataToSubmit.admissionNumber = String(admissionNumber).trim();
        }
        const response = await api.post('/students', dataToSubmit);
        return response.data;
    },

    update: async (id, studentData) => {
        const { admissionNumber, ...dataToSubmit } = studentData;
        const response = await api.put(`/students/${id}`, dataToSubmit);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/students/${id}`);
        return response.data;
    },

    deleteTestResult: async (studentId, testId) => {
        const response = await api.delete(`/students/${studentId}/test-results/${testId}`);
        return response.data;
    },

    // ==========================================
    // FEES ACCESS MANAGEMENT
    // ==========================================

    toggleFeesAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-fees-access`);
        return response.data;
    },

    toggleOwing: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-owing`);
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS BLOCKING
    // ==========================================

    toggleResultAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-result-access`);
        return response.data;
    },

    blockResultAccess: async (studentId, data) => {
        const response = await api.patch(`/students/${studentId}/block-result-access`, data);
        return response.data;
    },

    bulkResultAccess: async (data) => {
        const response = await api.patch('/students/bulk-result-access', data);
        return response.data;
    },

    // ==========================================
    // RECYCLE BIN MANAGEMENT
    // ==========================================

    getRecycleBin: async () => {
        const response = await api.get('/students/recycle-bin');
        return response.data;
    },

    restoreFromRecycleBin: async (id) => {
        const response = await api.put(`/students/restore/${id}`);
        return response.data;
    },

    permanentlyDelete: async (id) => {
        const response = await api.delete(`/students/permanent/${id}`);
        return response.data;
    },

    // ==========================================
    // PROFILE IMAGE MANAGEMENT (ADMIN)
    // ==========================================

    uploadProfileImage: async (studentId, file, config = {}) => {
        const formData = new FormData();
        formData.append('profileImage', file);

        const response = await api.post(`/students/${studentId}/profile-image`, formData, {
            ...config, // This allows the progress bar to work
            transformRequest: [(data, headers) => {
                delete headers['Content-Type']; // Let browser set multipart boundary
                return data;
            }]
        });

        return response.data;
    },

    removeProfileImage: async (studentId) => {
        const response = await api.delete(`/students/${studentId}/profile-image`);
        return response.data;
    },

    // ==========================================
    // STUDENT PROMOTION (NEW)
    // ==========================================

    // Dry-run: returns the full promotion plan without changing anything
    promotionPreview: async () => {
        const response = await api.post('/students/promotion/preview');
        return response.data;
    },

    // Execute: runs the promotion (all-or-nothing transaction)
    promoteStudents: async () => {
        const response = await api.post('/students/promotion/execute');
        return response.data;
    },

    // ==========================================
    // TEMPORARY: one-time counter repair.
    // Call once after deploying, then remove this method
    // (and its route) on the next deploy.
    // ==========================================
    resetCounter: async () => {
        const response = await api.post('/students/reset-counter');
        return response.data;
    },
};

// ============================================
// SUBJECTS API
// ============================================
export const subjectsAPI = {
    getAll: async () => {
        const response = await api.get('/subjects');
        return response.data;
    },

    create: async (subjectData) => {
        const response = await api.post('/subjects', subjectData);
        return response.data;
    },

    update: async (id, subjectData) => {
        const response = await api.put(`/subjects/${id}`, subjectData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/subjects/${id}`);
        return response.data;
    },

        getByClass: async (classId) => {
        // ✅ Guard: reject names/undefined loudly at the source — requires a numeric ID
        if (!/^\d+$/.test(String(classId))) {
            throw new Error(`getByClass requires a numeric class ID, received: "${classId}"`);
        }
        const response = await api.get(`/subjects/by-class/${classId}`);
        return response.data;
    },
};

// ============================================
// CLASSES API (UPDATED WITH RESULT ACCESS BLOCKING)
// ============================================
export const classesAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/classes', { params });
        return response.data;
    },

    getAllForDropdown: async () => {
        const response = await api.get('/classes', {
            params: { limit: 1000 }
        });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/classes/${id}`);
        return response.data;
    },

    create: async (classData) => {
        const response = await api.post('/classes', classData);
        return response.data;
    },

    update: async (id, classData) => {
        const response = await api.put(`/classes/${id}`, classData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/classes/${id}`);
        return response.data;
    },

    getByTeacher: async (teacherId) => {
        const response = await api.get(`/classes/teacher/${teacherId}`);
        return response.data;
    },

    getWithSubjects: async (id) => {
        const response = await api.get(`/classes-with-subjects/${id}`);
        return response.data;
    },

    getWithResults: async () => {
        const response = await api.get('/api/classes/results');
        return response.data;
    },

    getClassSubjectResults: async (classId, subjectId) => {
        const response = await api.get(`/api/classes/${classId}/subjects/${subjectId}/results`);
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS BLOCKING (NEW)
    // ==========================================

    toggleResultAccess: async (classId) => {
        const response = await api.patch(`/classes/${classId}/toggle-result-access`);
        return response.data;
    },

    blockResultAccess: async (classId, data) => {
        const response = await api.patch(`/classes/${classId}/block-result-access`, data);
        return response.data;
    },
};

// ============================================
// QUESTION SETS API
// ============================================
export const questionSetsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/question-sets', { params });
        return response.data;
    },

    create: async (questionSetData) => {
        const response = await api.post('/question-sets', questionSetData);
        return response.data;
    },

    update: async (id, questionSetData) => {
        const response = await api.put(`/question-sets/${id}`, questionSetData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/question-sets/${id}`);
        return response.data;
    },
};

// ============================================
// TESTS API
// ============================================
export const testsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/tests', { params });
        return response.data;
    },

    getAllIncludingInactive: async () => {
        const response = await api.get('/tests/all');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/tests/${id}`);
        return response.data;
    },

    getByTeacher: async (teacherId) => {
        const response = await api.get(`/tests/teacher/${teacherId}`);
        return response.data;
    },

    create: async (testData) => {
        const response = await api.post('/tests', testData);
        return response.data;
    },

    update: async (id, testData) => {
        const response = await api.put(`/tests/${id}`, testData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/tests/${id}`);
        return response.data;
    },

    publishResults: async (testId) => {
        const response = await api.post(`/tests/${testId}/publish-results`);
        return response.data;
    },

    unpublishResults: async (testId) => {
        const response = await api.post(`/tests/${testId}/unpublish-results`);
        return response.data;
    },
};

// ============================================
// STUDENT-SPECIFIC API (UPDATED WITH RESULT ACCESS STATUS)
// ============================================
export const studentAPI = {
    getDashboard: async () => {
        const response = await api.get('/student/dashboard');
        return response.data;
    },

    getAvailableTests: async () => {
        const response = await api.get('/student/tests');
        return response.data;
    },

    getAllTests: async () => {
        const response = await api.get('/student/all-tests');
        return response.data;
    },

    getTestById: async (testId) => {
        const response = await api.get(`/student/tests/${testId}`);
        return response.data;
    },

    submitTest: async (testId, answers) => {
        const response = await api.post(`/student/tests/${testId}/submit`, { answers });
        return response.data;
    },

    // ✅ REMOVED: addQuestionsToTest — students must never add questions to tests

    getTestResults: async () => {
        const response = await api.get('/student/test-results');
        return response.data;
    },

    getTestSchedule: async () => {
        const response = await api.get('/student/test-schedule');
        return response.data;
    },

    // ==========================================
    // RESULT ACCESS STATUS
    // ==========================================
    getResultAccessStatus: async () => {
        const response = await api.get('/student/result-access-status');
        return response.data;
    },

    // ==========================================
    // PROFILE
    // ==========================================
    getProfile: async () => {
        const response = await api.get('/student/profile');
        return response.data;
    },

    uploadProfileImage: async (file) => {
        const formData = new FormData();
        formData.append('profileImage', file);

        const response = await api.post('/student/profile-image', formData, {
            headers: {
                'Content-Type': 'multipart/form-data',
            },
        });
        return response.data;
    },

    removeProfileImage: async () => {
        const response = await api.delete('/student/profile-image');
        return response.data;
    },
};
// ============================================
// STUDENT SUBMISSIONS API
// ============================================
export const submissionsAPI = {
    getAll: async () => {
        const response = await api.get('/student-submissions');
        return response.data;
    },

    create: async (submissionData) => {
        const response = await api.post('/student-submissions', submissionData);
        return response.data;
    },

    update: async (id, submissionData) => {
        const response = await api.put(`/student-submissions/${id}`, submissionData);
        return response.data;
    },
};

// ============================================
// TEST RESULTS API
// ============================================
export const testResultsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/test-results', { params });
        return response.data;
    },

    getByTest: async (testId) => {
        const response = await api.get(`/test-results/test/${testId}`);
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/test-results/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId) => {
        const response = await api.get(`/test-results/student/${studentId}`);
        return response.data;
    },

    exportCSV: async (testId) => {
        const response = await api.get(`/test-results/export/${testId}`, {
            responseType: 'blob',
        });
        return response.data;
    },

    submit: async (resultData) => {
        const response = await api.post('/test-results', resultData);
        return response.data;
    },

    delete: async (studentId, testId) => {
        const response = await api.delete(`/test-results/${studentId}/${testId}`);
        return response.data;
    },

    deleteAllForStudent: async (studentId) => {
        const response = await api.delete(`/test-results/student/${studentId}/all`);
        return response.data;
    },

    deleteAll: async () => {
        const response = await api.delete('/test-results/delete-all');
        return response.data;
    },
};

// ============================================
// SESSIONS API
// ============================================
export const sessionsAPI = {
    getAll: async () => {
        const response = await api.get('/sessions');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/sessions/${id}`);
        return response.data;
    },

    create: async (sessionData) => {
        const response = await api.post('/sessions', sessionData);
        return response.data;
    },

    update: async (id, sessionData) => {
        const response = await api.put(`/sessions/${id}`, sessionData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/sessions/${id}`);
        return response.data;
    },
};

// ============================================
// TERMS API
// ============================================
export const termsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/terms', { params });
        return response.data;
    },

    getActive: async () => {
        const response = await api.get('/terms/active');
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/terms/${id}`);
        return response.data;
    },

    create: async (termData) => {
        const response = await api.post('/terms', termData);
        return response.data;
    },

    update: async (id, termData) => {
        const response = await api.put(`/terms/${id}`, termData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/terms/${id}`);
        return response.data;
    },
};

// ===========================================
// GRADING SYSTEMS API
// ===========================================
export const gradingSystemsAPI = {
    getAll: async () => {
        const response = await api.get('/grading-systems');
        return response.data;
    },

    getDefault: async () => {
        const response = await api.get('/grading-systems/default');
        return response.data;
    },

    create: async (gradingData) => {
        const response = await api.post('/grading-systems', gradingData);
        return response.data;
    },

    update: async (id, gradingData) => {
        const response = await api.put(`/grading-systems/${id}`, gradingData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/grading-systems/${id}`);
        return response.data;
    },
};

// ============================================
// ATTENDANCE API
// ============================================
export const attendanceAPI = {
    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/attendance/student/${studentId}`, { params });
        return response.data;
    },

    upsert: async (attendanceData) => {
        const response = await api.post('/attendance', attendanceData);
        return response.data;
    },

    bulkUpsert: async (bulkData) => {
        const response = await api.post('/attendance/bulk', bulkData);
        return response.data;
    },

    getSummary: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/summary`, { params });
        return response.data;
    },

    // ==========================================
    // STUDENT ATTENDANCE COUNTS (NEW)
    // ==========================================

    getStudentCountsByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/student-counts`, { params });
        return response.data;
    },

    // ==========================================
    // SCHOOL OPENING DAYS
    // ==========================================

    getSchoolOpenDays: async (params = {}) => {
        const response = await api.get('/attendance/school-open-days', { params });
        return response.data;
    },

    setSchoolOpenDays: async (data) => {
        const response = await api.post('/attendance/school-open-days', data);
        return response.data;
    },

    updateSchoolOpenDays: async (data) => {
        const response = await api.put('/attendance/school-open-days', data);
        return response.data;
    },

    deleteSchoolOpenDays: async (params = {}) => {
        const response = await api.delete('/attendance/school-open-days', { params });
        return response.data;
    },
};

// ============================================
// CONTINUOUS ASSESSMENTS API (Admin)
// ============================================
export const continuousAssessmentsAPI = {
    // ⚠️ Requires: GET route on a mounted /continuous-assessments router
    getAll: async (params = {}, config = {}) => {
        const response = await api.get('/continuous-assessments', { 
            params,
            ...config 
        });
        return response.data;
    },

    // ⚠️ Requires: GET /:id route on the /continuous-assessments router
    getById: async (id) => {
        const response = await api.get(`/continuous-assessments/${id}`);
        return response.data;
    },

    // ⚠️ Requires: POST route on the /continuous-assessments router
    create: async (assessmentData) => {
        const response = await api.post('/continuous-assessments', assessmentData);
        return response.data;
    },

    // ⚠️ Requires: POST /bulk route on the /continuous-assessments router
    bulkCreate: async (bulkData) => {
        const response = await api.post('/continuous-assessments/bulk', bulkData);
        return response.data;
    },

    // ⚠️ Requires: PUT /:id/submit route on the /continuous-assessments router
    submit: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/submit`);
        return response.data;
    },

    // -------------------------------------------------
    // ✅ WORKING — mapped to adminCaRoutes:
    //   router.put('/:id/approve', authenticateToken, ctrl.approveCA)
    // Returns: { success, message, data: <updated CA row> }
    // -------------------------------------------------
    approve: async (id) => {
        const response = await api.put(`/admin/ca/${id}/approve`);
        return response.data;
    },

       update: async (id, data) => {
        const response = await api.put(`/admin/ca/${id}`, data);
        return response.data;
    },

    // -------------------------------------------------
    // ✅ WORKING — mapped to adminCaRoutes:
    //   router.put('/:id/unapprove', authenticateToken, ctrl.unapproveCA)
    // Returns: { success, message, data: <updated CA row> }
    // -------------------------------------------------
    unapprove: async (id) => {
        const response = await api.put(`/admin/ca/${id}/unapprove`);
        return response.data;
    },

    // -------------------------------------------------
    // ✅ WORKING — mapped to adminCaRoutes (new route below):
    //   router.post('/bulk/approve-by-ids', ...)
    // body: { ids: [...] } → approves those specific records
    // Returns: { success, message, data: { modified } }
    // -------------------------------------------------
    bulkReapprove: async (ids) => {
        const response = await api.post('/admin/ca/bulk/approve-by-ids', { ids });
        return response.data;
    },

    // -------------------------------------------------
    // ✅ WORKING — mapped to adminCaRoutes:
    //   router.post('/bulk/approve-by-filters', ctrl.bulkApproveByFilters)
    // Approves ALL matching "submitted" records server-side.
    //
    // Usage:
    //   await continuousAssessmentsAPI.bulkApproveByFilters({
    //     termId: '...', sessionId: '...', classId: '...', subjectId: '...',
    //     excludedIds: ['id1', 'id2'],   // optional
    //   });
    //
    // Returns: { success, message, data: { modified } }
    // -------------------------------------------------
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/admin/ca/bulk/approve-by-filters', filters);
        return response.data;
    },

    // -------------------------------------------------
    // ✅ WORKING — mapped to adminCaRoutes:
    //   router.post('/bulk/unapprove', ctrl.bulkUnapprove)
    // Unapproves by IDs array OR by filters.
    //
    // Returns: { success, message, data: { modified } }
    // -------------------------------------------------
    bulkUnapprove: async (data) => {
        const response = await api.post('/admin/ca/bulk/unapprove', data);
        return response.data;
    },

    // ⚠️ Requires: DELETE /:id route on the /continuous-assessments router
    delete: async (id) => {
        const response = await api.delete(`/continuous-assessments/${id}`);
        return response.data;
    },
};

// ============================================
// TEACHER CA UPLOAD API (Assignment-Protected)
// ============================================
export const teacherCAAPI = {
    getEligibleClassesSubjects: async () => {
        const response = await api.get('/continuous-assessments/teacher/ca/eligible');
        return response.data;
    },

    getStudentsForCA: async (classId, subjectId, params = {}) => {
        const response = await api.get(`/continuous-assessments/teacher/ca/${classId}/${subjectId}/students`, { params });
        return response.data;
    },

    uploadSingleCA: async (caData) => {
        const response = await api.post('/continuous-assessments/teacher/ca/upload', caData);
        return response.data;
    },

    uploadBulkCA: async (bulkData) => {
        const response = await api.post('/continuous-assessments/teacher/ca/upload/bulk', bulkData);
        return response.data;
    },

    submitForApproval: async (classId, subjectId, params = {}) => {
        const response = await api.put(`/continuous-assessments/teacher/ca/submit/${classId}/${subjectId}`, params);
        return response.data;
    },

    getMySubmissions: async (params = {}) => {
        const response = await api.get('/teacher-ca/submissions', { params });
        return response.data;
    },

    deleteDraftCA: async (caId) => {
        const response = await api.delete(`/continuous-assessments/teacher/ca/${caId}`);
        return response.data;
    },

    pushTestResultsAsCA: async (testId, payload) => {
        const response = await api.post('/api/teacher-ca/push-test-results', payload);
        return response.data;
    },

    getCASubjectsCount: async (params = {}) => {
        const response = await api.get('/continuous-assessments/teacher/ca/subjects-count', { params });
        const data = response.data;

        console.log('[getCASubjectsCount] Raw response:', data);

        if (data && typeof data === 'object' && data.success !== undefined) {
            const { totalSubjects, completedSubjects, pendingSubjects } = data.data || {};
            
            return {
                success: true,
                data: {
                    totalSubjects: totalSubjects || 0,
                    completedSubjects: completedSubjects || 0,
                    pendingSubjects: pendingSubjects || 0,
                    subjectsCount: completedSubjects || 0,
                    remainingSubjects: pendingSubjects || 0
                }
            };
        }

        if (typeof data === 'string') {
            const completedMatch = data.match(/completed\s+(\d+)\s+of\s+(\d+)/i);
            const needMatch = data.match(/(\d+)\s+subjects?\s+still\s+need/i);

            if (completedMatch) {
                return {
                    success: true,
                    data: {
                        subjectsCount: parseInt(completedMatch[1], 10),
                        totalSubjects: parseInt(completedMatch[2], 10),
                        completedSubjects: parseInt(completedMatch[1], 10),
                        pendingSubjects: parseInt(completedMatch[2], 10) - parseInt(completedMatch[1], 10)
                    }
                };
            }

            if (needMatch) {
                const remaining = parseInt(needMatch[1], 10);
                const totalMatch = data.match(/of\s+(\d+)/i);
                const total = totalMatch ? parseInt(totalMatch[1], 10) : remaining;

                return {
                    success: true,
                    data: {
                        subjectsCount: total - remaining,
                        totalSubjects: total,
                        completedSubjects: total - remaining,
                        pendingSubjects: remaining
                    }
                };
            }
        }

        return { success: false, data: null };
    },

    getSubmittedSubjects: async (params = {}) => {
        const response = await api.get('/teacher-ca/submitted-subjects', { params });
        return response.data;
    },
};

// ============================================
// TEACHER BROADSHEET API
// ============================================
export const teacherBroadsheetAPI = {
    // -------------------------------------------------
    // GET - Get broadsheet for assigned subjects only
    // URL: /teacher/broadsheet/:classId
    // Params: termId, sessionId, subjectFilter ('all' | 'assigned')
    //
    // Usage:
    //   // View ALL subjects (default)
    //   const result = await teacherBroadsheetAPI.getBroadsheet(classId);
    //
    //   // View only ASSIGNED subjects
    //   const result = await teacherBroadsheetAPI.getBroadsheet(classId, {
    //     subjectFilter: 'assigned'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     classInfo: { classId, className, classLevel, classSection, classTeacher, isClassTeacher, assignedSubjects },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     subjects: [{ subjectId, subjectName, subjectCode }], 
    //     subjectStats: [{ subjectId, subjectName, totalStudents, assessedStudents, averageScore, ...gradeDistribution }],
    //     students: [{ studentId, studentName, firstName, lastName, admissionNumber, gender, scores: {...}, totalScore, averageScore, position }, ...],
    //     statistics: { totalStudents, assessedStudents, highestTotal, lowestTotal, classAverage, passRate }
    //   }
    // }
    // -------------------------------------------------
    getBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/teacher/broadsheet/${classId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get all classes where teacher is the ASSIGNED class teacher
    // URL: /class-teacher/broadsheet
    // Params: termId, sessionId
    //
    // This endpoint returns a LIST of all classes where this teacher
    // is the assigned class teacher (Class.teacherId === req.user.id).
    // Use this to show a selection list before viewing a specific class broadsheet.
    //
    // Authorization:
    //   - Must be a teacher with role === 'teacher'
    //   - Only returns classes where teacher is the class teacher
    //
    // Usage:
    //   const result = await teacherBroadsheetAPI.getClassTeacherClasses();
    //   const result = await teacherBroadsheetAPI.getClassTeacherClasses({
    //     termId: '...',
    //     sessionId: '...'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: [{
    //     classId: '...',
    //     className: 'JSS 1A',
    //     classLevel: 'JSS 1',
    //     classSession: '...',
    //     studentCount: 45,
    //     subjectCount: 12,
    //     assessmentCount: 150,      // Number of approved CAs for this class
    //     commentCount: 40,          // Number of class teacher comments
    //     hasBroadsheetData: true,   // assessmentCount > 0
    //     hasComments: true,         // commentCount > 0
    //     completionPercentage: 89   // (commentCount / studentCount) * 100
    //   }, ...],
    //   meta: {
    //     termId: '...',
    //     termName: 'First Term',
    //     sessionId: '...',
    //     sessionName: '2024/2025',
    //     totalClasses: 3
    //   }
    // }
    //
    // Empty case (no classes assigned):
    //   {
    //     success: true,
    //     data: [],
    //     message: 'You are not assigned as a class teacher to any class. Contact admin for assignment.'
    //   }
    // -------------------------------------------------
    getClassTeacherClasses: async (params = {}) => {
        const response = await api.get('/class-teacher/broadsheet', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Class Teacher Broadadsheet (COMPLETE VIEW)
    // URL: /class-teacher/broadsheet/:classId
    // Params: termId, sessionId, includeSubjectTeachers
    //
    // IMPORTANT: This endpoint is ONLY accessible to the assigned class teacher.
    // It shows ALL subjects for the class, not just the teacher's assigned subjects.
    //
    // This allows the class teacher to see the FULL broadsheet with scores from
    // ALL subject teachers in the class, enabling them to:
    // - See the complete academic performance of every student
    // - Identify students with missing scores
    // - Compare performance across all subjects
    // - Have a holistic view for class teacher comments and principal comments
    //
    // Authorization:
    //   - Must be a teacher with role === 'teacher'
    //   - Must be the class teacher (Class.teacherId === req.user.id)
    //   - Regular teacher assignments are NOT sufficient
    //
    // Usage:
    //   // Get all subjects (default)
    //   const result = await teacherBroadsheetAPI.getClassTeacherBroadsheet(classId);
    //
    //   // Include subject teacher assignments in response
    //   const result = await teacherBroadsheetAPI.getClassTeacherBroadsheet(classId, {
    //     includeSubjectTeachers: 'true'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     classInfo: {
    //       classId, className, classLevel, classSection, classSession, classFullName,
    //       classTeacher: { id, name, email } | null,
    //       totalSubjects, totalStudents
    //     },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     subjects: [{ subjectId, subjectName, subjectCode }],
    //     subjectStats: [{
    //       subjectId, subjectName, subjectCode,
    //       totalStudents, assessedStudents, notAssessedStudents,
    //       averageScore, highestScore, lowestScore, passCount, failCount, passRate,
    //       gradeDistribution: { A: 5, B: 10, C: 8, ... },
    //       teacherAssignment: { teacherId, teacherName } or null
    //     }, ...],
    //     students: [{
    //       studentId, studentName, firstName, lastName, admissionNumber, gender,
    //       scores: { [subjectId]: { testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore, grade, remark } | null },
    //       totalScore, averageScore, position,
    //       subjectsWithScores, subjectsWithoutScores, totalSubjects,
    //       attendance: { timesPresent, timesOpen, percentage },
    //       classTeacherComment: '...'
    //     }, ...],
    //     attendance: { schoolOpenDays, totalPresent },
    //     statistics: {
    //       totalStudents, assessedStudents, notAssessedStudents,
    //       highestTotal, lowestTotal, classAverage,
    //       passRate, totalSubjects, subjectsWithScores,
    //       commentsCount, commentsPercentage
    //     },
    //     gradeDistribution: { A: 12, B: 18, C: 15, D: 8, E: 5, F: 2 },
    //     teacherAssignments: [{ teacherId, teacherName }, ...]  // Only if requested
    //   },
    //   meta: { generatedAt: '...' }
    // }
    // -------------------------------------------------
    getClassTeacherBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher/broadsheet/${classId}`, { params });
        return response.data;
    },
};

// ===================================================================
// *** ADMIN BROADSHEET API ***
// ===================================================================
export const adminBroadsheetAPI = {
    // -------------------------------------------------
    // GET - Get broadsheet for ALL classes (Admin only)
    // URL: /admin/broadsheet/:classId
    // Params: termId, sessionId
    //
    // Usage:
    //   const result = await adminBroadsheetAPI.getBroadsheet(classId);
    //   const result = await adminBroadsheetAPI.getBroadsheet(classId, { termId: '...', sessionId: '...' });
    //
    // Returns: Same structure as teacher broadsheet but for admin
    // {
    //   success: true,
    //   data: {
    //     classInfo: { classId, className, classLevel, classSection, classFullName, totalSubjects, totalStudents },
    //     termInfo: { id, name, status },
    //     sessionInfo: { id, name },
    //     subjects: [{ subjectId, subjectName, subjectCode }],
    //     subjectStats: [{ subjectId, subjectName, totalStudents, assessedStudents, averageScore, passRate, gradeDistribution }],
    //     students: [{ studentId, studentName, ..., scores: {...}, totalScore, averageScore, position }],
    //     statistics: { totalStudents, assessedStudents, notAssessedStudents, highestTotal, lowestTotal, classAverage, passRate }
    //   }
    // }
    // -------------------------------------------------
    getBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/admin/broadsheet/${classId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get list of all classes for broadsheet selection dropdown
    // URL: /admin/broadsheet/classes
    // Params: termId, sessionId
    //
    // Usage:
    //   const result = await adminBroadsheetAPI.getClasses();
    //   const result = await adminBroadsheetAPI.getClasses({ termId: '...', sessionId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: [{
    //     classId: '...',
    //     className: 'JSS 1A',
    //     classLevel: 'JSS 1',
    //     classSection: 'A',
    //     studentCount: 45,
    //     assessmentCount: 150,
    //     hasBroadsheetData: true,
    //     completionPercentage: 89
    //   }],
    //   meta: { termId, termName, sessionId, sessionName, totalClasses: 3 }
    // }
    // -------------------------------------------------
    getClasses: async (params = {}) => {
        const response = await api.get('/admin/broadsheet/classes', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get detailed broadsheet for a specific class
    // URL: /admin/broadsheet/:classId
    // Params: termId, sessionId
    //
    // Usage:
    //   const result = await adminBroadsheetAPI.getDetailedBroadsheet(classId);
    //   const result = await adminBroadsheetAPI.getDetailedBroadsheet(classId, { termId: '...', sessionId: '...' });
    //
    // Returns: Same as getBroadsheet but with additional admin-only data
    // -------------------------------------------------
    getDetailedBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/admin/broadsheet/${classId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get global broadsheet statistics across ALL classes
    // URL: /admin/broadsheet/global-stats
    // Params: termId, sessionId
    //
    // Aggregates broadsheet data across all classes to produce
    // school-wide Passed, Failed, Average Score, and Pass Rate
    // metrics for the admin dashboard.
    //
    // A student is considered "assessed" if they have at least one
    // approved CA record in the term/session. Their average score
    // is the mean of totalScore across all their subject assessments.
    // Pass/fail is determined by comparing that average against the
    // grading system's passMark (defaults to 50 if no grading system found).
    //
    // Usage:
    //   // Uses active term/session automatically
    //   const result = await adminBroadsheetAPI.getGlobalStats();
    //
    //   // Specify term and session explicitly
    //   const result = await adminBroadsheetAPI.getGlobalStats({
    //     termId: '64a1b2c3d4e5f6g7h8i9j0k1',
    //     sessionId: '64a1b2c3d4e5f6g7h8i9j0k2'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     totalStudents: 450,          // All active students in school
    //     assessedStudents: 420,       // Students with at least 1 approved CA
    //     notAssessedStudents: 30,     // Students with no approved CAs
    //     passed: 350,                 // Students whose avg score >= passMark
    //     failed: 70,                  // Students whose avg score < passMark
    //     averageScore: 72.5,          // Mean of all student averages
    //     passRate: 83.3,              // (passed / assessedStudents) * 100
    //     highestTotal: 98,            // Highest student average
    //     lowestTotal: 12              // Lowest student average
    //   },
    //   termInfo: { id: '...', name: 'First Term' },
    //   sessionInfo: { id: '...', name: '2024/2025' }
    // }
    //
    // No data case:
    //   {
    //     success: true,
    //     data: {
    //       totalStudents: 450,
    //       assessedStudents: 0,
    //       notAssessedStudents: 450,
    //       passed: 0,
    //       failed: 0,
    //       averageScore: 0,
    //       passRate: 0,
    //       highestTotal: 0,
    //       lowestTotal: 0
    //     },
    //     termInfo: { ... },
    //     sessionInfo: { ... }
    //   }
    //
    // Error cases:
    //   No active term/session:
    //   {
    //     success: false,
    //     message: 'No active term or session found. Please select term and session.'
    //   }
    // -------------------------------------------------
    getGlobalStats: async (params = {}) => {
        const response = await api.get('/admin/broadsheet/global-stats', { params });
        return response.data;
    },
};

// ============================================
// TEACHER MY ASSIGNMENTS API
// ============================================
export const myAssignmentsAPI = {
    getMyAssignments: async () => {
        const response = await api.get('/my-assignments');
        return response.data;
    },

    requestAssignment: async (classId, subjectId) => {
        const response = await api.post('/my-assignments/request', { class_id: classId, subject_id: subjectId });
        return response.data;
    },

    requestBulkAssignments: async (assignments) => {
        const response = await api.post('/my-assignments/bulk', { assignments });
        return response.data;
    },

    getAvailableOptions: async () => {
        const response = await api.get('/my-assignments/available');
        return response.data;
    },

    removeAssignment: async (assignmentId) => {
        const response = await api.delete(`/my-assignments/${assignmentId}`);
        return response.data;
    },
};

// ============================================
// PRINCIPAL COMMENTS API (UPDATED)
// ============================================
export const principalCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/principal-comments', { params });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/principal-comments/${id}`);
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/principal-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/principal-comments/${id}`, commentData);
        return response.data;
    },

    generate: async (generateData) => {
        const response = await api.post('/principal-comments/generate', generateData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/principal-comments/${id}`);
        return response.data;
    },
};

// ============================================
// CLASS TEACHER COMMENTS API (UPDATED)
// ============================================
export const classTeacherCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/class-teacher-comments', { params });
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, classId) => {
        const response = await api.get(`/class-teacher-comments/student/${studentId}`, { 
            params: { class_id: classId } 
        });
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/class-teacher-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/class-teacher-comments/${id}`, commentData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/class-teacher-comments/${id}`);
        return response.data;
    },

    submitForApproval: async (classId, params = {}) => {
        const response = await api.put(`/class-teacher-comments/submit/${classId}`, params);
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/class-teacher-comments/${id}/unapprove`);
        return response.data;
    },

    bulkReapprove: async (ids) => {
        const response = await api.post('/class-teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    getMyComments: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/my', { params });
        return response.data;
    },

    getStudentsForComments: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher-comments/${classId}/students`, { params });
        return response.data;
    },

    bulkCreate: async (bulkData) => {
        const response = await api.post('/class-teacher-comments/bulk', bulkData);
        return response.data;
    },

    getStats: async (params = {}) => {
        const response = await api.get('/class-teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// TEACHER COMMENTS API (Subject Teacher Remarks)
// ============================================
export const teacherCommentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/teacher-comments', { params });
        return response.data;
    },

    getByClass: async (classId, params = {}) => {
        const response = await api.get(`/teacher-comments/class/${classId}`, { params });
        return response.data;
    },

    getByStudent: async (studentId, params = {}) => {
        const response = await api.get(`/teacher-comments/student/${studentId}`, { params });
        return response.data;
    },

    getById: async (id) => {
        const response = await api.get(`/teacher-comments/${id}`);
        return response.data;
    },

    create: async (commentData) => {
        const response = await api.post('/teacher-comments', commentData);
        return response.data;
    },

    update: async (id, commentData) => {
        const response = await api.put(`/teacher-comments/${id}`, commentData);
        return response.data;
    },

    delete: async (id) => {
        const response = await api.delete(`/teacher-comments/${id}`);
        return response.data;
    },

    bulkCreate: async (bulkData) => {
        const response = await api.post('/teacher-comments/bulk', bulkData);
        return response.data;
    },

    submitForApproval: async (classId, subjectId, params = {}) => {
        const response = await api.put(`/continuous-assessments/teacher/ca/submit/${classId}/${subjectId}`, params);
        return response.data;
    },

    approve: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/approve`);
        return response.data;
    },

    unapprove: async (id) => {
        const response = await api.put(`/teacher-comments/${id}/unapprove`);
        return response.data;
    },

    bulkReapprove: async (ids) => {
        const response = await api.post('/teacher-comments/bulk/reapprove', { ids });
        return response.data;
    },

    getMyComments: async (params = {}) => {
        const response = await api.get('/teacher/comments/my', { params });
        return response.data;
    },

    getStudentsForComments: async (classId, subjectId, params = {}) => {
        const response = await api.get(`/teacher/comments/${classId}/${subjectId}/students`, { params });
        return response.data;
    },

    getStats: async (params = {}) => {
        const response = await api.get('/teacher-comments/stats', { params });
        return response.data;
    },
};

// ============================================
// REPORT CARDS API (UPDATED FOR BULK PRINTING)
// ============================================
// ✅ Prisma migration: IDs are now Int `id` (was Mongo `_id`)
const docId = (o) => o?._id ?? o?.id ?? null;

export const reportCardsAPI = {
    // -------------------------------------------------
    // GET - Single student's full report (detail page)
    // Returns: { success, data: { student, class, term, session,
    //   subjects: [...], statistics: { totalScore, averageScore, position, subjectCount },
    //   classTeacherComment, principalComment } }
    // -------------------------------------------------
    getStudentReport: async (studentId, params = {}) => {
        const response = await api.get(`/report-cards/student/${studentId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Class summary table (positions, averages)
    // Returns: { success, data: { class, term, session, totalStudents,
    //   assessedStudents, students: [...] } }
    // -------------------------------------------------
    getClassReport: async (classId, params = {}) => {
        const response = await api.get(`/report-cards/class/${classId}`, { params });
        return response.data;
    },

    // Student-facing results checker (lives on the student router — unchanged)
    checkResults: async (credentials) => {
        const response = await api.post('/student/check-results', credentials);
        return response.data;
    },

    // -------------------------------------------------
    // GET - Per-class comment/remark counts (status badges)
    // Returns: { success, data: { [classId]: { classTeacherCommentCount,
    //   teacherCommentCount, uniqueSubjectsCount } } }
    // -------------------------------------------------
    getStatus: async (termId) => {
        const response = await api.get('/report-cards/status', {
            params: { termId }
        });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Batch print payload for the A4 print view
    // Returns: { success, data: { term, session, classes: [...] } }
    // -------------------------------------------------
    getPrintData: async (termId, classIds) => {
        const idsString = Array.isArray(classIds) ? classIds.join(',') : classIds;
        const response = await api.get('/report-cards/print-data', {
            params: {
                termId,
                classIds: idsString
            }
        });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Single student print payload (same student shape
    // as one entry in getPrintData, plus term/session/classInfo)
    // Returns: { success, data: { term, session, classInfo, student: {...} } }
    // -------------------------------------------------
    getStudentPrint: async (studentId, termId, sessionId = null) => {
        const params = { termId };
        if (sessionId) params.sessionId = sessionId;

        const response = await api.get(`/report-cards/student-print/${studentId}`, {
            params
        });
        return response.data;
    },

    getSingleClassPrintData: async (classId, termId) => {
        return await reportCardsAPI.getPrintData(termId, [classId]);
    },

    // ✅ FIXED: docId — was classes.map(c => c._id) (undefined on Prisma backend)
    getAllClassesPrintData: async (termId) => {
        const classesResponse = await classesAPI.getAllForDropdown();
        const classes = classesResponse?.data?.data || classesResponse?.data || [];
        const classIds = (Array.isArray(classes) ? classes : []).map(docId).filter((v) => v != null);

        if (classIds.length === 0) {
            return { success: true, data: { classes: [], allStudents: [] } };
        }

        return await reportCardsAPI.getPrintData(termId, classIds);
    },
};
// ============================================
// SCHOOL SETTINGS API (For Report Card Header)
// ============================================
export const siteInfoAPI = {
    getSiteInfo: async () => {
        const response = await api.get('/site-information');
        return response.data;
    },

    upsertSiteInfo: async (formData) => {
        const response = await api.put('/site-information', formData, {
            headers: {
                'Content-Type': 'multipart/form-data', // Required for file uploads
            },
        });
        return response.data;
    },

    deleteSiteInfo: async () => {
        const response = await api.delete('/site-information');
        return response.data;
    },
};
// ============================================
// STUDENT PERFORMANCE API
// ============================================
export const performanceAPI = {
    getStudentPerformance: async (studentId) => {
        const response = await api.get(`/api/students/${studentId}/performance`);
        return response.data;
    },
};

// ============================================
// ADMIN CA FILTERING API (UPDATED WITH CLEAR APPROVAL STATUS + BULK UNAPPROVE)
// ============================================
export const adminCAAPI = {
    getFilterOptions: async (params = {}) => {
        const response = await api.get('/admin/ca/filter-options', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get ALL active CAs (Admin CA View)
    // Fetches all active CAs without status filter by default
    // Status filter only applies if explicitly provided
    //
    // Usage:
    //   const result = await adminCAAPI.getAssessments();
    //   const result = await adminCAAPI.getAssessments({ termId: '...', sessionId: '...' });
    //   const result = await adminCAAPI.getAssessments({ status: 'approved' });
    //   const result = await adminCAAPI.getAssessments({ status: 'all' }); // No status filter
    //   const result = await adminCAAPI.getAssessments({ search: 'John' });
    //
    // Supported params: termId, sessionId, classId, subjectId, teacherId, status, search, page, limit
    //
    // Returns: {
    //   success: true,
    //   data: [{ ... }],
    //   total: 150,
    //   page: 1,
    //   limit: 20,
    //   summary: { total: 150, byStatus: [{ status: 'approved', count: 100 }] }
    // }
    // -------------------------------------------------
    getAssessments: async (params = {}) => {
        const response = await api.get('/admin/ca/all', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get ALL approved CAs for unapprove view
    // Fetches all approved CAs across ALL terms/sessions
    //
    // Usage:
    //   const result = await adminCAAPI.getAllApproved();
    //   const result = await adminCAAPI.getAllApproved({ classId: '...', subjectId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: [{ ... }],
    //   total: 150,
    //   summary: { total: 150, byTerm: [{ termId, termName, sessionId, sessionName, count }] }
    // }
    // -------------------------------------------------
    getAllApproved: async (params = {}) => {
        const response = await api.get('/admin/ca/all-approved', { params });
        return response.data;
    },

    // -------------------------------------------------
    // PUT - Approve a single assessment
    // Route: router.put('/:id/approve', ctrl.approveCA)
    // Returns: { success, message, data: <updated CA row> }
    // -------------------------------------------------
    approve: async (id) => {
        const response = await api.put(`/admin/ca/${id}/approve`);
        return response.data;
    },

    // -------------------------------------------------
    // PUT - Unapprove a single assessment (back to Submitted)
    // Route: router.put('/:id/unapprove', ctrl.unapproveCA)
    // Returns: { success, message, data: <updated CA row> }
    // -------------------------------------------------
    unapprove: async (id) => {
        const response = await api.put(`/admin/ca/${id}/unapprove`);
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk approve by specific IDs
    // Route: router.post('/bulk/approve-by-ids', ctrl.bulkApproveByIds)
    // body: { ids: [...] }
    // Returns: { success, message, data: { requested, modified } }
    // -------------------------------------------------
    bulkApprove: async (ids) => {
        const response = await api.post('/admin/ca/bulk/approve-by-ids', { ids });
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk approve assessments by filters (Admin CA View)
    // Approves ALL matching "submitted" records on the server side
    //
    // Usage:
    //   const result = await adminCAAPI.bulkApproveByFilters({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     excludedIds: ['id1', 'id2']  // optional: IDs to exclude from approval
    //   });
    //
    // Returns: { success, message, data: { modified } }
    // -------------------------------------------------
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/admin/ca/bulk/approve-by-filters', filters);
        return response.data;
    },

    // -------------------------------------------------
    // POST - Bulk unapprove assessments (Admin CA View)
    // Can unapprove by IDs array OR by filters
    //
    // Usage with IDs:
    //   const result = await adminCAAPI.bulkUnapprove({ ids: ['id1', 'id2', 'id3'] });
    //
    // Usage with filters (unapproves ALL matching):
    //   const result = await adminCAAPI.bulkUnapprove({
    //     classId: '...',
    //     subjectId: '...',
    //     termId: '...',
    //     sessionId: '...'
    //   });
    //
    // Returns: { success, message, data: { modified } }
    // -------------------------------------------------
    bulkUnapprove: async (data) => {
        const response = await api.post('/admin/ca/bulk/unapprove', data);
        return response.data;
    },

    // ==========================================
    // CLEAR APPROVAL STATUS
    // ==========================================

    getClassesWithApproved: async (params = {}) => {
        const response = await api.get('/admin/ca/classes-with-approved', { params });
        return response.data;
    },

    getSubjectsWithApproved: async (classId, params = {}) => {
        const response = await api.get(`/admin/ca/classes/${classId}/subjects-with-approved`, { params });
        return response.data;
    },

    previewClearApproval: async (params = {}) => {
        const response = await api.get('/admin/ca/clear-approval-status/preview', { params });
        return response.data;
    },

    clearApprovalStatus: async (data) => {
        const response = await api.patch('/admin/ca/clear-approval-status', data);
        return response.data;
    },

    // -------------------------------------------------
    // PATCH - Clear approval by specific assessment IDs
    //
    // Usage:
    //   const result = await adminCAAPI.clearApprovalByIds(['id1', 'id2', 'id3'], 'draft');
    //
    // Returns: { success, message, data: { requested, found, modified, resetTo } }
    // -------------------------------------------------
    clearApprovalByIds: async (assessmentIds, resetTo = 'draft') => {
        const response = await api.patch('/admin/ca/clear-approval-status/by-ids', {
            assessmentIds,
            resetTo
        });
        return response.data;
    },

    // ==========================================
    // SITE INFORMATION API CALLS
    // (kept here for convenience — consider moving
    //  to a dedicated siteInfoAPI module if duplicated)
    // ==========================================
    getSiteInfo: async () => {
        const response = await api.get('/site-information');
        return response.data;
    },

    upsertSiteInfo: async (data) => {
        const response = await api.put('/site-information', data);
        return response.data;
    },

    deleteSiteInfo: async () => {
        const response = await api.delete('/site-information');
        return response.data;
    },
};

// ============================================
// ADMIN CA PROGRESS API (NEW)
// ============================================
export const adminCAProgressAPI = {
    getTeacherProgress: async (params = {}) => {
        const response = await api.get('/admin/ca/teacher-progress', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get CA breakdown by specific teacher
    // Returns detailed breakdown of each class-subject combination for a teacher
    //
    // Usage:
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId);
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId, { termId: '...' });
    //   const result = await adminCAProgressAPI.getByTeacher(teacherId, { status: 'approved' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     teacher: { id, name, email, username },
    //     assignments: 5,
    //     classSubjects: [{
    //       classId, className, classLevel, subjectId, subjectName, subjectCode,
    //       stats: { totalRecords, draft, submitted, approved, uniqueStudents, avgScore, latestUpdate }
    //     }, ...],
    //     summary: { totalClassSubjects, totalRecords, totalApproved, totalSubmitted, totalDraft }
    //   },
    //   termInfo: { name, id },
    //   sessionInfo: { name, id }
    // }
    // -------------------------------------------------
    getByTeacher: async (teacherId, params = {}) => {
        const response = await api.get(`/admin/ca/by-teacher/${teacherId}`, { params });
        return response.data;
    },
};

// ============================================
// RESULT ACCESS SCHEDULE API
// ============================================
export const resultScheduleAPI = {
    getAll: async () => {
        const response = await api.get('/result-schedules');
        return response.data;
    },
    getCurrent: async () => {
        const response = await api.get('/result-schedules/current');
        return response.data;
    },
    create: async (data) => {
        const response = await api.post('/result-schedules', data);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/result-schedules/${id}`, data);
        return response.data;
    },
    toggleActive: async (id) => {
        const response = await api.patch(`/result-schedules/${id}/toggle-active`);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/result-schedules/${id}`);
        return response.data;
    },
};
// ============================================
// PUBLIC API (No Authentication Required)
// ============================================
export const publicAPI = {
    getTerms: async (params = {}) => {
        const response = await api.get('/public/terms', { params });
        return response.data;
    },

    getSessions: async () => {
        const response = await api.get('/public/sessions');
        return response.data;
    },

    getResultAccessStatus: async () => {
        const response = await api.get('/public/result-access-status');
        return response.data;
    },
};

// ============================================
// ADMIN UTILITIES API
// ============================================
export const adminAPI = {
    addQuestionSetToTest: async (testId, questionSetId) => {
        const response = await api.post('/admin/add-questionset-to-test', { testId, questionSetId });
        return response.data;
    },

    fixAllTests: async () => {
        const response = await api.post('/admin/fix-all-tests');
        return response.data;
    },

    fixScienceTest: async () => {
        const response = await api.post('/admin/fix-science-test');
        return response.data;
    },

    fixTestDates: async () => {
        const response = await api.post('/admin/fix-test-dates');
        return response.data;
    },

    extendTestDates: async (testId, daysToExtend = 7) => {
        const response = await api.post('/admin/extend-test-dates', { testId, daysToExtend });
        return response.data;
    },

    extendAllTests: async (daysToExtend = 7) => {
        const response = await api.post('/admin/extend-all-tests', { daysToExtend });
        return response.data;
    },

    // Inside adminAPI object
convertQuestions: async (rawText) => {
    const response = await api.post('/admin/convert-questions', { rawText });
    return response.data;
}
};

// ============================================
// DIAGNOSTICS API
// ============================================
export const diagnosticsAPI = {
    diagnoseTestQuestions: async (testId) => {
        const response = await api.get(`/diagnose/test-questions/${testId}`);
        return response.data;
    },

    diagnoseStudentTests: async () => {
        const response = await api.get('/diagnose/student-tests');
        return response.data;
    },

    // -------------------------------------------------
    // GET - Debug CA entries (Admin only)
    // Shows grouped CA entries by term/session for debugging
    //
    // Usage:
    //   const result = await diagnosticsAPI.debugCAEntries();
    //   const result = await diagnosticsAPI.debugCAEntries({ teacherId: '...', classId: '...', subjectId: '...', status: 'approved' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     activeTerm: { id, name, status },
    //     allTerms: [...],
    //     allSessions: [...],
    //     entriesByTermSession: [{
    //       termId, termName, termStatus, sessionId, sessionName,
    //       count, uniqueSubjects, uniqueStudents, latestCreated, latestUpdate
    //     }, ...],
    //     statusCounts: { draft: 10, submitted: 5, approved: 85 }
    //   }
    // }
    // -------------------------------------------------
    debugCAEntries: async (params = {}) => {
        const response = await api.get('/debug/ca-entries', { params });
        return response.data;
    },
};

// ===================================================================
// *** STUDENT CLASSES AND SCORES MANAGEMENT ***
// Fetch, Edit, Delete, and Update student scores
// ===================================================================
export const studentsClassesScoresAPI = {
    // -------------------------------------------------
    // GET - Get all students with their classes and scores
    // Query params: termId, sessionId, classId, subjectId, status, page, limit, search
    //
    // Usage:
    //   // Get all with default pagination
    //   const result = await studentsClassesScoresAPI.getAll();
    //
    //   // With filters
    //   const result = await studentsClassesScoresAPI.getAll({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     status: 'approved',
    //     page: 1,
    //     limit: 50,
    //     search: 'john'
    //   });
    //
    // Returns: {
    //   success: true,
    //   data: [{
    //     id: '...',
    //     student: { id, firstName, lastName, fullName, admissionNumber, gender },
    //     class: { id, name, level, section, session, fullName },
    //     subject: { id, name, code },
    //     teacher: { id, name },
    //     scores: { testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore },
    //     grade: 'A',
    //     remark: 'Excellent',
    //     status: 'approved',
    //     approvedBy: 'Admin Name',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   }, ...],
    //   summary: {
    //     totalRecords: 150,
    //     scoredRecords: 145,
    //     averageScore: 72.5,
    //     highestScore: 98,
    //     lowestScore: 25,
    //     statusBreakdown: { draft: 5, submitted: 10, approved: 135 }
    //   },
    //   pagination: { page: 1, limit: 50, total: 150, pages: 3 },
    //   meta: { termName: 'First Term', sessionName: '2024/2025', termId: '...', sessionId: '...' }
    // }
    // -------------------------------------------------
    getAll: async (params = {}) => {
        const response = await api.get('/api/students-classes-scores', { params });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get single student's complete classes and scores
    // Query params: termId, sessionId, classId, subjectId, status
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.getByStudentId(studentId);
    //   const result = await studentsClassesScoresAPI.getByStudentId(studentId, { termId: '...', sessionId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     student: { _id, firstName, lastName, admissionNumber, gender, class: { id, name, level, section, fullName, teacher } },
    //     term: { id, name },
    //     session: { id, name },
    //     subjects: [{
    //       subjectId, subjectName, subjectCode,
    //       hasScore: true,
    //       assessment: { id, testScore, noteTakingScore, assignmentScore, totalCA, examScore, totalScore, grade, remark, status, teacherName, approvedBy, updatedAt }
    //     }, ...],
    //     otherClassScores: [{ id, className, subjectName, testScore, ..., grade }],
    //     summary: { totalSubjects, subjectsWithScores, subjectsWithoutScores, totalScore, averageScore, highestScore, lowestScore, gradeDistribution, statusBreakdown }
    //   }
    // }
    // -------------------------------------------------
    getByStudentId: async (studentId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/${studentId}`, { params });
        return response.data;
    },

    // -------------------------------------------------
    // POST - Create a new score record for a student
    // Body: {
    //   studentId, classId, subjectId, termId, sessionId, teacherId,
    //   testScore, noteTakingScore, assignmentScore, examScore, status
    // }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.create({
    //     studentId: '...',
    //     classId: '...',
    //     subjectId: '...',
    //     termId: '...',
    //     sessionId: '...',
    //     testScore: 15,
    //     noteTakingScore: 8,
    //     assignmentScore: 9,
    //     examScore: 45,
    //     status: 'draft'  // optional: 'draft' (default) | 'submitted' | 'approved'
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record created successfully.',
    //   data: {
    //     id: '...',
    //     student: { id, name, admissionNumber },
    //     class: { id, name },
    //     subject: { id, name },
    //     scores: { testScore: 15, noteTakingScore: 8, assignmentScore: 9, totalCA: 32, examScore: 45, totalScore: 77 },
    //     grade: 'A',
    //     status: 'draft',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   }
    // }
    // -------------------------------------------------
    create: async (scoreData) => {
        const response = await api.post('/api/students-classes-scores', scoreData);
        return response.data;
    },

    // -------------------------------------------------
    // PUT - Edit a student's score record
    // URL param: assessmentId
    // Body: { testScore, noteTakingScore, assignmentScore, examScore, status }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.update(assessmentId, {
    //     testScore: 18,
    //     noteTakingScore: 7,
    //     assignmentScore: 10,
    //     examScore: 50,
    //     status: 'approved'
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record updated successfully.',
    //   data: {
    //     id: '...',
    //     student: { id, name, admissionNumber },
    //     class: { id, name },
    //     subject: { id, name },
    //     scores: { testScore: 18, noteTakingScore: 7, assignmentScore: 10, totalCA: 35, examScore: 50, totalScore: 85 },
    //     grade: 'A',
    //     status: 'approved',
    //     approvedBy: 'Admin Name',
    //     updatedAt: '2025-01-15T10:30:00.000Z'
    //   },
    //   changes: {
    //     oldValues: { testScore: 15, noteTakingScore: 8, ..., totalScore: 77, grade: 'A', status: 'draft' },
    //     newValues: { totalScore: 85, grade: 'A', status: 'approved' }
    //   }
    // }
    // -------------------------------------------------
    update: async (assessmentId, scoreData) => {
        const response = await api.put(`/api/students-classes-scores/${assessmentId}`, scoreData);
        return response.data;
    },

    // -------------------------------------------------
    // DELETE - Delete a student's score record
    // URL param: assessmentId
    //
    // Note: 
    //   - Teachers: Can only delete their own non-approved records
    //   - Admins: Can delete any record; approved records are soft-deleted
    //
    // Returns: {
    //   success: true,
    //   message: 'Score record deleted for John Doe (Mathematics).',
    //   data: { id, studentName: 'John Doe', subjectName: 'Mathematics', softDeleted: false }
    // }
    // -------------------------------------------------
    delete: async (assessmentId) => {
        const response = await api.delete(`/api/students-classes-scores/${assessmentId}`);
        return response.data;
    },

    // -------------------------------------------------
    // PATCH - Bulk update scores for multiple students
    // Body: {
    //   termId, sessionId, classId, subjectId,
    //   updates: [
    //     { studentId, testScore?, noteTakingScore?, assignmentScore?, examScore?, status? },
    //     ...
    //   ],
    //   approveAfterUpdate?: boolean
    // }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.bulkUpdate({
    //     termId: '...',
    //     sessionId: '...',
    //     classId: '...',           // optional (uses student's current class if omitted)
    //     subjectId: '...',        // REQUIRED
    //     approveAfterUpdate: true,   // optional: auto-approve all edits (default: false)
    //     updates: [
    //       { studentId: '...', testScore: 15, noteTakingScore: 8, assignmentScore: 9, examScore: 45 },
    //       { studentId: '...', testScore: 18, noteTakingScore: 7, assignmentScore: 10, examScore: 50 },
    //       { studentId: '...', status: 'approved' }  // only change status
    //     ]
    //   });
    //
    // Returns: {
    //   success: true,
    //   message: 'Bulk update completed. Created: 1, Updated: 1, Failed: 0.',
    //   data: {
    //     summary: { created: 1, updated: 1, failed: 0, total: 2 },
    //     results: [{ studentId, action: 'created'|'updated', totalScore, grade }],
    //     errors: [{ index, studentId, message }] // only present if there are errors
    //   }
    // }
    // -------------------------------------------------
    bulkUpdate: async (data) => {
        const response = await api.patch('/api/students-classes-scores/bulk', data);
        return response.data;
    },

    // -------------------------------------------------
    // DELETE - Bulk delete score records
    // Body: { assessmentIds: [...], force?: boolean }
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.bulkDelete(['id1', 'id2', 'id3']);
    //   const result = await studentsClassesScoresAPI.bulkDelete(['id1', 'id2'], true); // force delete approved records too
    //
    // Note:
    //   - Teachers: Can only delete their own non-approved records
    //   - Admins: Can delete any record; approved records require force=true for soft delete
    //
    // Returns: {
    //   success: true,
    //   message: 'Bulk delete completed.',
    //   data: {
    //     summary: { requested: 3, validIds: 3, deleted: 2, notFound: 0 }
    //   }
    // }
    // -------------------------------------------------
    bulkDelete: async (assessmentIds, force = false) => {
        const response = await api.delete('/api/students-classes-scores/bulk', { 
            assessmentIds, 
            force 
        });
        return response.data;
    },

    // -------------------------------------------------
    // GET - Get student's score summary by class (with positions)
    // URL param: classId
    // Query params: termId, sessionId, subjectId
    //
    // Usage:
    //   const result = await studentsClassesScoresAPI.getSummaryByClass(classId);
    //   const result = await studentsClassesScoresAPI.getSummaryByClass(classId, { termId: '...', subjectId: '...' });
    //
    // Returns: {
    //   success: true,
    //   data: {
    //     class: { id, name, level, section, fullName: 'JSS 1A' },
    //     term: { id, name: 'First Term' },
    //     session: { id, name: '2024/2025' },
    //     students: [{
    //       studentId, studentName, firstName, lastName, admissionNumber, gender, position,
    //       subjects: [{ subjectId, subjectName, subjectCode, testScore, ..., totalScore, grade, status }],
    //       totalScore, averageScore, subjectsWithScores, totalSubjects
    //     }, ...],
    //     classStatistics: {
    //       totalStudents: 45,
    //       studentsWithScores: 40,
    //       studentsWithoutScores: 5,
    //       classAverage: 72.5,
    //       highestAverage: 98,
    //       lowestAverage: 45
    //     }
    //   }
    // }
    // -------------------------------------------------
    getSummaryByClass: async (classId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/summary/${classId}`, { params });
        return response.data;
    },
};

// ===================================================================
// *** END OF STUDENT CLASSES AND SCORES MANAGEMENT ***
// ===================================================================

// ============================================
// HELPER FUNCTIONS
// ============================================

// Save auth data to localStorage
export const saveAuthData = (token, user) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }
};

// Get auth data from localStorage
export const getAuthData = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return { token, user };
    }
    return { token: null, user: null };
};

// Clear auth data from localStorage
export const clearAuthData = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

// Check if user is authenticated
export const isAuthenticated = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        return !!token;
    }
    return false;
};

// Get current user role
export const getUserRole = () => {
    if (typeof window !== 'undefined') {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user?.role || null;
    }
    return null;
};

// Download CSV file
export const downloadCSV = async (testId, filename) => {
    if (typeof window === 'undefined') return;
    
    try {
        const blob = await testResultsAPI.exportCSV(testId);
        const url = window.URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = url;
        link.setAttribute('download', filename || 'test_results.csv');
        document.body.appendChild(link);
        link.click();
        link.parentNode.removeChild(link);
        window.URL.revokeObjectURL(url);
    } catch (error) {
        console.error('Error downloading CSV:', error);
        throw error;
    }
};

// Default export - the main api instance
export default api;