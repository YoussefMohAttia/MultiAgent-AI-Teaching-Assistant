import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ChevronDown } from 'lucide-react';
import { cn } from '../lib/utils';

export default function CustomSelect({ value, onChange, options = [], placeholder = '', disabled = false }) {
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
        type="button"
        disabled={disabled}
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
