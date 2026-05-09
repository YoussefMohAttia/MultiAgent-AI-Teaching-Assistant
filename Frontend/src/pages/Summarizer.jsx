import { useState, useEffect, useRef } from 'react';
import { getCourses, getDocuments } from '../services/api'; 
import { FileText, ChevronDown, CheckCircle2, Zap, BarChart, AlertCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { incrementStat, recordActivity } from '../lib/activity';

export default function Summarizer() {
  const { user } = useAuth();
  const { t } = useLanguage();
  
  const [courses, setCourses] = useState([]);
  const [docs, setDocs] = useState([]);
  
  const [sourceMode, setSourceMode] = useState('document'); // 'document' | 'upload'
  const [selectedCourseId, setSelectedCourseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);
  
  // App States
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(''); 
  const [error, setError] = useState('');

  useEffect(() => {
    getCourses().then(r => setCourses(r.data.courses || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCourseId && sourceMode === 'document') {
      getDocuments(selectedCourseId).then(r => setDocs(r.data.documents || [])).catch(() => {});
    } else {
      setDocs([]);
    }
  }, [selectedCourseId, sourceMode]);

  const handleSummarize = async () => {
    if (sourceMode === 'document' && !selectedDocId) return;
    if (sourceMode === 'upload' && !uploadFile) return;
    if (!user) return;
    
    setIsSummarizing(true);
    setError('');
    setSummary('');

    try {
      let response;
      
      if (sourceMode === 'upload') {
        // EPHEMERAL UPLOAD API
        const formData = new FormData();
        formData.append('file', uploadFile);
        
        response = await axios.post('/api/ai/summarize-upload', formData, {
          headers: { 
            'Content-Type': 'multipart/form-data',
            Authorization: `Bearer ${user.token}` 
          },
        });
      } else {
        // STANDARD DATABASE API
        response = await axios.post('/api/ai/summarize', 
          { text: null, document_id: Number(selectedDocId) },
          { headers: { Authorization: `Bearer ${user.token}` } }
        );
      }
      
      setSummary(response.data.summary);
      incrementStat('summaries');
      recordActivity({
        type: 'summarizer',
        title: t('summarizerTitle'),
        route: '/summarizer',
      });
      
    } catch (err) {
      console.error("Summarization failed:", err);
      setError(err.response?.data?.detail || t('summarizerError'));
    } finally {
      setIsSummarizing(false);
    }
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      <div className="mb-6 flex-shrink-0">
        <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-indigo-400" />
          {t('summarizerTitle')}
        </h1>
        <p className="text-slate-400">
          {t('summarizerSubtitle')}
        </p>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* ── Left Column: Configuration ── */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-white mb-4">{t('summarizerConfig')}</h2>
            
            <div className="flex flex-col gap-5">
              {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Source Toggle */}
              <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                <button
                  onClick={() => setSourceMode('document')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'document' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('summarizerSourceDocument')}
                </button>
                <button
                  onClick={() => setSourceMode('upload')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'upload' ? 'bg-slate-800 text-white shadow-sm' : 'text-slate-500 hover:text-slate-300'}`}
                >
                  {t('summarizerSourceUpload')}
                </button>
              </div>

              {sourceMode === 'document' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('summarizerSelectCourse')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={selectedCourseId}
                        onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedDocId(''); setError(''); }}
                      >
                        <option value="" disabled>{t('summarizerChooseCourse')}</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('summarizerSelectDocument')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={selectedDocId}
                        onChange={(e) => { setSelectedDocId(e.target.value); setError(''); }}
                        disabled={!selectedCourseId || docs.length === 0}
                      >
                        <option value="" disabled>{!selectedCourseId ? t('summarizerSelectCourseFirst') : docs.length === 0 ? t('summarizerNoDocs') : t('summarizerChooseDocument')}</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                </>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-700 bg-slate-950 hover:bg-slate-900 transition-colors rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
                    <UploadCloud className="w-6 h-6 text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-white">{uploadFile ? uploadFile.name : t('summarizerClickBrowse')}</p>
                    <p className="text-xs text-slate-500 mt-1">{t('summarizerProcessedMemory')}</p>
                  </div>
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="application/pdf" 
                    className="hidden" 
                    onChange={(e) => { setUploadFile(e.target.files[0]); setError(''); }}
                  />
                </div>
              )}

              {/* Action Buttons */}
              <div className="pt-4 flex flex-col gap-3 border-t border-slate-800">
                <button 
                  onClick={handleSummarize}
                  disabled={(sourceMode === 'document' ? !selectedDocId : !uploadFile) || isSummarizing}
                  className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <Zap className={`w-4 h-4 ${isSummarizing ? 'animate-pulse text-yellow-300' : ''}`} />
                  {isSummarizing ? t('summarizerProcessing') : t('summarizerGenerate')}
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
              {t('summarizerOutput')}
            </h2>
          </div>
          
          <div className="p-6 flex-1 text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar">
            {summary ? (
              <MarkdownRenderer content={summary} className="max-w-none text-slate-300" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p>{t('summarizerEmpty')}</p>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  );
}