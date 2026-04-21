import { useState, useEffect } from 'react';
import { getCourses, getDocuments } from '../services/api'; 
import { FileText, ChevronDown, CheckCircle2, Zap, BarChart, AlertCircle } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import axios from 'axios';

export default function Summarizer() {
  const navigate = useNavigate();
  const { user } = useAuth(); // <-- Brought in AuthContext to get the token
  
  const [courses, setCourses] = useState([]);
  const [docs, setDocs] = useState([]);
  
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  
  // App States
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(''); 
  const [error, setError] = useState('');

  // 1. Load Courses
  useEffect(() => {
    getCourses().then(r => setCourses(r.data.courses || [])).catch(() => {});
  }, []);

  // 2. Load Documents when Course is selected
  useEffect(() => {
    if (selectedCourseId) {
      getDocuments(selectedCourseId).then(r => setDocs(r.data.documents || [])).catch(() => {});
    } else {
      setDocs([]);
    }
  }, [selectedCourseId]);

  // 3. The REAL Backend Integration
  const handleSummarize = async () => {
    if (!selectedDocId || !user) return;
    
    setIsSummarizing(true);
    setError('');
    setSummary('');

    try {
      // USING THE CORRECT BACKEND ENDPOINT
      const response = await axios.post(
        '/api/ai/summarize', 
        {
          text: null,
          document_id: Number(selectedDocId) 
        },
        {
          headers: { Authorization: `Bearer ${user.token}` },
        }
      );
      
      // The original code expected res.data.summary
      setSummary(response.data.summary);
      
    } catch (err) {
      console.error("Summarization failed:", err);
      setError(
        err.response?.data?.detail || 
        "Failed to generate summary. Please check your backend connection."
      );
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-indigo-400" />
          AI Summarizer
        </h1>
        <p className="text-slate-400">
          Transform lengthy lecture materials into concise, easy-to-read notes.
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* ── Left Column: Configuration ── */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-white mb-4">Configuration</h2>
            
            <div className="flex flex-col gap-4">
              {/* Error Message Display */}
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Custom Styled Dropdowns */}
              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-400">Select Course</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={selectedCourseId}
                    onChange={(e) => {
                      setSelectedCourseId(e.target.value);
                      setSelectedDocId('');
                      setError('');
                    }}
                  >
                    <option value="" disabled>Choose a course...</option>
                    {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              <div className="flex flex-col gap-2">
                <label className="text-sm font-medium text-slate-400">Select Document</label>
                <div className="relative">
                  <select 
                    className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                    value={selectedDocId}
                    onChange={(e) => {
                      setSelectedDocId(e.target.value);
                      setError('');
                    }}
                    disabled={!selectedCourseId || docs.length === 0}
                  >
                    <option value="" disabled>
                      {!selectedCourseId ? 'Select course first' : docs.length === 0 ? 'No documents found' : 'Choose a document...'}
                    </option>
                    {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              </div>

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col gap-3 border-t border-slate-800 mt-2">
                <button 
                  onClick={handleSummarize}
                  disabled={!selectedDocId || isSummarizing}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className={`w-4 h-4 ${isSummarizing ? 'animate-pulse text-yellow-300' : ''}`} />
                  {isSummarizing ? 'Processing AI...' : 'Generate Summary'}
                </button>

                <button 
                  onClick={() => navigate('/evaluator')}
                  className="w-full flex items-center justify-center gap-2 bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 hover:text-white font-medium py-3 rounded-xl transition-colors"
                >
                  <BarChart className="w-4 h-4" />
                  Evaluate Summary
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* ── Right Column: AI Output Window ── */}
        <div className="w-full lg:w-2/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full">
          <div className="p-4 border-b border-slate-800 bg-slate-900/50 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-500" />
              Summary Output
            </h2>
          </div>
          
          <div className="p-6 flex-1 text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar">
            {summary ? (
              <div className="prose prose-invert max-w-none whitespace-pre-wrap">
                {summary}
              </div>
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p>Select a document and click generate to view the AI summary here.</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}