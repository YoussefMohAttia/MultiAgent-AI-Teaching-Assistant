import { useEffect, useState, useMemo } from 'react';
import { getCourses, getDocuments, getDocumentBlob } from '../services/api';
import { useLanguage } from '../contexts/LanguageContext';
import { 
  BookOpen, FileText, Download, ChevronRight, 
  Search, FolderOpen, Inbox, AlertCircle, FileDigit, Eye, X
} from 'lucide-react';

export default function Courses() {
  const { t } = useLanguage();
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [error, setError] = useState('');
  
  // UX States
  const [coursesLoading, setCoursesLoading] = useState(true);
  const [docsLoading, setDocsLoading] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  
  // File Handling States
  const [previewUrl, setPreviewUrl] = useState(null);
  const [previewTitle, setPreviewTitle] = useState('');
  const [isProcessingFile, setIsProcessingFile] = useState(false);
  const resolvePreviewUrl = (url) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://drive.google.com/file/d/${fileMatch[1]}/preview`;
      }
      const idMatch = url.match(/[?&]id=([^&]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/file/d/${idMatch[1]}/preview`;
      }
    }
    return url;
  };

  const resolveDownloadUrl = (url) => {
    if (!url) return null;
    if (url.includes('drive.google.com')) {
      const fileMatch = url.match(/drive\.google\.com\/file\/d\/([^/]+)/);
      if (fileMatch && fileMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${fileMatch[1]}`;
      }
      const idMatch = url.match(/[?&]id=([^&]+)/);
      if (idMatch && idMatch[1]) {
        return `https://drive.google.com/uc?export=download&id=${idMatch[1]}`;
      }
    }
    return url;
  };


  useEffect(() => {
    setCoursesLoading(true);
    getCourses()
      .then((r) => setCourses(r.data.courses || []))
      .catch(() => setError(t('coursesLoadError')))
      .finally(() => setCoursesLoading(false));
  }, []);

  useEffect(() => {
    if (selected) {
      setDocsLoading(true);
      getDocuments(selected.id)
        .then((r) => setDocs(r.data.documents || []))
        .catch(() => setDocs([]))
        .finally(() => setDocsLoading(false));
    }
  }, [selected]);

  const filteredCourses = useMemo(() => {
    return courses.filter(c => 
      c.title.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [courses, searchQuery]);

  // ── Secure Download Handler ──
  const handleDownload = async (doc) => {
    try {
      setIsProcessingFile(true);
      if (doc.download_url && doc.download_url.startsWith('http')) {
        const resolvedUrl = resolveDownloadUrl(doc.download_url);
        const link = document.createElement('a');
        link.href = resolvedUrl || doc.download_url;
        link.setAttribute('download', doc.title || 'download');
        document.body.appendChild(link);
        link.click();
        link.remove();
        return;
      }
      const res = await getDocumentBlob(doc.id);
      
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      const link = document.createElement('a');
      link.href = blobUrl;
      
      // Force the .pdf extension if it's missing
      const filename = doc.title.toLowerCase().endsWith('.pdf') ? doc.title : `${doc.title}.pdf`;
      link.setAttribute('download', filename);
      
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl); 
    } catch (err) {
      console.error("Download failed", err);
      setError(t('downloadError'));
    } finally {
      setIsProcessingFile(false);
    }
  };

  // ── Secure Preview Handler ──
  const handlePreview = async (doc) => {
    try {
      setIsProcessingFile(true);
      if (doc.download_url && doc.download_url.startsWith('http')) {
        const resolvedUrl = resolvePreviewUrl(doc.download_url);
        if (resolvedUrl) {
          window.open(resolvedUrl, '_blank', 'noopener');
          return;
        }
      }
      const res = await getDocumentBlob(doc.id);
      
      const blobUrl = window.URL.createObjectURL(new Blob([res.data], { type: 'application/pdf' }));
      setPreviewUrl(blobUrl);
      setPreviewTitle(doc.title);
    } catch (err) {
      console.error("Preview failed", err);
      setError(t('previewError'));
    } finally {
      setIsProcessingFile(false);
    }
  };

  return (
    <>
      <div className="flex flex-col lg:flex-row gap-6 h-[calc(100vh-6rem)] animate-in fade-in duration-500">
        
        {/* ── Left Column: Master List ─────────────────────── */}
        <div className="w-full lg:w-1/3 flex flex-col gap-4 h-full">
          <div className="flex flex-col gap-4">
            <div className="flex items-center justify-between">
              <h2 className="text-2xl font-bold text-white flex items-center gap-2">
                <BookOpen className="w-6 h-6 text-indigo-400" />
                {t('myCourses')}
              </h2>
              <span className="bg-slate-800 text-slate-300 text-xs font-bold px-2.5 py-1 rounded-full border border-slate-700">
                {courses.length}
              </span>
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
              <input
                type="text"
                placeholder={t('searchCourses')}
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

          <div className="flex-1 overflow-y-auto pr-2 custom-scrollbar flex flex-col gap-2">
            {coursesLoading ? (
              [1, 2, 3, 4].map(i => <div key={i} className="h-16 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />)
            ) : filteredCourses.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-center px-4">
                <FolderOpen className="w-8 h-8 text-slate-600 mb-2" />
                <p className="text-slate-400 text-sm">{t('noCoursesMatch')}</p>
              </div>
            ) : (
              filteredCourses.map((c) => {
                const isSelected = selected?.id === c.id;
                return (
                  <button
                    key={c.id}
                    onClick={() => setSelected(c)}
                    className={`w-full text-left group flex items-center justify-between p-4 rounded-xl border transition-all duration-200 ${
                      isSelected ? 'bg-indigo-500/10 border-indigo-500/50 shadow-[0_0_15px_rgba(99,102,241,0.05)]' : 'bg-slate-800/50 border-slate-700 hover:border-slate-600 hover:bg-slate-800'
                    }`}
                  >
                    <div className="flex flex-col gap-1 pr-4">
                      <span className={`font-semibold line-clamp-1 ${isSelected ? 'text-indigo-400' : 'text-slate-200 group-hover:text-white'}`}>
                        {c.title}
                      </span>
                      <span className="text-xs text-slate-500 font-medium"></span>
                    </div>
                    <ChevronRight className={`w-5 h-5 flex-shrink-0 transition-transform duration-200 ${isSelected ? 'text-indigo-400 translate-x-1' : 'text-slate-600 group-hover:text-slate-400'}`} />
                  </button>
                );
              })
            )}
          </div>
        </div>

        {/* ── Right Column: Detail View ──────────────────────── */}
        <div className="w-full lg:w-2/3 flex flex-col bg-slate-900 border border-slate-800 rounded-2xl shadow-xl overflow-hidden h-full">
          {!selected ? (
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
              <div className="w-20 h-20 bg-slate-800 rounded-full flex items-center justify-center mb-6 shadow-inner border border-slate-700">
                <FileDigit className="w-10 h-10 text-slate-500" />
              </div>
              <h3 className="text-xl font-bold text-white mb-2">{t('noCourseSelected')}</h3>
              <p className="text-slate-400 max-w-sm">
                {t('noCourseSelectedBody')}
              </p>
            </div>
          ) : (
            <div className="flex flex-col h-full">
              <div className="p-6 border-b border-slate-800 bg-slate-900/50">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-bold text-white mb-1">{selected.title}</h2>
                    <p className="text-sm text-slate-400 flex items-center gap-2">
                      <FolderOpen className="w-4 h-4" /> {t('courseMaterials')}
                    </p>
                  </div>
                  <div className="bg-indigo-500/10 text-indigo-400 text-xs font-bold px-3 py-1.5 rounded-lg border border-indigo-500/20 whitespace-nowrap">
                    {docs.length} {t('files')}
                  </div>
                </div>
              </div>

              <div className="flex-1 overflow-y-auto p-6 custom-scrollbar bg-slate-50 dark:bg-slate-950/30">
                {docsLoading ? (
                  <div className="flex flex-col gap-3">
                     {[1, 2, 3].map(i => <div key={i} className="h-20 bg-slate-800/50 rounded-xl animate-pulse border border-slate-700/50" />)}
                  </div>
                ) : docs.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-full text-center">
                    <div className="w-16 h-16 bg-slate-800/50 rounded-full flex items-center justify-center mb-4">
                      <Inbox className="w-8 h-8 text-slate-500" />
                    </div>
                    <h4 className="text-lg font-semibold text-slate-300 mb-1">{t('folderEmpty')}</h4>
                    <p className="text-sm text-slate-500 max-w-xs">{t('folderEmptyBody')}</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-3">
                    {docs.map((d) => {
                      const isAnnouncement = d.doc_type === 'announcement';
                      const isPost = d.doc_type === 'post';
                      const hasFile = Boolean(d.download_url);
                      const canFileActions = hasFile && !isAnnouncement && !isPost;
                      const typeLabel = isAnnouncement
                        ? t('docTypeAnnouncement')
                        : isPost
                          ? t('docTypePost')
                          : d.doc_type === 'coursework'
                            ? t('docTypeCoursework')
                            : d.doc_type === 'manual_upload'
                              ? t('docTypeUpload')
                              : d.doc_type === 'material'
                                ? t('docTypeMaterial')
                                : t('docTypeDocument');
                      const bodyText = (d.raw_text || '').trim();

                      return (
                        <div key={d.id} className="group flex flex-col sm:flex-row sm:items-center justify-between p-4 bg-white dark:bg-slate-800/40 border border-slate-200 dark:border-slate-700/50 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 hover:border-slate-300 dark:hover:border-slate-600 transition-all gap-4">
                          <div className="flex items-start gap-4 overflow-hidden">
                            <div className={`w-10 h-10 rounded-lg flex items-center justify-center flex-shrink-0 border ${canFileActions ? 'bg-indigo-100 dark:bg-indigo-500/10 border-indigo-200 dark:border-indigo-500/20 text-indigo-600 dark:text-indigo-400' : 'bg-slate-100 dark:bg-slate-800 border-slate-200 dark:border-slate-700 text-slate-500 dark:text-slate-400'}`}>
                              {canFileActions ? <FileText className="w-5 h-5" /> : <Inbox className="w-5 h-5" />}
                            </div>
                            <div className="flex flex-col min-w-0">
                              <span className="text-[11px] uppercase tracking-wide text-slate-500 dark:text-slate-500">{typeLabel}</span>
                              {canFileActions ? (
                                <>
                                  <span className="font-semibold text-slate-900 dark:text-slate-200 group-hover:text-slate-900 dark:group-hover:text-white truncate" title={d.title}>{d.title}</span>
                                  <span className="text-xs text-slate-600 dark:text-slate-500 mt-0.5">PDF Document</span>
                                </>
                              ) : (
                                <span className="text-sm text-slate-700 dark:text-slate-300 mt-1 whitespace-pre-wrap break-words">
                                  {bodyText || t('docNoContent')}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Interactive Buttons */}
                          {canFileActions ? (
                            <div className="flex gap-2 w-full sm:w-auto">
                              <button
                                onClick={() => handlePreview(d)}
                                disabled={isProcessingFile}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-white dark:bg-slate-800 hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-700 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white text-sm font-medium rounded-lg transition-colors border border-slate-300 dark:border-slate-700"
                              >
                                <Eye className="w-4 h-4" /> Preview
                              </button>
                              <button
                                onClick={() => handleDownload(d)}
                                disabled={isProcessingFile}
                                className="flex-1 sm:flex-none flex items-center justify-center gap-2 px-3 py-2 bg-indigo-600 hover:bg-indigo-500 text-white text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                              >
                                <Download className="w-4 h-4" /> Download
                              </button>
                            </div>
                          ) : null}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── PDF Preview Modal Overlay ── */}
      {previewUrl && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-950/90 backdrop-blur-sm p-4 md:p-8 animate-in fade-in duration-200">
          <div className="flex items-center justify-between mb-4 max-w-5xl mx-auto w-full">
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Eye className="w-5 h-5 text-indigo-400" />
              {previewTitle}
            </h3>
            <button 
              onClick={() => {
                window.URL.revokeObjectURL(previewUrl);
                setPreviewUrl(null);
              }}
              className="p-2 bg-slate-800 hover:bg-rose-500/20 text-slate-400 hover:text-rose-400 rounded-lg transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>
          
          <div className="flex-1 w-full max-w-5xl mx-auto bg-slate-900 border border-slate-700 rounded-xl overflow-hidden shadow-2xl">
            <iframe 
              src={`${previewUrl}#toolbar=0`} 
              className="w-full h-full border-none"
              title="PDF Preview"
            />
          </div>
        </div>
      )}
    </>
  );
}