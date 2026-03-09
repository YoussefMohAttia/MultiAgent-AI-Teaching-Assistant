import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
});

// Attach JWT token from localStorage to every request automatically
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('jwt_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// ── Courses ──────────────────────────────────────────────────────────────────
export const getCourses = () => api.get('/courses/');
export const createCourse = (title) => api.post(`/courses/?title=${encodeURIComponent(title)}`);
export const deleteCourse = (id) => api.delete(`/courses/${id}`);

// ── Documents ────────────────────────────────────────────────────────────────
export const getDocuments = (courseId) => api.get(`/documents/${courseId}`);
export const uploadDocument = (courseId, file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post(`/documents/upload?course_id=${courseId}`, fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

// ── AI Services ──────────────────────────────────────────────────────────────

// source: { text: "..." }  OR  { documentId: 123 }
export const summarizeText = (source) =>
  api.post('/ai/summarize', {
    text: source.text || null,
    document_id: source.documentId || null,
  });

// source: { text: "..." }  OR  { documentId: 123 }  (the lecture / reference material)
export const generateQuiz = (courseId, createdBy, source, nItems = 5, nOptions = 4) =>
  api.post('/ai/generate-quiz', {
    course_id: courseId,
    created_by: createdBy,
    text: source.text || null,
    document_id: source.documentId || null,
    n_items: nItems,
    n_options: nOptions,
  });

export const getQuizzesByCourse = (courseId) =>
  api.get(`/quizzes/course/${courseId}`);

export const chatWithTutor = (courseId, question, conversationId = 'default') =>
  api.post('/ai/chat', { course_id: courseId, question, conversation_id: conversationId });

// source: { text: "..." }  OR  { documentId: 123 }  (the lecture / reference material)
export const evaluateSummary = (studentSummary, source, referenceSummary = null) => {
  const body = {
    student_summary: studentSummary,
    lecture_text: source.text || null,
    document_id: source.documentId || null,
  };
  if (referenceSummary) body.reference_summary = referenceSummary;
  return api.post('/ai/evaluate', body);
};

export const indexDocument = (documentId, courseId) =>
  api.post('/ai/index-document', { document_id: documentId, course_id: courseId });

export default api;
