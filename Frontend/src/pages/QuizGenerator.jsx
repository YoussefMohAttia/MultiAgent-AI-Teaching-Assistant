import { useState, useEffect, useRef } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import { generateQuiz, getQuizzesByCourse, getCourses, getDocuments, logProgressEvent } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { BrainCircuit, BookOpen, ChevronDown, UploadCloud, AlertCircle, Sparkles, CheckCircle2, XCircle, Zap } from 'lucide-react';
import { incrementStat, recordActivity } from '../lib/activity';

export default function QuizGenerator() {
  const { user } = useAuth();
  const { t } = useLanguage();
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState(searchParams.get('tab') === 'take' ? 'take' : 'generate');

  const [courses, setCourses] = useState([]);
  const [courseId, setCourseId] = useState('');

  // Generate Tab States
  const [sourceMode, setSourceMode] = useState('document'); // 'text' | 'document' | 'upload'
  const [text, setText] = useState('');
  const [docs, setDocs] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);

  const [nItems, setNItems] = useState(5);
  const [nOptions, setNOptions] = useState(4);
  const [genLoading, setGenLoading] = useState(false);
  const [genError, setGenError] = useState('');
  
  // Results
  const [generatedItems, setGeneratedItems] = useState([]);
  const [generatedQuizId, setGeneratedQuizId] = useState(null);

  // Take Tab States
  const [quizzes, setQuizzes] = useState([]);
  const [quizzesLoading, setQuizzesLoading] = useState(false);
  const [activeQuiz, setActiveQuiz] = useState(null);
  const [takeItems, setTakeItems] = useState([]);

  useEffect(() => {
    getCourses().then((r) => {
      const list = r.data.courses || [];
      setCourses(list);
      if (list.length) setCourseId(String(list[0].id));
    }).catch(() => {});
  }, []);

  useEffect(() => {
    if (tab === 'take' && courseId) {
      setActiveQuiz(null); setTakeItems([]); setQuizzesLoading(true);
      getQuizzesByCourse(Number(courseId))
        .then((r) => setQuizzes(r.data || []))
        .catch(() => setQuizzes([]))
        .finally(() => setQuizzesLoading(false));
    }
  }, [tab, courseId]);

  useEffect(() => {
    if (sourceMode === 'document' && courseId) {
      setDocsLoading(true); setSelectedDocId('');
      getDocuments(Number(courseId))
        .then((r) => {
          const usable = (r.data.documents || []).filter(d => d.download_url || d.google_drive_url || d.raw_text);
          setDocs(usable);
          if (usable.length) setSelectedDocId(String(usable[0].id));
        })
        .catch(() => setDocs([]))
        .finally(() => setDocsLoading(false));
    }
  }, [sourceMode, courseId]);

  const isGenerateDisabled = genLoading || (
    sourceMode === 'text' ? (!courseId || !text.trim()) :
    sourceMode === 'document' ? (!courseId || !selectedDocId) :
    (!uploadFile)
  );

  const handleGenerate = async () => {
    if (isGenerateDisabled) return;
    setGenLoading(true); setGenError(''); setGeneratedItems([]); setGeneratedQuizId(null);

    try {
      if (sourceMode === 'upload') {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('n_items', nItems);
        formData.append('n_options', nOptions);

        const res = await axios.post('/api/ai/generate-quiz-upload', formData, {
          headers: { 'Content-Type': 'multipart/form-data', Authorization: `Bearer ${user.token}` },
        });
        setGeneratedItems(res.data.items || []);
      } else {
        const source = sourceMode === 'document' ? { documentId: Number(selectedDocId) } : { text };
        const res = await generateQuiz(Number(courseId), user.id, source, nItems, nOptions);
        setGeneratedItems(res.data.items || []);
        setGeneratedQuizId(res.data.quiz_id);
      }

      incrementStat('quizzesGenerated');
      recordActivity({
        type: 'quiz',
        title: `${t('quizTitle')} - ${t('quizTabGenerate')}`,
        route: '/quiz',
      });
      logProgressEvent({ event_type: 'quiz_generated' }).catch(() => {});
    } catch (e) {
      setGenError(e.response?.data?.detail || t('quizGenerationFailed'));
    }
    setGenLoading(false);
  };

  const handleSelectQuiz = (quiz) => {
    setActiveQuiz(quiz);
    const items = (quiz.questions || []).map((q) => {
      // Safely handle options whether they come back as arrays or objects
      const opts = Array.isArray(q.options) ? q.options : Object.values(q.options || {});
      return { stem: q.question, options: opts, answer_index: opts.indexOf(q.correct_answer) };
    });
    setTakeItems(items);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-6rem)] animate-in fade-in duration-500 max-w-6xl mx-auto">
      
      {/* Header */}
      <div className="mb-6 flex-shrink-0 flex justify-between items-end">
        <div>
          <h1 className="text-3xl font-bold text-white flex items-center gap-3 mb-2">
            <BrainCircuit className="w-8 h-8 text-indigo-400" />
            {t('quizTitle')}
          </h1>
          <p className="text-slate-400">{t('quizSubtitle')}</p>
        </div>
        
        {/* Main Tabs */}
        <div className="flex bg-slate-900 p-1 rounded-xl border border-slate-800">
          <button
            onClick={() => setTab('generate')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'generate' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            {t('quizTabGenerate')}
          </button>
          <button
            onClick={() => setTab('take')}
            className={`px-6 py-2.5 text-sm font-medium rounded-lg transition-all ${tab === 'take' ? 'bg-indigo-600 text-white shadow-sm' : 'text-slate-400 hover:text-white'}`}
          >
            {t('quizTabTake')}
          </button>
        </div>
      </div>

      <div className="flex flex-col lg:flex-row gap-6 h-full min-h-0">
        
        {/* ── Left Column: Config (Only visible on Generate) ── */}
        {tab === 'generate' && (
          <div className="w-full lg:w-1/3 flex flex-col gap-6">
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-sm">
              <h2 className="text-lg font-semibold text-white mb-4">{t('quizSettings')}</h2>
              
              <div className="flex flex-col gap-5">
                {genError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm flex items-start gap-2">
                    <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0" />
                    <p>{genError}</p>
                  </div>
                )}

                {/* Sub-tabs for Source */}
                <div className="flex bg-slate-950 p-1 rounded-xl border border-slate-800">
                  <button onClick={() => setSourceMode('document')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${sourceMode === 'document' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('quizSourceDocument')}</button>
                  <button onClick={() => setSourceMode('upload')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${sourceMode === 'upload' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('quizSourceUpload')}</button>
                  <button onClick={() => setSourceMode('text')} className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${sourceMode === 'text' ? 'bg-slate-800 text-white' : 'text-slate-500 hover:text-slate-300'}`}>{t('quizSourceText')}</button>
                </div>

                {sourceMode !== 'upload' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('quizCourseLabel')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500"
                        value={courseId} onChange={(e) => setCourseId(e.target.value)}
                      >
                        {courses.length === 0 && <option value="">{t('quizLoadingCourses')}</option>}
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                {sourceMode === 'document' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('quizSelectDocument')}</label>
                    <div className="relative">
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-3 appearance-none focus:outline-none focus:border-indigo-500 disabled:opacity-50"
                        value={selectedDocId} onChange={(e) => setSelectedDocId(e.target.value)} disabled={!courseId || docs.length === 0}
                      >
                        <option value="" disabled>{docsLoading ? t('quizLoading') : docs.length === 0 ? t('quizNoDocs') : t('quizChooseDocument')}</option>
                        {docs.map(d => <option key={d.id} value={d.id}>{d.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>
                )}

                {sourceMode === 'upload' && (
                  <div onClick={() => fileInputRef.current?.click()} className="border-2 border-dashed border-slate-700 bg-slate-950 hover:bg-slate-900 transition-colors rounded-xl p-6 flex flex-col items-center justify-center gap-3 cursor-pointer group">
                    <div className="w-10 h-10 bg-indigo-500/10 rounded-full flex items-center justify-center group-hover:bg-indigo-500/20"><UploadCloud className="w-5 h-5 text-indigo-400" /></div>
                    <div className="text-center">
                      <p className="text-sm font-medium text-white">{uploadFile ? uploadFile.name : t('quizUploadBrowse')}</p>
                    </div>
                    <input type="file" ref={fileInputRef} accept="application/pdf" className="hidden" onChange={(e) => setUploadFile(e.target.files[0])} />
                  </div>
                )}

                {sourceMode === 'text' && (
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('quizPasteTextLabel')}</label>
                    <textarea className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl p-4 focus:outline-none focus:border-indigo-500 custom-scrollbar" rows={4} value={text} onChange={(e) => setText(e.target.value)} placeholder={t('quizPasteTextPlaceholder')} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4">
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('quizQuestionsLabel')}</label>
                    <select className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3" value={nItems} onChange={(e) => setNItems(+e.target.value)}>
                      {[3, 5, 7, 10, 15].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                  <div className="flex flex-col gap-2">
                    <label className="text-sm font-medium text-slate-400">{t('quizOptionsLabel')}</label>
                    <select className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl px-4 py-3" value={nOptions} onChange={(e) => setNOptions(+e.target.value)}>
                      {[2, 3, 4, 5].map(n => <option key={n} value={n}>{n}</option>)}
                    </select>
                  </div>
                </div>

                <div className="pt-4 border-t border-slate-800">
                  <button onClick={handleGenerate} disabled={isGenerateDisabled} className="w-full flex items-center justify-center gap-2 bg-indigo-600 hover:bg-indigo-500 text-white font-medium py-3 rounded-xl transition-colors disabled:opacity-50">
                    <Sparkles className={`w-4 h-4 ${genLoading ? 'animate-pulse text-yellow-300' : ''}`} />
                    {genLoading ? t('quizGenerating') : t('quizBuild')}
                  </button>
                </div>

              </div>
            </div>
          </div>
        )}

        {/* ── Right Column / Full Width: Output ── */}
        <div className={`w-full ${tab === 'generate' ? 'lg:w-2/3' : ''} flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-sm overflow-hidden h-full`}>
          
          {tab === 'generate' && (
            <div className="p-6 flex-1 overflow-y-auto custom-scrollbar">
              {generatedQuizId && sourceMode !== 'upload' && (
                <div className="mb-6 bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 p-4 rounded-xl flex items-center gap-3">
                  <CheckCircle2 className="w-5 h-5" />
                  <p className="text-sm font-medium">{t('quizSaved')}</p>
                </div>
              )}
              
              {!generatedQuizId && generatedItems.length > 0 && sourceMode === 'upload' && (
                <div className="mb-6 bg-blue-500/10 border border-blue-500/20 text-blue-400 p-4 rounded-xl flex items-center gap-3">
                  <Zap className="w-5 h-5" />
                  <p className="text-sm font-medium">{t('quizEphemeral')}</p>
                </div>
              )}

              {generatedItems.length > 0 ? (
                <QuizTaker items={generatedItems} />
              ) : (
                <div className="h-full flex flex-col items-center justify-center text-center text-slate-500">
                  <BrainCircuit className="w-12 h-12 mb-3 opacity-20" />
                  <p>{t('quizEmptyState')}</p>
                </div>
              )}
            </div>
          )}

          {tab === 'take' && (
            <div className="p-6 flex-1 flex flex-col overflow-hidden">
              
              {!activeQuiz ? (
                <>
                  <div className="flex items-center justify-between mb-6">
                    <h2 className="text-xl font-bold text-white">{t('quizYourQuizzes')}</h2>
                    <div className="relative w-64">
                      <select 
                        className="w-full bg-slate-950 border border-slate-700 text-slate-200 text-sm rounded-xl pl-4 pr-10 py-2.5 appearance-none focus:outline-none focus:border-indigo-500"
                        value={courseId} onChange={(e) => setCourseId(e.target.value)}
                      >
                        {courses.map((c) => <option key={c.id} value={c.id}>{c.title}</option>)}
                      </select>
                      <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto custom-scrollbar grid grid-cols-1 md:grid-cols-2 gap-4 auto-rows-max">
                    {quizzesLoading ? (
                       <p className="text-slate-400 text-sm">{t('quizLoadingQuizzes')}</p>
                    ) : quizzes.length === 0 ? (
                      <div className="col-span-full py-12 text-center border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
                        <BookOpen className="w-8 h-8 text-slate-600 mx-auto mb-3" />
                        <p className="text-slate-400">{t('quizNoQuizzes')}</p>
                      </div>
                    ) : (
                      quizzes.map((quiz) => (
                        <div key={quiz.id} onClick={() => handleSelectQuiz(quiz)} className="bg-slate-800 border border-slate-700 hover:border-indigo-500 hover:bg-slate-800/80 p-5 rounded-xl cursor-pointer transition-all flex flex-col justify-between min-h-[120px] group">
                           <div>
                              <div className="flex justify-between items-start mb-2">
                                <span className="px-2.5 py-1 bg-indigo-500/20 text-indigo-400 text-xs font-bold rounded-md">{t('quizLabel')} #{quiz.id}</span>
                                <span className="text-xs text-slate-500">{new Date(quiz.created_at).toLocaleDateString()}</span>
                              </div>
                              <p className="text-sm text-slate-300 font-medium">{quiz.questions?.length || 0} {t('quizQuestionsLabel')}</p>
                           </div>
                           <div className="flex justify-end opacity-0 group-hover:opacity-100 transition-opacity">
                             <span className="text-xs font-bold text-indigo-400 flex items-center gap-1">{t('quizTakeQuiz')} <span className="text-lg leading-none">&rarr;</span></span>
                           </div>
                        </div>
                      ))
                    )}
                  </div>
                </>
              ) : (
                <div className="flex flex-col h-full overflow-hidden">
                  <div className="flex items-center gap-4 mb-6 flex-shrink-0">
                    <button onClick={() => { setActiveQuiz(null); setTakeItems([]); }} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">
                      &larr; {t('quizBackToQuizzes')}
                    </button>
                    <div>
                      <h2 className="text-lg font-bold text-white">{t('quizLabel')} #{activeQuiz.id}</h2>
                      <p className="text-xs text-slate-400">{takeItems.length} {t('quizQuestionsLabel')}</p>
                    </div>
                  </div>
                  <div className="flex-1 overflow-y-auto custom-scrollbar pr-2">
                     <QuizTaker items={takeItems} />
                  </div>
                </div>
              )}
            </div>
          )}

        </div>
      </div>
    </div>
  );
}

// ── Shared Quiz Taker UI (Defensively Programmed) ──
function QuizTaker({ items }) {
  const { t } = useLanguage();
  const [selected, setSelected] = useState({});
  const [locked, setLocked] = useState({});
  const [revealedAll, setRevealedAll] = useState(false);
  const [showScoreBar, setShowScoreBar] = useState(false);
  const [completionLogged, setCompletionLogged] = useState(false);

  const attempted = Object.values(selected).filter(v => v !== '__revealed__').length;
  const score = items.filter((q, i) => selected[i] !== '__revealed__' && selected[i] === q.answer_index).length;

  const onAnswer = (qIdx, oIdx) => {
    if (locked[qIdx] || revealedAll) return;
    setSelected(prev => ({ ...prev, [qIdx]: oIdx }));
    setLocked(prev => ({ ...prev, [qIdx]: true }));
  };

  const revealAllAnswers = () => {
    const nextLocked = {};
    const nextSelected = { ...selected };
    items.forEach((_, i) => {
      nextLocked[i] = true;
      if (nextSelected[i] === undefined) nextSelected[i] = '__revealed__';
    });
    setLocked(nextLocked); setSelected(nextSelected); setRevealedAll(true); setShowScoreBar(true);

    if (!completionLogged) {
      incrementStat('quizzesTaken');
      recordActivity({
        type: 'quiz',
        title: `${t('quizTitle')} - ${t('quizTabTake')}`,
        route: '/quiz?tab=take',
      });
      logProgressEvent({ event_type: 'quiz_completed', correct: score, total: attempted }).catch(() => {});
      setCompletionLogged(true);
    }
  };

  const resetAll = () => {
    setSelected({});
    setLocked({});
    setRevealedAll(false);
    setShowScoreBar(false);
    setCompletionLogged(false);
  };

  return (
    <div className="flex flex-col gap-8">
      
      {/* Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-950/50 p-4 rounded-xl border border-slate-800">
        <div className="flex gap-2">
          <button onClick={revealAllAnswers} className="px-4 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors">{t('quizRevealAnswers')}</button>
          <button onClick={resetAll} className="px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-300 text-sm font-medium rounded-lg transition-colors">{t('quizReset')}</button>
        </div>
        
        {showScoreBar && (
          <div className="px-4 py-2 bg-slate-800 border border-slate-700 rounded-lg">
            <span className="text-sm font-medium text-slate-300">{t('quizScoreLabel')}: <span className="text-white font-bold">{score}/{attempted}</span> <span className="text-slate-500">({Math.round((score / Math.max(items.length, 1)) * 100)}%)</span></span>
          </div>
        )}
      </div>

      {/* Questions */}
      <div className="flex flex-col gap-6">
        {items.map((q, qi) => {
          const chosen = selected[qi];
          const isRevealedOnly = chosen === '__revealed__';
          const isAnswered = chosen !== undefined;
          const isCorrectAnswered = !isRevealedOnly && chosen === q.answer_index;
          const isWrongAnswered = !isRevealedOnly && isAnswered && chosen !== q.answer_index;

          return (
            <div key={qi} className={`p-6 rounded-xl border transition-all ${isCorrectAnswered ? 'bg-emerald-950/20 border-emerald-900/50' : isWrongAnswered || isRevealedOnly ? 'bg-rose-950/20 border-rose-900/50' : 'bg-slate-800 border-slate-700'}`}>
              
              <div className="flex gap-4 mb-5">
                <div className={`w-8 h-8 flex-shrink-0 flex items-center justify-center rounded-lg font-bold text-sm ${isCorrectAnswered ? 'bg-emerald-500 text-white' : isWrongAnswered || isRevealedOnly ? 'bg-rose-500 text-white' : 'bg-slate-700 text-slate-300'}`}>
                  {qi + 1}
                </div>
                <p className="text-white font-medium pt-1 leading-relaxed">{q.stem}</p>
              </div>

              <div className="flex flex-col gap-2 pl-12">
                {/* 🔥 THE DEFENSIVE FIX: Safely parse options array regardless of AI format */}
                {(Array.isArray(q.options) ? q.options : Object.values(q.options || {})).map((opt, oi) => {
                  const isCorrectOption = oi === q.answer_index;
                  const isSelectedOption = chosen === oi;
                  const showAsCorrect = (isCorrectOption && locked[qi]) || (isCorrectOption && revealedAll);
                  const showAsWrong = isSelectedOption && !isCorrectOption && (locked[qi] || revealedAll);

                  let btnStyle = "bg-slate-900/50 border-slate-700 text-slate-300 hover:border-indigo-500 hover:bg-indigo-500/10";
                  let icon = null;

                  if (showAsCorrect) {
                    btnStyle = "bg-emerald-500/20 border-emerald-500 text-emerald-400 font-medium";
                    icon = <CheckCircle2 className="w-4 h-4 ml-auto" />;
                  } else if (showAsWrong) {
                    btnStyle = "bg-rose-500/20 border-rose-500 text-rose-400";
                    icon = <XCircle className="w-4 h-4 ml-auto" />;
                  } else if (isSelectedOption) {
                    btnStyle = "bg-indigo-500/20 border-indigo-500 text-indigo-300";
                  }

                  return (
                    <button
                      key={oi}
                      onClick={() => onAnswer(qi, oi)}
                      disabled={locked[qi] || revealedAll}
                      className={`w-full flex items-center gap-3 px-4 py-3 border rounded-xl text-left text-sm transition-all ${btnStyle} ${locked[qi] || revealedAll ? 'cursor-default opacity-90' : 'cursor-pointer'}`}
                    >
                      <span className="font-bold opacity-50 w-6">{String.fromCharCode(65 + oi)}.</span>
                      <span className="flex-1">{String(opt)}</span>
                      {icon}
                    </button>
                  );
                })}
              </div>

              {(locked[qi] || revealedAll) && (
                <div className="mt-5 pl-12">
                  <div className={`p-4 rounded-lg text-sm border ${isCorrectAnswered ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-200' : 'bg-rose-500/10 border-rose-500/20 text-rose-200'}`}>
                    <span className="font-bold mb-1 block">{t('quizAnswerLabel')}: {String.fromCharCode(65 + q.answer_index)}</span>
                     {/* Defensive string conversion for the answer text too */}
                    {String((Array.isArray(q.options) ? q.options : Object.values(q.options || {}))[q.answer_index] || t('quizDataNotFound'))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}