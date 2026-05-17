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

// ── Authentication ───────────────────────────────────────────────────────────
export const registerLocalAccount = (payload) => api.post('/login/register', payload);
export const loginLocalAccount = (payload) => api.post('/login/password', payload);

// ── Documents ────────────────────────────────────────────────────────────────
export const getDocuments = (courseId) => api.get(`/documents/${courseId}`);
export const getDocumentBlob = (id) => 
  api.get(`/documents/download/${id}`, { responseType: 'blob' });

// ── AI Services ──────────────────────────────────────────────────────────────

// source: { text: "..." }  OR  { documentId: 123 }
export const summarizeText = (source) =>
  api.post('/ai/summarize', {
    text: source.text || null,
    document_id: source.documentId || null,
  });

export const summarizeUploadedFile = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/ai/summarize-upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const evaluateUploadedSummary = (file, source, referenceSummary = null, keyPoints = null) => {
  const fd = new FormData();
  fd.append('file', file);
  if (source.text) fd.append('lecture_text', source.text);
  if (source.documentId) fd.append('document_id', String(source.documentId));
  if (referenceSummary) fd.append('reference_summary', referenceSummary);
  if (keyPoints) fd.append('key_points', JSON.stringify(keyPoints));
  return api.post('/ai/evaluate-upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const getSummaries = (userId, courseId = null) =>
  api.get('/ai/summaries', {
    params: {
      user_id: userId,
      ...(courseId ? { course_id: courseId } : {}),
    },
  });

export const getSummaryStatus = (docIds) =>
  api.get('/ai/summary-status', {
    params: { doc_ids: (docIds || []).join(',') },
  });

export const getQuizStatus = (docIds) =>
  api.get('/ai/quiz-status', {
    params: { doc_ids: (docIds || []).join(',') },
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

export const getChatConversations = (courseId = null) =>
  api.get('/ai/chat/conversations', {
    params: courseId ? { course_id: courseId } : {},
  });

export const getChatConversationMessages = (conversationId, courseId = null) =>
  api.get(`/ai/chat/conversations/${encodeURIComponent(conversationId)}`, {
    params: courseId ? { course_id: courseId } : {},
  });

export const synthesizeSpeech = (text, options = {}) =>
  api.post(
    '/ai/chat/tts',
    {
      text,
      voice: options.voice || null,
      model: options.model || null,
      response_format: options.responseFormat || null,
    },
    { responseType: 'blob' }
  );

export const transcribeAudio = (file) => {
  const fd = new FormData();
  fd.append('file', file);
  return api.post('/ai/chat/stt', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

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

export const gradeEssay = (essayText, question = null) =>
  api.post('/ai/grade-essay', {
    essay_text: essayText,
    question,
  });

export const gradeEssayUpload = (file, question = null) => {
  const fd = new FormData();
  fd.append('file', file);
  if (question) fd.append('question', question);
  return api.post('/ai/grade-essay-upload', fd, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });
};

export const indexDocument = (documentId, courseId) =>
  api.post('/ai/index-document', { document_id: documentId, course_id: courseId });

// ── Progress / Gamification ───────────────────────────────────────────────

export const getProgress = () => api.get('/progress/me');

export const logProgressEvent = (payload) =>
  api.post('/progress/event', payload);

export const getLeaderboard = () => api.get('/progress/leaderboard');

export default api;
