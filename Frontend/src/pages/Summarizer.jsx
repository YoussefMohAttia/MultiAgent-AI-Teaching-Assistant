import { useState, useEffect, useRef } from 'react';
import { getCourses, getDocuments, getSummaries, logProgressEvent } from '../services/api'; 
import { FileText, ChevronDown, CheckCircle2, Zap, BarChart, AlertCircle, UploadCloud } from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import axios from 'axios';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { incrementStat } from '../lib/activity';

const formatDocLabel = (doc) => {
  if (!doc) return '';
  return doc.doc_type ? `${doc.title} (${doc.doc_type})` : doc.title;
};

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

  const [activeTab, setActiveTab] = useState('generate'); // 'generate' | 'library'
  const [libraryCourseId, setLibraryCourseId] = useState('');
  const [librarySummaries, setLibrarySummaries] = useState([]);
  const [libraryLoading, setLibraryLoading] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [selectedSummary, setSelectedSummary] = useState(null);
  
  // App States
  const [isSummarizing, setIsSummarizing] = useState(false);
  const [summary, setSummary] = useState(''); 
  const [error, setError] = useState('');

  useEffect(() => {
    getCourses().then(r => setCourses(r.data.courses || [])).catch(() => {});
  }, []);

  useEffect(() => {
    if (selectedCourseId && sourceMode === 'document' && activeTab === 'generate') {
      getDocuments(selectedCourseId)
        .then((r) => {
          const usable = (r.data.documents || []).filter(
            (d) => d.doc_type !== 'announcement' && (d.download_url || d.google_drive_url || d.raw_text)
          );
          setDocs(usable);
        })
        .catch(() => {});
    } else {
      setDocs([]);
    }
  }, [selectedCourseId, sourceMode, activeTab]);

  useEffect(() => {
    if (activeTab !== 'library' || !user) return;
    loadSummaries();
  }, [activeTab, libraryCourseId, user]);

  const loadSummaries = async () => {
    if (!user) return;
    setLibraryLoading(true);
    setLibraryError('');
    try {
      const res = await getSummaries(user.id, libraryCourseId ? Number(libraryCourseId) : null);
      const items = res.data.summaries || [];
      setLibrarySummaries(items);
      if (items.length) {
        setSelectedSummary(items[0]);
      } else {
        setSelectedSummary(null);
      }
    } catch (err) {
      console.error('Failed to load summaries', err);
      setLibraryError(t('summarizerLibraryError'));
    } finally {
      setLibraryLoading(false);
    }
  };

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
      logProgressEvent({ event_type: 'summary_created' }).catch(() => {});
      
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
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white flex items-center gap-3 mb-2">
          <FileText className="w-8 h-8 text-indigo-600 dark:text-indigo-400" />
          {t('summarizerTitle')}
        </h1>
        <p className="text-slate-600 dark:text-slate-400">
          {t('summarizerSubtitle')}
        </p>
        <div className="mt-5 flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800 w-fit">
          <button
            type="button"
            onClick={() => setActiveTab('generate')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'generate' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
          >
            {t('summarizerTabGenerate')}
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('library')}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${activeTab === 'library' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
          >
            {t('summarizerTabLibrary')}
          </button>
        </div>
      </div>

      {activeTab === 'generate' ? (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* ── Left Column: Configuration ── */}
        <div className="w-full lg:w-1/3 flex flex-col gap-6">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white mb-4">{t('summarizerConfig')}</h2>
            
            <div className="flex flex-col gap-5">
              {error && (
                <div className="bg-red-50 dark:bg-rose-500/10 border border-red-200 dark:border-rose-500/20 text-red-700 dark:text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                  <p>{error}</p>
                </div>
              )}

              {/* Source Toggle */}
              <div className="flex bg-white dark:bg-slate-950 p-1 rounded-xl border border-slate-200 dark:border-slate-800">
                <button
                  onClick={() => setSourceMode('document')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'document' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                  {t('summarizerSourceDocument')}
                </button>
                <button
                  onClick={() => setSourceMode('upload')}
                  className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${sourceMode === 'upload' ? 'bg-indigo-600 dark:bg-slate-800 text-white shadow-sm' : 'text-slate-600 dark:text-slate-500 hover:text-slate-900 dark:hover:text-slate-300'}`}
                >
                  {t('summarizerSourceUpload')}
                </button>
              </div>

              {sourceMode === 'document' ? (
                <>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-400">{t('summarizerSelectCourse')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                        value={selectedCourseId}
                        onChange={(e) => { setSelectedCourseId(e.target.value); setSelectedDocId(''); setError(''); }}
                      >
                        <option value="" disabled>{t('summarizerChooseCourse')}</option>
                        {courses.map(c => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-700 dark:text-slate-400">{t('summarizerSelectDocument')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:cursor-not-allowed"
                        value={selectedDocId}
                        onChange={(e) => { setSelectedDocId(e.target.value); setError(''); }}
                        disabled={!selectedCourseId || docs.length === 0}
                      >
                        <option value="" disabled>{!selectedCourseId ? t('summarizerSelectCourseFirst') : docs.length === 0 ? t('summarizerNoDocs') : t('summarizerChooseDocument')}</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{formatDocLabel(d)}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                    </div>
                  </div>
                </>
              ) : (
                <div 
                  onClick={() => fileInputRef.current?.click()}
                  className="border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900 transition-colors rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group"
                >
                  <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:bg-indigo-200 dark:group-hover:bg-indigo-500/20 transition-colors">
                    <UploadCloud className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
                  </div>
                  <div className="text-center">
                    <p className="text-sm font-medium text-slate-900 dark:text-white">{uploadFile ? uploadFile.name : t('summarizerClickBrowse')}</p>
                    <p className="text-xs text-slate-600 dark:text-slate-500 mt-1">{t('summarizerProcessedMemory')}</p>
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
              <div className="pt-4 flex flex-col gap-3 border-t border-slate-200 dark:border-slate-800">
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
        <div className="w-full lg:w-2/3 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full">
          <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between flex-shrink-0">
            <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
              {t('summarizerOutput')}
            </h2>
          </div>
          
          <div className="p-6 flex-1 text-slate-700 dark:text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar">
            {summary ? (
              <MarkdownRenderer content={summary} className="max-w-none text-slate-700 dark:text-slate-300" />
            ) : (
              <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 dark:text-slate-500">
                <FileText className="w-12 h-12 mb-3 opacity-20" />
                <p>{t('summarizerEmpty')}</p>
              </div>
            )}
          </div>
        </div>

        </div>
      ) : (
        <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{t('summarizerLibraryTitle')}</h2>
                <button
                  type="button"
                  onClick={loadSummaries}
                  className="text-xs text-indigo-600 dark:text-indigo-300 hover:text-indigo-700 dark:hover:text-indigo-200 transition-colors"
                  disabled={libraryLoading}
                >
                  {t('summarizerLibraryRefresh')}
                </button>
              </div>

              {libraryError && (
                <div className="bg-red-50 dark:bg-rose-500/10 border border-red-200 dark:border-rose-500/20 text-red-700 dark:text-rose-400 p-3 rounded-lg text-sm mb-4">
                  {libraryError}
                </div>
              )}

              <div className="flex flex-col gap-2 mb-4">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-400">{t('summarizerLibrarySelectCourse')}</label>
                <div className="relative">
                  <select
                    className="w-full bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500"
                    value={libraryCourseId}
                    onChange={(e) => setLibraryCourseId(e.target.value)}
                  >
                    <option value="">{t('summarizerLibraryAllCourses')}</option>
                    {courses.map((c) => (
                      <option key={c.id} value={c.id}>{c.title}</option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400 pointer-events-none" />
                </div>
              </div>

              <div className="space-y-2 max-h-[calc(100vh-24rem)] overflow-y-auto custom-scrollbar pr-1">
                {libraryLoading ? (
                  <div className="text-sm text-slate-600 dark:text-slate-500">{t('summarizerLibraryLoading')}</div>
                ) : librarySummaries.length ? (
                  librarySummaries.map((item) => (
                    <button
                      key={item.summary_id}
                      type="button"
                      onClick={() => setSelectedSummary(item)}
                      className={`w-full text-left p-3 rounded-xl border transition-colors ${selectedSummary?.summary_id === item.summary_id ? 'border-indigo-400/70 bg-indigo-50 dark:border-indigo-500/60 dark:bg-indigo-500/10' : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 hover:bg-slate-100 dark:hover:bg-slate-900'}`}
                    >
                      <div className="text-sm font-semibold text-slate-900 dark:text-white truncate">{item.document_title}</div>
                      <div className="text-xs text-slate-600 dark:text-slate-500 mt-1">{item.course_title}</div>
                      <div className="text-xs text-slate-700 dark:text-slate-600 mt-2">
                        {item.summary?.slice(0, 120)}{item.summary?.length > 120 ? '...' : ''}
                      </div>
                    </button>
                  ))
                ) : (
                  <div className="text-sm text-slate-600 dark:text-slate-500">{t('summarizerLibraryEmpty')}</div>
                )}
              </div>
            </div>
          </div>

          <div className="w-full lg:w-2/3 flex flex-col bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-900/50 flex items-center justify-between flex-shrink-0">
              <h2 className="text-sm font-semibold text-slate-700 dark:text-slate-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 dark:text-emerald-500" />
                {selectedSummary ? selectedSummary.document_title : t('summarizerOutput')}
              </h2>
              {selectedSummary && (
                <div className="text-xs text-slate-600 dark:text-slate-500">{selectedSummary.course_title}</div>
              )}
            </div>

            <div className="p-6 flex-1 text-slate-700 dark:text-slate-300 leading-relaxed overflow-y-auto custom-scrollbar">
              {selectedSummary ? (
                <MarkdownRenderer content={selectedSummary.summary} className="max-w-none text-slate-700 dark:text-slate-300" />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-600 dark:text-slate-500">
                  <FileText className="w-12 h-12 mb-3 opacity-20" />
                  <p>{t('summarizerLibrarySelectHint')}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}