import { useEffect, useState, useMemo } from 'react';
import { getCourses, getDocuments } from '../services/api';
import { 
  BookOpen, FileText, Download, ChevronRight, 
  Search, FolderOpen, Inbox, AlertCircle, FileDigit
} from 'lucide-react';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  
  // UX Additions
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // 1. Load Courses
  useEffect(() => {
    setCoursesLoading(true);
    getCourses()
      .then((r) => setCourses(r.data.courses || []))
      .catch(() => setError('Failed to load courses. Please try again.'))
      .finally(() => setCoursesLoading(false));
  }, []);

  // 2. Load Documents when a course is selected
  useEffect(() => {
    if (selected) {
      setDocsLoading(true);
      getDocuments(selected.id)
        .then((r) => setDocs(r.data.documents || []))
        .catch(() => setDocs([]))
        .finally(() => setDocsLoading(false));
    }
  }, [selected]);

  // Client-side search filtering
  const filteredCourses = useMemo(() => {
    return courses.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [courses, searchQuery]);

  return (
    <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] animate-in fade-in duration-500">
      
      {/* ── Left Column: Master List (1/3 width) ─────────────────────── */}
      <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">
        
        {/* Header & Search */}
        <div className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-bold text-white flex items-center gap-2">
              <BookOpen className="w-6 h-6 text-indigo-400" />
              My Courses
            </h2>
            <span className="bg-slate-800 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-700">
              {courses.length}
            </span>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
            <input
              type="text"
              placeholder="Search courses..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-slate-900 border border-slate-700 text-white text-sm rounded-lg pl-10 pr-4 py-2.5 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 transition-all placeholder:text-slate-500"
            />
          </div>
        </div>

        {error && (
          <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-lg text-sm flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            {error}
          </div>
        )}

        {/* Course List Scrollable Area */}
        <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
          {coursesLoading ? (
            // Skeleton Loaders
            [1, 2, 3, 4].map(i => (
              <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
            ))
          ) : filteredCourses.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-40 text-center px-4">
              <FolderOpen className="w-8 h-8 text-slate-600 mb-2" />
              <p className="text-slate-400 text-sm">No courses found matching your search.</p>
            </div>
          ) : (
            filteredCourses.map((c) => {
              const isSelected = selected?.id === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => setSelected(c)}
                  className={`w-full text-left group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                    isSelected 
                      ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.05)]' 
                      : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                  }`}
                >
                  <div className="flex flex-col gap-1 pr-4">
                    <span className={`font-semibold line-clamp-1 ${isSelected ? 'text-indigo-400' : 'text-slate-200 group-hover:text-white'}`}>
                      {c.title}
                    </span>
                    
                  </div>
                  <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600 group-hover:text-slate-400'}`} />
                </button>
              );
            })
          )}
        </div>
      </div>

      {/* ── Right Column: Detail View (2/3 width) ──────────────────────── */}
      <div className="w-full lg:w-2/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden h-full">
        
        {!selected ? (
          // Empty State: No Course Selected
          <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
            <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
              <FileDigit className="w-10 h-10 text-slate-500" />
            </div>
            <h3 className="text-xl font-bold text-white mb-2">No Course Selected</h3>
            <p className="text-slate-400 max-w-sm">
              Select a course from the sidebar to view its official documents, assignments, and lecture materials.
            </p>
          </div>
        ) : (
          // Content State: Course Selected
          <div className="flex flex-col h-full">
            
            {/* Header */}
            <div className="p-6 border-b border-slate-800 bg-slate-900/50">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-bold text-white mb-1">{selected.title}</h2>
                  <p className="text-sm text-slate-400 flex items-center gap-2">
                    <FolderOpen className="w-4 h-4" />
                    Course Materials
                  </p>
                </div>
                <div className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 whitespace-nowrap">
                  {docs.length} Files
                </div>
              </div>
            </div>

            {/* Document List */}
            <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-950/30">
              {docsLoading ? (
                <div className="flex flex-col gap-3">
                   {[1, 2, 3].map(i => (
                    <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />
                  ))}
                </div>
              ) : docs.length === 0 ? (
                <div className="flex flex-col items-center justify-center h-full text-center">
                  <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                    <Inbox className="w-8 h-8 text-slate-500" />
                  </div>
                  <h4 className="text-lg font-semibold text-slate-300 mb-1">Folder is Empty</h4>
                  <p className="text-sm text-slate-500 max-w-xs">
                    No documents have been synced from Google Classroom for this course yet.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-3">
                  {docs.map((d) => (
                    <div
                      key={d.id}
                      className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-slate-800/40 border border-slate-700/50 rounded-xl hover:bg-slate-800 hover:border-slate-600 transition-all gap-4"
                    >
                      <div className="flex items-start gap-4 overflow-hidden">
                        <div className="w-10 h-10 rounded-lg bg-indigo-500/10 flex items-center justify-center flex-shrink-0 border border-indigo-500/20 text-indigo-400">
                          <FileText className="w-5 h-5" />
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="font-semibold text-slate-200 group-hover:text-white truncate" title={d.title}>
                            {d.title}
                          </span>
                          {/* Removed the Document ID */}
                          <span className="text-xs text-slate-500 mt-0.5">
                            PDF Document
                          </span>
                        </div>
                      </div>
                      
                      <a
                        href={`/api/documents/download/${d.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center gap-2 px-4 py-2 bg-slate-700/50 hover:bg-indigo-600 text-slate-300 hover:text-white text-sm font-medium rounded-lg transition-colors border border-slate-600 hover:border-indigo-500 sm:w-auto w-full"
                      >
                        <Download className="w-4 h-4" />
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}