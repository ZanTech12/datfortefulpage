import axios from 'axios';

// ✅ Dynamic URL Logic for Network Settings
const DEFAULT_PROD_URL = 'https://aback-xi.vercel.app';
const DEFAULT_LOCAL_URL = 'https://aback-xi.vercel.app';

const getDefaultUrl = () => {
  // 1. Optional build-time override
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }

  // 2. ✅ FIXED: Local access FIRST (desktop .exe, localhost, or LAN IP)
  //    → local backend. The old version checked production mode first,
  //    which sent the packaged .exe to the cloud backend (Render) and
  //    caused 401s on every component using this module.
  if (typeof window !== 'undefined') {
    const host = window.location.hostname;
    if (host === 'localhost' || host === '127.0.0.1') {
      return DEFAULT_LOCAL_URL;
    }
    // LAN access via IP (e.g. 10.75.46.121) → backend on same machine
    if (host.match(/^(\d{1,3}\.){3}\d{1,3}$/)) {
      return `http://${host}:5000`;
    }
  }

  // 3. Real domain deployment (okispecial.com.ng etc.) → cloud backend
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

export { api };

// ============================================
// NETWORK SETTINGS API
// ============================================
export const networkAPI = {
    get: async () => {
        const response = await api.get('/site-information/network-settings');
        return response.data;
    },
    update: async (data) => {
        const response = await api.put('/site-information/network-settings', data);
        return response.data;
    }
};

// Request interceptor to add auth token
api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('token');
      if (token) {
        // Send BOTH headers to ensure backend compatibility
        config.headers['x-auth-token'] = token;
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => Promise.reject(error)
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
    
    // ✅ FIXED: Only log out on 401s from requests that actually carried a
    //    token. Anonymous 401s (pre-login page-load calls) must NOT wipe
    //    the session and force-reload the page.
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
    login: async (credentials) => {
        const response = await api.post('/login', credentials);
        return response.data;
    },
    loginStudent: async (credentials) => {
        const response = await api.post('/login/student', credentials);
        return response.data;
    },
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
        const response = await api.get('/superadmin');
        return response.data;
    },
    generateAdminToken: async (tokenData) => {
        const response = await api.post('/superadmin/generate-token', tokenData);
        return response.data;
    },
    updateAdmin: async (id, adminData) => {
        const response = await api.put(`/superadmin/${id}`, adminData);
        return response.data;
    },
    toggleAdminStatus: async (id) => {
        const response = await api.patch(`/superadmin/${id}/toggle`);
        return response.data;
    },
    deleteAdmin: async (id) => {
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
    getLastTeacherLogins: async () => {
        const response = await api.get('/dashboard/teacher-logins');
        return response.data;
    },
    getTeachers: async () => {
        const response = await api.get('/teachers');
        return response.data;
    },
    getClasses: async () => {
        const response = await api.get('/classes', { params: { limit: 1000 } });
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
// STUDENTS API
// ============================================
export const studentsAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/students', { params });
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
    toggleFeesAccess: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-fees-access`);
        return response.data;
    },
    toggleOwing: async (studentId) => {
        const response = await api.patch(`/students/${studentId}/toggle-owing`);
        return response.data;
    },
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
    uploadProfileImage: async (studentId, file, config = {}) => {
        const formData = new FormData();
        formData.append('profileImage', file);
        const response = await api.post(`/students/${studentId}/profile-image`, formData, {
            ...config,
            transformRequest: [(data, headers) => {
                delete headers['Content-Type'];
                return data;
            }]
        });
        return response.data;
    },
    removeProfileImage: async (studentId) => {
        const response = await api.delete(`/students/${studentId}/profile-image`);
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
        if (!/^\d+$/.test(String(classId))) {
            throw new Error(`getByClass requires a numeric class ID, received: "${classId}"`);
        }
        const response = await api.get(`/subjects/by-class/${classId}`);
        return response.data;
    },
};

// ============================================
// CLASSES API
// ============================================
export const classesAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/classes', { params });
        return response.data;
    },
    getAllForDropdown: async () => {
        const response = await api.get('/classes', { params: { limit: 1000 } });
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
// STUDENT-SPECIFIC API
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
    getTestResults: async () => {
        const response = await api.get('/student/test-results');
        return response.data;
    },
    getTestSchedule: async () => {
        const response = await api.get('/student/test-schedule');
        return response.data;
    },
    getResultAccessStatus: async () => {
        const response = await api.get('/student/result-access-status');
        return response.data;
    },
    getProfile: async () => {
        const response = await api.get('/student/profile');
        return response.data;
    },
    uploadProfileImage: async (file) => {
        const formData = new FormData();
        formData.append('profileImage', file);
        const response = await api.post('/student/profile-image', formData, {
            transformRequest: [(data, headers) => {
                delete headers['Content-Type'];
                return data;
            }]
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
        const response = await api.get(`/test-results/export/${testId}`, { responseType: 'blob' });
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

// ============================================
// GRADING SYSTEMS API
// ============================================
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
    getStudentCountsByClass: async (classId, params = {}) => {
        const response = await api.get(`/attendance/class/${classId}/student-counts`, { params });
        return response.data;
    },
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
    getAll: async (params = {}, config = {}) => {
        const response = await api.get('/continuous-assessments', { params, ...config });
        return response.data;
    },
    getById: async (id) => {
        const response = await api.get(`/continuous-assessments/${id}`);
        return response.data;
    },
    create: async (assessmentData) => {
        const response = await api.post('/continuous-assessments', assessmentData);
        return response.data;
    },
    bulkCreate: async (bulkData) => {
        const response = await api.post('/continuous-assessments/bulk', bulkData);
        return response.data;
    },
    submit: async (id) => {
        const response = await api.put(`/continuous-assessments/${id}/submit`);
        return response.data;
    },
    approve: async (id) => {
        const response = await api.put(`/admin/ca/${id}/approve`);
        return response.data;
    },
    update: async (id, data) => {
        const response = await api.put(`/admin/ca/${id}`, data);
        return response.data;
    },
    unapprove: async (id) => {
        const response = await api.put(`/admin/ca/${id}/unapprove`);
        return response.data;
    },
    bulkReapprove: async (ids) => {
        const response = await api.post('/admin/ca/bulk/approve-by-ids', { ids });
        return response.data;
    },
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/admin/ca/bulk/approve-by-filters', filters);
        return response.data;
    },
    bulkUnapprove: async (data) => {
        const response = await api.post('/admin/ca/bulk/unapprove', data);
        return response.data;
    },
    delete: async (id) => {
        const response = await api.delete(`/continuous-assessments/${id}`);
        return response.data;
    },
};

// ============================================
// TEACHER CA UPLOAD API
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
    getBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/teacher/broadsheet/${classId}`, { params });
        return response.data;
    },
    getClassTeacherClasses: async (params = {}) => {
        const response = await api.get('/class-teacher/broadsheet', { params });
        return response.data;
    },
    getClassTeacherBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/class-teacher/broadsheet/${classId}`, { params });
        return response.data;
    },
};

// ============================================
// ADMIN BROADSHEET API
// ============================================
export const adminBroadsheetAPI = {
    getBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/admin/broadsheet/${classId}`, { params });
        return response.data;
    },
    getClasses: async (params = {}) => {
        const response = await api.get('/admin/broadsheet/classes', { params });
        return response.data;
    },
    getDetailedBroadsheet: async (classId, params = {}) => {
        const response = await api.get(`/admin/broadsheet/${classId}`, { params });
        return response.data;
    },
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
// PRINCIPAL COMMENTS API
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
// CLASS TEACHER COMMENTS API
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
// TEACHER COMMENTS API
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
// REPORT CARDS API
// ============================================
const docId = (o) => o?._id ?? o?.id ?? null;

export const reportCardsAPI = {
    getStudentReport: async (studentId, params = {}) => {
        const response = await api.get(`/report-cards/student/${studentId}`, { params });
        return response.data;
    },
    getClassReport: async (classId, params = {}) => {
        const response = await api.get(`/report-cards/class/${classId}`, { params });
        return response.data;
    },
    checkResults: async (credentials) => {
        const response = await api.post('/student/check-results', credentials);
        return response.data;
    },
    getStatus: async (termId) => {
        const response = await api.get('/report-cards/status', { params: { termId } });
        return response.data;
    },
    getPrintData: async (termId, classIds) => {
        const idsString = Array.isArray(classIds) ? classIds.join(',') : classIds;
        const response = await api.get('/report-cards/print-data', { params: { termId, classIds: idsString } });
        return response.data;
    },
    getStudentPrint: async (studentId, termId, sessionId = null) => {
        const params = { termId };
        if (sessionId) params.sessionId = sessionId;
        const response = await api.get(`/report-cards/student-print/${studentId}`, { params });
        return response.data;
    },
    getSingleClassPrintData: async (classId, termId) => {
        return await reportCardsAPI.getPrintData(termId, [classId]);
    },
    getAllClassesPrintData: async (termId) => {
        const classesResponse = await classesAPI.getAllForDropdown();
        const classes = classesResponse?.data?.data || classesResponse?.data || [];
        const classIds = (Array.isArray(classes) ? classes : []).map(docId).filter((v) => v != null);
        if (classIds.length === 0) return { success: true, data: { classes: [], allStudents: [] } };
        return await reportCardsAPI.getPrintData(termId, classIds);
    },
};

// ============================================
// SCHOOL SETTINGS API
// ============================================
export const siteInfoAPI = {
    getSiteInfo: async () => {
        const response = await api.get('/site-information');
        return response.data;
    },
    upsertSiteInfo: async (formData) => {
        const response = await api.put('/site-information', formData, {
            transformRequest: [(data, headers) => {
                delete headers['Content-Type'];
                return data;
            }]
        });
        return response.data;
    },
    deleteSingleImage: async (field) => {
        const response = await api.delete(`/site-information/image/${field}`);
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
// ADMIN CA FILTERING API
// ============================================
export const adminCAAPI = {
    getFilterOptions: async (params = {}) => {
        const response = await api.get('/admin/ca/filter-options', { params });
        return response.data;
    },
    getAssessments: async (params = {}) => {
        const response = await api.get('/admin/ca/all', { params });
        return response.data;
    },
    getAllApproved: async (params = {}) => {
        const response = await api.get('/admin/ca/all-approved', { params });
        return response.data;
    },
    approve: async (id) => {
        const response = await api.put(`/admin/ca/${id}/approve`);
        return response.data;
    },
    unapprove: async (id) => {
        const response = await api.put(`/admin/ca/${id}/unapprove`);
        return response.data;
    },
    bulkApprove: async (ids) => {
        const response = await api.post('/admin/ca/bulk/approve-by-ids', { ids });
        return response.data;
    },
    bulkApproveByFilters: async (filters) => {
        const response = await api.post('/admin/ca/bulk/approve-by-filters', filters);
        return response.data;
    },
    bulkUnapprove: async (data) => {
        const response = await api.post('/admin/ca/bulk/unapprove', data);
        return response.data;
    },
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
    clearApprovalByIds: async (assessmentIds, resetTo = 'draft') => {
        const response = await api.patch('/admin/ca/clear-approval-status/by-ids', { assessmentIds, resetTo });
        return response.data;
    },
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
// ADMIN CA PROGRESS API
// ============================================
export const adminCAProgressAPI = {
    getTeacherProgress: async (params = {}) => {
        const response = await api.get('/admin/ca/teacher-progress', { params });
        return response.data;
    },
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
// PUBLIC API
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
    getSiteInfo: async (schoolCode) => {
        const response = await api.get('/public/site-info', { params: { schoolCode } });
        return response.data;
    }
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
    debugCAEntries: async (params = {}) => {
        const response = await api.get('/debug/ca-entries', { params });
        return response.data;
    },
};

// ============================================
// STUDENT CLASSES AND SCORES MANAGEMENT API
// ============================================
export const studentsClassesScoresAPI = {
    getAll: async (params = {}) => {
        const response = await api.get('/api/students-classes-scores', { params });
        return response.data;
    },
    getByStudentId: async (studentId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/${studentId}`, { params });
        return response.data;
    },
    create: async (scoreData) => {
        const response = await api.post('/api/students-classes-scores', scoreData);
        return response.data;
    },
    update: async (assessmentId, scoreData) => {
        const response = await api.put(`/api/students-classes-scores/${assessmentId}`, scoreData);
        return response.data;
    },
    delete: async (assessmentId) => {
        const response = await api.delete(`/api/students-classes-scores/${assessmentId}`);
        return response.data;
    },
    bulkUpdate: async (data) => {
        const response = await api.patch('/api/students-classes-scores/bulk', data);
        return response.data;
    },
    bulkDelete: async (assessmentIds, force = false) => {
        const response = await api.delete('/api/students-classes-scores/bulk', { 
            data: { assessmentIds, force } 
        });
        return response.data;
    },
    getSummaryByClass: async (classId, params = {}) => {
        const response = await api.get(`/api/students-classes-scores/summary/${classId}`, { params });
        return response.data;
    },
};

// ============================================
// E-NOTES API (Cache-Busting Enabled)
// ============================================
export const eNotesAPI = {
    getMyClasses: async () => {
        const response = await api.get(`/e-notes/my-classes?t=${Date.now()}`);
        return response.data;
    },
    getMyInfo: async () => {
        const response = await api.get(`/e-notes/my-info?t=${Date.now()}`);
        return response.data;
    },
    getMySubjects: async (classId) => {
        const response = await api.get(`/e-notes/my-subjects?t=${Date.now()}`, { params: { classId } });
        return response.data;
    },
    getStudents: async (classId) => {
        const response = await api.get(`/e-notes/students?t=${Date.now()}`, { params: { classId } });
        return response.data;
    },
    getWeeks: async (classId, subjectId = null) => {
        const params = { classId, t: Date.now() };
        if (subjectId) params.subjectId = subjectId;
        const response = await api.get('/e-notes/weeks', { params });
        return response.data;
    },
    createWeek: async (payload) => {
        const response = await api.post('/e-notes/weeks', payload);
        return response.data;
    },
    uploadFiles: async (weekId, formData) => {
        const response = await api.post(`/e-notes/weeks/${weekId}/upload`, formData, {
            transformRequest: [(data, headers) => {
                delete headers['Content-Type'];
                return data;
            }]
        });
        return response.data;
    },
    deleteFile: async (fileId) => {
        const response = await api.delete(`/e-notes/files/${fileId}`);
        return response.data;
    },
    deleteWeek: async (weekId) => {
        const response = await api.delete(`/e-notes/weeks/${weekId}`);
        return response.data;
    }
};

// ============================================
// HELPER FUNCTIONS
// ============================================

export const saveAuthData = (token, user) => {
    if (typeof window !== 'undefined') {
        localStorage.setItem('token', token);
        localStorage.setItem('user', JSON.stringify(user));
    }
};

export const getAuthData = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return { token, user };
    }
    return { token: null, user: null };
};

export const clearAuthData = () => {
    if (typeof window !== 'undefined') {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
    }
};

export const isAuthenticated = () => {
    if (typeof window !== 'undefined') {
        const token = localStorage.getItem('token');
        return !!token;
    }
    return false;
};

export const getUserRole = () => {
    if (typeof window !== 'undefined') {
        const user = JSON.parse(localStorage.getItem('user') || 'null');
        return user?.role || null;
    }
    return null;
};

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

export default api;