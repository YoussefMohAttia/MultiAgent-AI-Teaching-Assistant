import axios from 'axios';

const api = axios.create({
  baseURL: '/api',
  headers: { 'Content-Type': 'application/json' },
  withCredentials: true,
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
export const summarizeText = (text) =>
  api.post('/ai/summarize', { text });

export const generateQuiz = (text, nItems = 5, nOptions = 4) =>
  api.post('/ai/generate-quiz', { text, n_items: nItems, n_options: nOptions });

export const chatWithTutor = (courseId, question, conversationId = 'default') =>
  api.post('/ai/chat', { course_id: courseId, question, conversation_id: conversationId });

export const evaluateSummary = (studentSummary, lectureText, referenceSummary = null) => {
  const body = { student_summary: studentSummary, lecture_text: lectureText };
  if (referenceSummary) body.reference_summary = referenceSummary;
  return api.post('/ai/evaluate', body);
};

export const indexDocument = (documentId, courseId) =>
  api.post('/ai/index-document', { document_id: documentId, course_id: courseId });

export default api;
