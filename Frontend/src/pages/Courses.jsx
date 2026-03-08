import { useEffect, useState } from 'react';
import {
  getCourses, createCourse, deleteCourse,
  getDocuments, uploadDocument,
} from '../services/api';
import '../components/Shared.css';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [newTitle, setNewTitle] = useState('');
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');

  const load = () =>
    getCourses().then((r) => setCourses(r.data.courses || [])).catch(() => {});

  useEffect(() => { load(); }, []);

  useEffect(() => {
    if (selected) {
      getDocuments(selected.id)
        .then((r) => setDocs(r.data.documents || []))
        .catch(() => setDocs([]));
    }
  }, [selected]);

  const handleCreate = async () => {
    if (!newTitle.trim()) return;
    try {
      await createCourse(newTitle.trim());
      setNewTitle('');
      load();
    } catch (e) {
      setError(e.response?.data?.detail || 'Failed to create course');
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Delete this course?')) return;
    await deleteCourse(id);
    if (selected?.id === id) setSelected(null);
    load();
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file || !selected) return;
    setUploading(true);
    try {
      await uploadDocument(selected.id, file);
      const r = await getDocuments(selected.id);
      setDocs(r.data.documents || []);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed');
    }
    setUploading(false);
  };

  return (
    <div className="grid-2">
      {/* ── Left: course list ─────────────────────── */}
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="icon">📚</span>
            <h2>Courses</h2>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
            <input
              className="form-input"
              placeholder="New course title…"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <button className="btn btn-primary" onClick={handleCreate}>Add</button>
          </div>

          {courses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No courses yet.</p>
          ) : (
            <ul style={{ listStyle: 'none' }}>
              {courses.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selected?.id === c.id ? 'var(--bg-card-hover)' : 'transparent',
                    marginBottom: 4,
                    transition: 'background .2s',
                  }}
                  onClick={() => setSelected(c)}
                >
                  <span>📘 {c.title}</span>
                  <button
                    className="btn btn-danger btn-sm"
                    onClick={(e) => { e.stopPropagation(); handleDelete(c.id); }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Right: documents ──────────────────────── */}
      <div>
        <div className="card">
          <div className="card-header">
            <span className="icon">📄</span>
            <h2>{selected ? `Documents — ${selected.title}` : 'Select a course'}</h2>
          </div>

          {selected ? (
            <>
              <div style={{ marginBottom: 16 }}>
                <label
                  className="btn btn-secondary"
                  style={{ position: 'relative', overflow: 'hidden' }}
                >
                  {uploading ? (
                    <><span className="spinner" /> Uploading…</>
                  ) : (
                    '📤 Upload PDF'
                  )}
                  <input
                    type="file"
                    accept=".pdf"
                    onChange={handleUpload}
                    disabled={uploading}
                    style={{ position: 'absolute', opacity: 0, width: 0 }}
                  />
                </label>
              </div>

              {docs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No documents uploaded yet.
                </p>
              ) : (
                <ul style={{ listStyle: 'none' }}>
                  {docs.map((d) => (
                    <li
                      key={d.id}
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        padding: '10px 12px',
                        borderBottom: '1px solid var(--border)',
                        fontSize: '0.88rem',
                      }}
                    >
                      <span>📎 {d.title}</span>
                      <a
                        href={`/api/documents/download/${d.id}`}
                        target="_blank"
                        rel="noopener"
                        className="btn btn-secondary btn-sm"
                      >
                        ⬇ Download
                      </a>
                    </li>
                  ))}
                </ul>
              )}
            </>
          ) : (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
              ← Click a course to view its documents
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
