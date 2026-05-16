import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { getCourses, getDocuments, synthesizeSpeech, transcribeAudio } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { streamChatResponse, typeOutText } from '../services/streaming';
import { 
  ArrowUpIcon, Paperclip, 
  ChevronDown, Sparkles, X, Mic, MicOff, Volume2, Loader2
} from 'lucide-react';

// ── Auto-Resize Hook ──
function useAutoResizeTextarea({ minHeight, maxHeight }) {
  const textareaRef = useRef(null);
  const adjustHeight = useCallback((reset) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    if (reset) { textarea.style.height = `${minHeight}px`; return; }
    textarea.style.height = `${minHeight}px`;
    const newHeight = Math.max(minHeight, Math.min(textarea.scrollHeight, maxHeight ?? Infinity));
    textarea.style.height = `${newHeight}px`;
  }, [minHeight, maxHeight]);
  return { textareaRef, adjustHeight };
}

// ── Custom Animated Select Dropdown ──
function CustomSelect({ value, onChange, options, placeholder, disabled }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);
  useEffect(() => {
    const handleOutsideClick = (e) => { if (containerRef.current && !containerRef.current.contains(e.target)) setIsOpen(false); };
    document.addEventListener('mousedown', handleOutsideClick);
    return () => document.removeEventListener('mousedown', handleOutsideClick);
  }, []);
  const selected = options.find(o => String(o.id) === String(value));
  return (
    <div className="relative flex-1" ref={containerRef}>
      <button
        type="button" disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full flex items-center justify-between bg-white/70 dark:bg-black/40 backdrop-blur-md border border-slate-200 dark:border-white/10 text-xs rounded-xl px-4 py-3 text-slate-700 dark:text-slate-200 outline-none transition-all",
          disabled && "opacity-40 cursor-not-allowed",
          isOpen && "border-indigo-500/50 ring-1 ring-indigo-500/50"
        )}
      >
        <span className="truncate">{selected ? selected.title : placeholder}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180 text-indigo-500", !isOpen && "text-slate-500")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -5 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -5 }}
            className="absolute top-full left-0 w-full mt-2 bg-white dark:bg-[#0f111a] border border-slate-200 dark:border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto py-1 custom-scrollbar"
          >
            {options.map(opt => (
              <button
                key={opt.id}
                onClick={() => { onChange(opt.id); setIsOpen(false); }}
                className={cn(
                  "w-full text-left px-4 py-2.5 text-xs text-slate-700 dark:text-slate-300 hover:bg-indigo-50 dark:hover:bg-indigo-500/20",
                  String(value) === String(opt.id) && "text-indigo-600 dark:text-indigo-400 bg-indigo-50 dark:bg-indigo-500/10"
                )}
              >
                {opt.title}
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function Chat() {
  const { user } = useAuth();
  const { t, lang } = useLanguage();
  const [messages, setMessages] = useState([
    { id: 'seed-assistant', role: 'assistant', content: t('chatSeed') },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const streamBufferRef = useRef('');
  const streamRafRef = useRef(null);
  const activeAssistantIdRef = useRef(null);
  const [courses, setCourses] = useState([]);
  const [docs, setDocs] = useState([]);
  const [sourceMode, setSourceMode] = useState('general');
  const [courseId, setCourseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 200 });
  const [isRecording, setIsRecording] = useState(false);
  const [isTranscribing, setIsTranscribing] = useState(false);
  const [micError, setMicError] = useState('');
  const [ttsError, setTtsError] = useState('');
  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const activeAudioRef = useRef(null);
  const speechRecognitionRef = useRef(null);
  const speechResultRef = useRef(false);
  const speechErrorRef = useRef(false);
  const speechTimeoutRef = useRef(null);

  useEffect(() => { getCourses().then(r => setCourses(r.data.courses || [])); }, []);
  useEffect(() => {
    if (sourceMode !== 'document') {
      setDocs([]);
      setSelectedDocId('');
      return;
    }
    setSelectedDocId('');
    if (courseId) {
      getDocuments(courseId)
        .then((r) => {
          const list = r.data.documents || [];
          setDocs(list);
          if (list.length) setSelectedDocId(String(list[0].id));
        })
        .catch(() => setDocs([]));
    } else {
      setDocs([]);
    }
  }, [courseId, sourceMode]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);
  useEffect(() => {
    setMessages((prev) => {
      if (!prev.length) return prev;
      const first = prev[0];
      if (first.id !== 'seed-assistant' || first.role !== 'assistant') return prev;
      if (prev.length > 1) return prev;
      return [{ ...first, content: t('chatSeed') }];
    });
  }, [lang, t]);

  const flushStreamBuffer = useCallback(() => {
    const chunk = streamBufferRef.current;
    const activeAssistantId = activeAssistantIdRef.current;
    streamRafRef.current = null;

    if (!chunk || !activeAssistantId) return;

    streamBufferRef.current = '';
    setMessages((prev) => prev.map((m) => (
      m.id === activeAssistantId ? { ...m, content: `${m.content || ''}${chunk}` } : m
    )));
  }, []);

  const queueChunk = useCallback((chunk) => {
    if (!chunk) return;
    streamBufferRef.current += chunk;
    if (!streamRafRef.current) {
      streamRafRef.current = requestAnimationFrame(flushStreamBuffer);
    }
  }, [flushStreamBuffer]);

  const flushNow = useCallback(() => {
    if (streamRafRef.current) {
      cancelAnimationFrame(streamRafRef.current);
      streamRafRef.current = null;
    }
    flushStreamBuffer();
  }, [flushStreamBuffer]);

  useEffect(() => () => {
    if (streamRafRef.current) {
      cancelAnimationFrame(streamRafRef.current);
    }
  }, []);

  useEffect(() => () => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    if (speechRecognitionRef.current) {
      speechRecognitionRef.current.stop();
      speechRecognitionRef.current = null;
    }
    if (speechTimeoutRef.current) {
      clearTimeout(speechTimeoutRef.current);
      speechTimeoutRef.current = null;
    }
    if (activeAudioRef.current) {
      activeAudioRef.current.pause();
      activeAudioRef.current = null;
    }
  }, []);

  const stopActiveAudio = useCallback(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }
    if (!activeAudioRef.current) return;
    const previous = activeAudioRef.current;
    previous.pause();
    if (previous.src && previous.src.startsWith('blob:')) {
      URL.revokeObjectURL(previous.src);
    }
    activeAudioRef.current = null;
  }, []);

  const trySpeakWithBrowser = useCallback((text) => {
    if (!text) return false;
    if (typeof window === 'undefined' || !window.speechSynthesis) return false;
    if (typeof SpeechSynthesisUtterance === 'undefined') return false;

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  const handleSpeakMessage = useCallback(async (message) => {
    const spokenText = cleanAssistantText(message?.content);
    if (!spokenText) return;
    setTtsError('');
    stopActiveAudio();

    try {
      const response = await synthesizeSpeech(spokenText);
      const audioBlob = response?.data instanceof Blob
        ? response.data
        : new Blob([response.data], { type: response?.headers?.['content-type'] || 'audio/mpeg' });
      const audioUrl = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioUrl);

      activeAudioRef.current = audio;
      audio.onended = () => {
        if (activeAudioRef.current === audio) {
          if (audio.src && audio.src.startsWith('blob:')) {
            URL.revokeObjectURL(audio.src);
          }
          activeAudioRef.current = null;
        }
      };
      audio.onerror = () => {
        if (audio.src && audio.src.startsWith('blob:')) {
          URL.revokeObjectURL(audio.src);
        }
        if (activeAudioRef.current === audio) {
          activeAudioRef.current = null;
        }
        setTtsError(t('chatTtsError'));
      };

      await audio.play();
      return;
    } catch {
      const fallbackWorked = trySpeakWithBrowser(spokenText);
      if (!fallbackWorked) {
        setTtsError(t('chatTtsError'));
      }
    }
  }, [stopActiveAudio, t, trySpeakWithBrowser]);

  const handleStartRecording = useCallback(async () => {
    setMicError('');
    const BrowserSpeechRecognition =
      typeof window !== 'undefined' &&
      (window.SpeechRecognition || window.webkitSpeechRecognition);

    if (BrowserSpeechRecognition) {
      try {
        const recognition = new BrowserSpeechRecognition();
        recognition.continuous = false;
        recognition.interimResults = false;
        recognition.maxAlternatives = 1;
        const browserLang = typeof navigator !== 'undefined' ? navigator.language : undefined;
        if (lang === 'en') {
          recognition.lang = 'en-US';
        } else if (browserLang) {
          recognition.lang = browserLang;
        }

        speechResultRef.current = false;
        speechErrorRef.current = false;
        if (speechTimeoutRef.current) {
          clearTimeout(speechTimeoutRef.current);
        }
        speechTimeoutRef.current = setTimeout(() => {
          if (!speechResultRef.current && speechRecognitionRef.current) {
            speechErrorRef.current = true;
            setMicError(t('chatMicEmpty'));
            speechRecognitionRef.current.stop();
          }
        }, 12000);

        recognition.onresult = (event) => {
          const result = event.results?.[0]?.[0]?.transcript?.trim();
          if (result) {
            speechResultRef.current = true;
            setInput((prev) => (prev ? `${prev} ${result}` : result));
            adjustHeight();
            setIsTranscribing(false);
          } else {
            setMicError(t('chatMicEmpty'));
          }
        };

        recognition.onerror = () => {
          speechErrorRef.current = true;
          setMicError(t('chatMicError'));
          setIsTranscribing(false);
        };

        recognition.onend = () => {
          if (speechTimeoutRef.current) {
            clearTimeout(speechTimeoutRef.current);
            speechTimeoutRef.current = null;
          }
          if (!speechResultRef.current && !speechErrorRef.current) {
            setMicError(t('chatMicEmpty'));
          }
          setIsRecording(false);
          setIsTranscribing(false);
          speechRecognitionRef.current = null;
        };

        speechRecognitionRef.current = recognition;
        setIsRecording(true);
        setIsTranscribing(true);
        recognition.start();
        return;
      } catch {
        setMicError(t('chatMicError'));
        return;
      }
    }

    if (!navigator.mediaDevices?.getUserMedia || typeof MediaRecorder === 'undefined') {
      setMicError(t('chatMicUnsupported'));
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      audioChunksRef.current = [];

      recorder.ondataavailable = (event) => {
        if (event.data?.size) {
          audioChunksRef.current.push(event.data);
        }
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((track) => track.stop());
        const blob = new Blob(audioChunksRef.current, { type: recorder.mimeType || 'audio/webm' });
        if (!blob.size) {
          setMicError(t('chatMicEmpty'));
          return;
        }

        setIsTranscribing(true);
        try {
          const file = new File([blob], 'speech.webm', { type: blob.type || 'audio/webm' });
          const result = await transcribeAudio(file);
          const transcript = result?.data?.text?.trim();
          if (transcript) {
            setInput((prev) => (prev ? `${prev} ${transcript}` : transcript));
            adjustHeight();
          } else {
            setMicError(t('chatMicEmpty'));
          }
        } catch {
          setMicError(t('chatMicError'));
        } finally {
          setIsTranscribing(false);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setMicError(t('chatMicError'));
    }
  }, [adjustHeight, lang, t]);

  const handleStopRecording = useCallback(() => {
    if (speechRecognitionRef.current) {
      if (speechTimeoutRef.current) {
        clearTimeout(speechTimeoutRef.current);
        speechTimeoutRef.current = null;
      }
      speechRecognitionRef.current.stop();
      return;
    }
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }, []);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    if (sourceMode === 'upload' && !uploadFile) return;
    const userMsg = { id: `u-${Date.now()}`, role: 'user', content: input.trim() };
    const assistantId = `a-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
    activeAssistantIdRef.current = assistantId;

    setMessages(prev => [...prev, userMsg, { id: assistantId, role: 'assistant', content: '' }]);
    setInput(''); adjustHeight(true); setIsTyping(true);

    try {
      if (sourceMode === 'upload' && uploadFile) {
        const formData = new FormData();
        formData.append('file', uploadFile);
        formData.append('message', userMsg.content);

        const uploadConfig = user?.token
          ? { headers: { Authorization: `Bearer ${user.token}` } }
          : undefined;

        const response = await axios.post(
          '/api/ai/chat-upload',
          formData,
          {
            ...uploadConfig,
            headers: {
              ...uploadConfig?.headers,
              'Content-Type': 'multipart/form-data',
            },
          }
        );

        const uploadAnswer = response.data?.answer || response.data?.reply || '';
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, content: uploadAnswer || t('chatError') } : m
        )));
        setUploadFile(null);
        return;
      }

      const payload = {
        question: userMsg.content,
        course_id: sourceMode === 'document' ? Number(courseId || 0) : 0,
        conversation_id: sourceMode === 'document'
          ? `course:${courseId || '0'}:doc:${selectedDocId || 'all'}:user:${user?.id || 'anon'}`
          : `general:user:${user?.id || 'anon'}`,
        ...(sourceMode === 'document' && selectedDocId
          ? { document_id: Number(selectedDocId) }
          : {}),
      };

      let streamedFinal = '';
      let receivedAnyToken = false;

      try {
        const streamResult = await streamChatResponse({
          payload,
          token: user?.token,
          onToken: (tokenChunk) => queueChunk(tokenChunk),
          onDone: (answer) => {
            streamedFinal = answer || '';
          },
        });
        receivedAnyToken = streamResult.receivedAnyToken;
        if (!streamedFinal && streamResult.finalAnswer) {
          streamedFinal = streamResult.finalAnswer;
        }
      } catch {
        receivedAnyToken = false;
      }

      flushNow();

      if (receivedAnyToken) {
        if (streamedFinal) {
          setMessages((prev) => prev.map((m) => (
            m.id === assistantId ? { ...m, content: streamedFinal } : m
          )));
        }
      } else {
        const fallbackConfig = user?.token
          ? { headers: { Authorization: `Bearer ${user.token}` } }
          : undefined;
        const fallbackAnswer = streamedFinal || (
          await axios.post('/api/ai/chat', payload, fallbackConfig)
        ).data.answer;

        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, content: '' } : m
        )));

        await typeOutText(fallbackAnswer, (char) => queueChunk(char));
        flushNow();
        setMessages((prev) => prev.map((m) => (
          m.id === assistantId ? { ...m, content: fallbackAnswer } : m
        )));
      }
    } catch {
      setMessages((prev) => prev.map((m) => (
        m.id === assistantId
          ? { ...m, content: t('chatError') }
          : m
      )));
    } finally {
      activeAssistantIdRef.current = null;
      setIsTyping(false);
    }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-6rem)] w-full max-w-5xl mx-auto rounded-3xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black border border-white/5 shadow-2xl overflow-hidden">
      
      <header className="relative z-20 flex flex-col items-center justify-center pt-8 pb-4">
        <div className="p-2 bg-white/5 rounded-2xl border border-white/10 mb-3"><Sparkles className="w-5 h-5 text-indigo-400" /></div>
        <h1 className="text-xl font-medium text-white tracking-tight">{t('chatHeader')}</h1>
      </header>

      <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-6 space-y-8 scroll-smooth custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div key={msg.id || idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={cn("px-5 py-4 text-sm rounded-3xl", msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white/5 text-slate-200 border border-white/10 rounded-tl-sm")}>
                {msg.role === 'assistant' ? (
                  <div className="flex items-start gap-3">
                    <MarkdownRenderer content={cleanAssistantText(msg.content)} className="max-w-none" />
                    {msg.content && (
                      <button
                        type="button"
                        onClick={() => handleSpeakMessage(msg)}
                        className="mt-0.5 inline-flex items-center justify-center h-8 w-8 rounded-full border border-white/10 text-slate-300 hover:text-white hover:bg-white/10 transition"
                        title={t('chatSpeak')}
                      >
                        <Volume2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="px-4 md:px-12 pb-6 pt-4 border-t border-slate-200 dark:border-white/5 bg-white/70 dark:bg-black/40 backdrop-blur-2xl">
        <div className="w-full max-w-3xl mx-auto flex flex-col gap-3">
          <div className="flex gap-2">
            <button
              onClick={() => {setSourceMode('general'); setUploadFile(null);}}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs border transition-all",
                sourceMode === 'general'
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-black/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
              )}
            >
              {t('chatGeneral')}
            </button>
            <button
              onClick={() => {setSourceMode('document'); setUploadFile(null);}}
              className={cn(
                "px-4 py-1.5 rounded-full text-xs border transition-all",
                sourceMode === 'document'
                  ? "bg-indigo-600 text-white"
                  : "bg-white dark:bg-black/40 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-white/10"
              )}
            >
              {t('chatCourseContext')}
            </button>
          </div>

          {sourceMode === 'document' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col sm:flex-row gap-2">
              <CustomSelect value={courseId} onChange={setCourseId} options={courses} placeholder={t('chatSelectCourse')} />
              <CustomSelect value={selectedDocId} onChange={setSelectedDocId} options={docs} placeholder={t('chatSelectDocument')} disabled={!courseId} />
            </motion.div>
          )}

          <div className="relative bg-white/80 dark:bg-black/60 rounded-3xl border border-slate-200 dark:border-white/10 p-2 flex flex-col">
            {uploadFile && <div className="px-3 py-1 mb-2 bg-indigo-500/10 rounded-xl text-xs text-indigo-300 flex justify-between">{uploadFile.name} <X size={14} className="cursor-pointer" onClick={() => setUploadFile(null)} /></div>}
            <div className="flex items-center gap-2">
              <Paperclip size={20} className="text-slate-400 hover:text-white cursor-pointer ml-2" onClick={() => fileInputRef.current.click()} />
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={(e) => {setUploadFile(e.target.files[0]); setSourceMode('upload');}} />
              <button
                type="button"
                onClick={isRecording ? handleStopRecording : handleStartRecording}
                className={cn(
                  "ml-1 inline-flex items-center justify-center h-9 w-9 rounded-full border border-white/10 transition",
                  isRecording ? "bg-rose-500/20 text-rose-300" : "text-slate-300 hover:text-white hover:bg-white/10"
                )}
                title={isRecording ? t('chatMicStop') : t('chatMicStart')}
              >
                {isRecording ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
              </button>
              <Textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); adjustHeight(); }} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} placeholder={t('chatAskPlaceholder')} className="bg-transparent border-none focus:ring-0 text-white flex-1 min-h-[48px]" />
              <button onClick={handleSendMessage} className="bg-white text-black p-2.5 rounded-full hover:scale-105 transition-all"><ArrowUpIcon size={18} /></button>
            </div>
            {(micError || isTranscribing || ttsError) && (
              <div className="mt-2 flex flex-wrap items-center gap-3 text-xs text-slate-300">
                {isTranscribing && (
                  <span className="inline-flex items-center gap-2 text-indigo-300">
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    {t('chatTranscribing')}
                  </span>
                )}
                {micError && <span className="text-rose-300">{micError}</span>}
                {ttsError && <span className="text-rose-300">{ttsError}</span>}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function cleanAssistantText(text) {
  if (!text) return '';
  let cleaned = String(text);
  // Remove XML-style thought/think tags
  cleaned = cleaned.replace(/<thought>[\s\S]*?<\/thought>/gi, '');
  cleaned = cleaned.replace(/<thought>[\s\S]*$/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*?<\/think>/gi, '');
  cleaned = cleaned.replace(/<think>[\s\S]*$/gi, '');
  // Remove code fence thinking blocks
  cleaned = cleaned.replace(/```(?:thought|think|thinking|thoughts?)[\s\S]*?```/gi, '');
  cleaned = cleaned.replace(/```(?:thought|think|thinking|thoughts?)[\s\S]*$/gi, '');
  // Remove [thinking] tags
  cleaned = cleaned.replace(/\[thought\][\s\S]*?\[\/thought\]/gi, '');
  cleaned = cleaned.replace(/\[THOUGHT\][\s\S]*?\[\/THOUGHT\]/gi, '');
  cleaned = cleaned.replace(/\[thinking\][\s\S]*?\[\/thinking\]/gi, '');
  cleaned = cleaned.replace(/\[THINKING\][\s\S]*?\[\/THINKING\]/gi, '');
  // Remove lines that start with "Thinking:" or similar
  cleaned = cleaned.split('\n').filter(line => !line.match(/^(thinking|thought|reasoning|analysis):/i)).join('\n');
  return cleaned.trim();
}