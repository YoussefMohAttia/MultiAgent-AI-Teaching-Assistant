import { useEffect, useState } from 'react';
import { getCourses, getDocuments } from '../services/api';
import '../components/Shared.css';

export default function Courses() {
  const [courses, setCourses] = useState([]);
  const [selected, setSelected] = useState(null);
  const [docs, setDocs] = useState([]);
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

  return (
    <div className="grid-2">
      {/* ── Left: Course List (Read-Only) ─────────────────────── */}
      <div>
        <div className="card" style={{ marginBottom: 16 }}>
          <div className="card-header">
            <span className="icon">📚</span>
            <h2>Courses</h2>
          </div>

          {error && <div className="alert alert-error">{error}</div>}

          {courses.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No courses yet.</p>
          ) : (
            <ul style={{ listStyle: 'none', padding: 0 }}>
              {courses.map((c) => (
                <li
                  key={c.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    padding: '10px 12px',
                    borderRadius: 8,
                    cursor: 'pointer',
                    background: selected?.id === c.id ? 'var(--bg-card-hover)' : 'transparent',
                    marginBottom: 4,
                    transition: 'background .2s',
                  }}
                  onClick={() => setSelected(c)}
                >
                  <span style={{ marginRight: '8px' }}>📘</span>
                  <span style={{ fontWeight: selected?.id === c.id ? 'bold' : 'normal' }}>
                    {c.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>

      {/* ── Right: Documents (Read-Only) ──────────────────────── */}
      <div>
        <div className="card">
          <div className="card-header">
            <span className="icon">📄</span>
            <h2>{selected ? `Documents — ${selected.title}` : 'Select a course'}</h2>
          </div>

          {selected ? (
            <>
              {docs.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  No documents found for this course.
                </p>
              ) : (
                <ul style={{ listStyle: 'none', padding: 0 }}>
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
                        rel="noopener noreferrer"
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