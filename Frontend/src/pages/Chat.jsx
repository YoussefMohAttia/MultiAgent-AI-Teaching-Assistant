import { useState, useEffect, useRef, useCallback } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { getCourses, getDocuments } from '../services/api';
import { useAuth } from '../contexts/AuthContext';
import { Textarea } from '../components/ui/textarea';
import { cn } from '../lib/utils';
import MarkdownRenderer from '../components/MarkdownRenderer';
import { 
  ArrowUpIcon, Paperclip, BookOpen, Bot, 
  ChevronDown, Sparkles, X, FileText 
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
        className={cn("w-full flex items-center justify-between bg-black/40 backdrop-blur-md border border-white/10 text-xs rounded-xl px-4 py-3 text-slate-200 outline-none transition-all", disabled && "opacity-40 cursor-not-allowed", isOpen && "border-indigo-500/50 ring-1 ring-indigo-500/50")}
      >
        <span className="truncate">{selected ? selected.title : placeholder}</span>
        <ChevronDown className={cn("w-3.5 h-3.5 transition-transform duration-200", isOpen && "rotate-180 text-indigo-400")} />
      </button>
      <AnimatePresence>
        {isOpen && (
          <motion.div initial={{ opacity: 0, y: -5 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -5 }} className="absolute top-full left-0 w-full mt-2 bg-[#0f111a] border border-white/10 rounded-xl shadow-2xl z-50 max-h-48 overflow-y-auto py-1 custom-scrollbar">
            {options.map(opt => (
              <button key={opt.id} onClick={() => { onChange(opt.id); setIsOpen(false); }} className={cn("w-full text-left px-4 py-2.5 text-xs text-slate-300 hover:bg-indigo-500/20", String(value) === String(opt.id) && "text-indigo-400 bg-indigo-500/10")}>
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
  const [messages, setMessages] = useState([{ role: 'assistant', content: 'What are we learning today?' }]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const messagesEndRef = useRef(null);
  const [courses, setCourses] = useState([]);
  const [docs, setDocs] = useState([]);
  const [sourceMode, setSourceMode] = useState('general');
  const [courseId, setCourseId] = useState('');
  const [selectedDocId, setSelectedDocId] = useState('');
  const [uploadFile, setUploadFile] = useState(null);
  const fileInputRef = useRef(null);
  const { textareaRef, adjustHeight } = useAutoResizeTextarea({ minHeight: 52, maxHeight: 200 });

  useEffect(() => { getCourses().then(r => setCourses(r.data.courses || [])); }, []);
  useEffect(() => { if (courseId && sourceMode === 'document') getDocuments(courseId).then(r => setDocs(r.data.documents || [])); }, [courseId, sourceMode]);
  useEffect(() => { messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' }); }, [messages, isTyping]);

  const handleSendMessage = async () => {
    if (!input.trim() || isTyping) return;
    const userMsg = { role: 'user', content: input.trim() };
    setMessages(prev => [...prev, userMsg]);
    setInput(''); adjustHeight(true); setIsTyping(true);

    try {
      const payload = {
        question: userMsg.content,
        course_id: sourceMode === 'document' ? Number(courseId) : null,
      };
      const res = await axios.post('/api/ai/chat', payload, { headers: { Authorization: `Bearer ${user.token}` } });
      setMessages(prev => [...prev, { role: 'assistant', content: res.data.answer }]);
    } catch {
      setMessages(prev => [...prev, { role: 'assistant', content: "⚠️ Error connecting to chatbot. Please select a course if using Context Mode." }]);
    } finally { setIsTyping(false); }
  };

  return (
    <div className="relative flex flex-col h-[calc(100vh-6rem)] w-full max-w-5xl mx-auto rounded-3xl bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-slate-900 via-[#0a0a0a] to-black border border-white/5 shadow-2xl overflow-hidden">
      
      <header className="relative z-20 flex flex-col items-center justify-center pt-8 pb-4">
        <div className="p-2 bg-white/5 rounded-2xl border border-white/10 mb-3"><Sparkles className="w-5 h-5 text-indigo-400" /></div>
        <h1 className="text-xl font-medium text-white tracking-tight">How can I assist you?</h1>
      </header>

      {/* Increased pb-72 to prevent overlap */}
      <div className="flex-1 overflow-y-auto px-6 md:px-12 pb-72 space-y-8 scroll-smooth custom-scrollbar">
        <AnimatePresence>
          {messages.map((msg, idx) => (
            <motion.div key={idx} initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
              <div className={cn("px-5 py-4 text-sm rounded-3xl", msg.role === 'user' ? "bg-indigo-600 text-white rounded-tr-sm" : "bg-white/5 text-slate-200 border border-white/10 rounded-tl-sm")}>
                {msg.role === 'assistant' ? (
                  <MarkdownRenderer content={msg.content} className="max-w-none" />
                ) : (
                  msg.content
                )}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
        <div ref={messagesEndRef} />
      </div>

      <div className="absolute bottom-6 inset-x-0 px-4 md:px-12 z-30 flex justify-center">
        <div className="w-full max-w-3xl flex flex-col gap-3">
          <div className="flex gap-2">
            <button onClick={() => {setSourceMode('general'); setUploadFile(null);}} className={cn("px-4 py-1.5 rounded-full text-xs border transition-all", sourceMode === 'general' ? "bg-indigo-600 text-white" : "bg-black/40 text-slate-400")}>General Chat</button>
            <button onClick={() => {setSourceMode('document'); setUploadFile(null);}} className={cn("px-4 py-1.5 rounded-full text-xs border transition-all", sourceMode === 'document' ? "bg-indigo-600 text-white" : "bg-black/40 text-slate-400")}>Course Context</button>
          </div>

          {sourceMode === 'document' && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="flex flex-col sm:flex-row gap-2">
              <CustomSelect value={courseId} onChange={setCourseId} options={courses} placeholder="Select Course..." />
              <CustomSelect value={selectedDocId} onChange={setSelectedDocId} options={docs} placeholder="Select Document..." disabled={!courseId} />
            </motion.div>
          )}

          <div className="relative bg-black/60 backdrop-blur-2xl rounded-3xl border border-white/10 p-2 flex flex-col">
            {uploadFile && <div className="px-3 py-1 mb-2 bg-indigo-500/10 rounded-xl text-xs text-indigo-300 flex justify-between">{uploadFile.name} <X size={14} className="cursor-pointer" onClick={() => setUploadFile(null)} /></div>}
            <div className="flex items-center gap-2">
              <Paperclip size={20} className="text-slate-400 hover:text-white cursor-pointer ml-2" onClick={() => fileInputRef.current.click()} />
              <input type="file" ref={fileInputRef} className="hidden" accept="application/pdf" onChange={(e) => {setUploadFile(e.target.files[0]); setSourceMode('upload');}} />
              <Textarea ref={textareaRef} value={input} onChange={e => { setInput(e.target.value); adjustHeight(); }} onKeyDown={e => e.key === 'Enter' && !e.shiftKey && handleSendMessage()} placeholder="Ask a question..." className="bg-transparent border-none focus:ring-0 text-white flex-1 min-h-[48px]" />
              <button onClick={handleSendMessage} className="bg-white text-black p-2.5 rounded-full hover:scale-105 transition-all"><ArrowUpIcon size={18} /></button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}