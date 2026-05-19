import { useEffect, useRef, useState } from 'react';
import './Interactive3DScene.css';

/**
 * Interactive 3D Study Scene
 * 
 * A multi-layered 3D scene with CSS perspective transforms, parallax mouse tracking,
 * and floating study-related SVG elements (student, books, pencil, lightbulb, backpack).
 * 
 * Eyes track the mouse. The entire scene tilts toward the cursor with smooth lerp.
 * Elements are placed at different Z-depths for genuine parallax.
 */
export default function Interactive3DScene() {
  const containerRef = useRef(null);
  const [mouse, setMouse] = useState({ x: 0, y: 0 });
  const animRef = useRef(null);
  const targetRef = useRef({ x: 0, y: 0 });

  useEffect(() => {
    const handleMouseMove = (e) => {
      const el = containerRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const cx = rect.left + rect.width / 2;
      const cy = rect.top + rect.height / 2;
      targetRef.current = {
        x: Math.max(-1, Math.min(1, (e.clientX - cx) / (rect.width / 2))),
        y: Math.max(-1, Math.min(1, (e.clientY - cy) / (rect.height / 2))),
      };
    };

    // Smooth lerp loop
    let cur = { x: 0, y: 0 };
    const tick = () => {
      cur.x += (targetRef.current.x - cur.x) * 0.09;
      cur.y += (targetRef.current.y - cur.y) * 0.09;
      setMouse({ x: cur.x, y: cur.y });
      animRef.current = requestAnimationFrame(tick);
    };
    animRef.current = requestAnimationFrame(tick);

    window.addEventListener('mousemove', handleMouseMove);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      if (animRef.current) cancelAnimationFrame(animRef.current);
    };
  }, []);

  // 3D tilt angles
  const tiltX = mouse.y * 15;
  const tiltY = mouse.x * -15;

  // Eye tracking
  const plx = 49.5 + mouse.x * 2.5;
  const ply = 55 + mouse.y * 1.8;
  const prx = 70.5 + mouse.x * 2.5;
  const pry = 55 + mouse.y * 1.8;

  const symbols = ['∑', 'π', '√', '∞', 'Δ', 'λ'];

  return (
    <div ref={containerRef} className="i3d-container">
      {/* ── Ambient glow orbs ── */}
      <div
        className="i3d-glow i3d-glow-1"
        style={{ transform: `translate(${mouse.x * -45}px, ${mouse.y * -45}px)` }}
      />
      <div
        className="i3d-glow i3d-glow-2"
        style={{ transform: `translate(${mouse.x * -30}px, ${mouse.y * -30}px)` }}
      />
      <div
        className="i3d-glow i3d-glow-3"
        style={{ transform: `translate(${mouse.x * -38}px, ${mouse.y * -38}px)` }}
      />

      {/* ── 3D Perspective Wrapper ── */}
      <div
        className="i3d-scene"
        style={{
          transform: `perspective(800px) rotateX(${tiltX}deg) rotateY(${tiltY}deg)`,
        }}
      >
        {/* ▸ Layer 1 — Math symbols (deepest) */}
        <div
          className="i3d-layer"
          style={{
            transform: `translateZ(-60px) translate(${mouse.x * -25}px, ${mouse.y * -25}px)`,
          }}
        >
          {symbols.map((sym, i) => (
            <span key={i} className={`i3d-symbol i3d-sym-${i}`}>
              {sym}
            </span>
          ))}
        </div>

        {/* ▸ Layer 2 — Books & Backpack (behind student) */}
        <div
          className="i3d-layer"
          style={{
            transform: `translateZ(-15px) translate(${mouse.x * -10}px, ${mouse.y * -10}px)`,
          }}
        >
          {/* Book stack */}
          <svg
            className="i3d-books"
            viewBox="0 0 90 65"
            width="110"
            height="80"
          >
            <defs>
              <linearGradient id="bk1" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#818cf8" />
                <stop offset="100%" stopColor="#6366f1" />
              </linearGradient>
              <linearGradient id="bk2" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f472b6" />
                <stop offset="100%" stopColor="#ec4899" />
              </linearGradient>
              <linearGradient id="bk3" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#34d399" />
                <stop offset="100%" stopColor="#10b981" />
              </linearGradient>
              <filter id="bookShadow">
                <feDropShadow
                  dx="0"
                  dy="3"
                  stdDeviation="4"
                  floodColor="rgba(0,0,0,0.3)"
                />
              </filter>
            </defs>
            <g filter="url(#bookShadow)">
              {/* Bottom book */}
              <rect x="5" y="40" width="75" height="14" rx="2.5" fill="url(#bk3)" />
              <rect
                x="10"
                y="44"
                width="28"
                height="2.5"
                rx="1.2"
                fill="rgba(255,255,255,0.3)"
              />
              {/* Middle book */}
              <g transform="rotate(-3 45 33)">
                <rect x="10" y="26" width="70" height="14" rx="2.5" fill="url(#bk2)" />
                <rect
                  x="15"
                  y="30"
                  width="24"
                  height="2.5"
                  rx="1.2"
                  fill="rgba(255,255,255,0.3)"
                />
              </g>
              {/* Top book */}
              <g transform="rotate(2 45 18)">
                <rect x="3" y="12" width="72" height="14" rx="2.5" fill="url(#bk1)" />
                <rect
                  x="8"
                  y="16"
                  width="30"
                  height="2.5"
                  rx="1.2"
                  fill="rgba(255,255,255,0.3)"
                />
              </g>
            </g>
          </svg>

          {/* Backpack */}
          <svg
            className="i3d-backpack"
            viewBox="0 0 44 55"
            width="55"
            height="68"
          >
            <defs>
              <linearGradient id="bpGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7c3aed" />
                <stop offset="100%" stopColor="#6d28d9" />
              </linearGradient>
              <filter id="bpShadow">
                <feDropShadow
                  dx="0"
                  dy="3"
                  stdDeviation="3"
                  floodColor="rgba(109,40,217,0.35)"
                />
              </filter>
            </defs>
            <g filter="url(#bpShadow)">
              {/* Main body */}
              <rect x="6" y="12" width="32" height="38" rx="6" fill="url(#bpGrad)" />
              {/* Top handle */}
              <path
                d="M14 12 Q14 4 22 4 Q30 4 30 12"
                fill="none"
                stroke="#5b21b6"
                strokeWidth="3"
                strokeLinecap="round"
              />
              {/* Front pocket */}
              <rect x="11" y="26" width="22" height="14" rx="4" fill="#8b5cf6" />
              {/* Pocket flap line */}
              <rect
                x="16"
                y="30"
                width="12"
                height="3"
                rx="1.5"
                fill="rgba(255,255,255,0.25)"
              />
              {/* Zipper dots */}
              <circle cx="15" cy="20" r="1" fill="rgba(255,255,255,0.35)" />
              <circle cx="29" cy="20" r="1" fill="rgba(255,255,255,0.35)" />
              {/* Straps hint */}
              <rect x="10" y="44" width="4" height="8" rx="2" fill="#5b21b6" />
              <rect x="30" y="44" width="4" height="8" rx="2" fill="#5b21b6" />
            </g>
          </svg>
        </div>

        {/* ▸ Layer 3 — Student Character (center) */}
        <div className="i3d-layer" style={{ transform: 'translateZ(0px)' }}>
          <svg
            viewBox="0 0 120 130"
            className="i3d-student"
            aria-label="Interactive scholar avatar"
          >
            <defs>
              <radialGradient id="faceGrad" cx="50%" cy="40%">
                <stop offset="0%" stopColor="#fbd5a8" />
                <stop offset="100%" stopColor="#f4c89a" />
              </radialGradient>
              <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2d2b55" />
                <stop offset="100%" stopColor="#1c1c3a" />
              </linearGradient>
              <linearGradient id="capGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#2d2b55" />
                <stop offset="100%" stopColor="#1a1a35" />
              </linearGradient>
              <linearGradient id="tieGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e74c3c" />
                <stop offset="100%" stopColor="#c0392b" />
              </linearGradient>
              <filter id="charShadow">
                <feDropShadow
                  dx="0"
                  dy="5"
                  stdDeviation="8"
                  floodColor="rgba(99,102,241,0.35)"
                />
              </filter>
            </defs>
            <g filter="url(#charShadow)">
              {/* Body */}
              <path
                d="M30 90 Q35 78 60 74 Q85 78 90 90 L95 130 L25 130 Z"
                fill="url(#bodyGrad)"
              />
              {/* Collar/Tie */}
              <path
                d="M48 78 Q60 83 72 78 L70 88 Q60 84 50 88 Z"
                fill="url(#tieGrad)"
              />
              {/* Neck */}
              <rect
                x="52"
                y="65"
                width="16"
                height="14"
                rx="4"
                fill="url(#faceGrad)"
              />
              {/* Head */}
              <ellipse cx="60" cy="54" rx="22" ry="22" fill="url(#faceGrad)" />
              {/* Cheek blush */}
              <ellipse
                cx="42"
                cy="60"
                rx="4"
                ry="2.5"
                fill="rgba(255,150,150,0.25)"
              />
              <ellipse
                cx="78"
                cy="60"
                rx="4"
                ry="2.5"
                fill="rgba(255,150,150,0.25)"
              />
              {/* Ears */}
              <ellipse cx="38" cy="54" rx="4" ry="5" fill="#f0b987" />
              <ellipse cx="82" cy="54" rx="4" ry="5" fill="#f0b987" />
              {/* Hair */}
              <path
                d="M38 45 Q40 30 60 28 Q80 30 82 45 Q75 35 60 34 Q45 35 38 45Z"
                fill="#3d2b1f"
              />
              {/* Glasses frames */}
              <rect
                x="43"
                y="50"
                width="13"
                height="10"
                rx="5"
                fill="none"
                stroke="#5a3e2b"
                strokeWidth="1.5"
              />
              <rect
                x="64"
                y="50"
                width="13"
                height="10"
                rx="5"
                fill="none"
                stroke="#5a3e2b"
                strokeWidth="1.5"
              />
              {/* Glasses bridge & arms */}
              <line
                x1="56"
                y1="55"
                x2="64"
                y2="55"
                stroke="#5a3e2b"
                strokeWidth="1.2"
              />
              <line
                x1="39"
                y1="55"
                x2="43"
                y2="55"
                stroke="#5a3e2b"
                strokeWidth="1.2"
              />
              <line
                x1="77"
                y1="55"
                x2="82"
                y2="55"
                stroke="#5a3e2b"
                strokeWidth="1.2"
              />
              {/* Left eye */}
              <g>
                <ellipse cx="49.5" cy="55" rx="4.5" ry="4" fill="white" />
                <circle cx={plx} cy={ply} r="2.2" fill="#1a1a2e" />
                <circle
                  cx={plx + 1.3}
                  cy={ply - 1.2}
                  r="0.7"
                  fill="white"
                />
              </g>
              {/* Right eye */}
              <g>
                <ellipse cx="70.5" cy="55" rx="4.5" ry="4" fill="white" />
                <circle cx={prx} cy={pry} r="2.2" fill="#1a1a2e" />
                <circle
                  cx={prx + 1.3}
                  cy={pry - 1.2}
                  r="0.7"
                  fill="white"
                />
              </g>
              {/* Smile */}
              <path
                d="M54 64 Q60 69 66 64"
                fill="none"
                stroke="#c07a50"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
              {/* ── Graduation Mortarboard ── */}
              <g>
                {/* Cap body (skull cap) */}
                <path
                  d="M42 38 Q42 30 60 30 Q78 30 78 38 L75 40 Q60 42 45 40 Z"
                  fill="url(#capGrad)"
                />
                {/* Flat board (diamond mortarboard) */}
                <polygon
                  points="60,20 92,32 60,38 28,32"
                  fill="#2d2b55"
                />
                {/* Board top highlight */}
                <polygon
                  points="60,21 88,32 60,37 32,32"
                  fill="url(#capGrad)"
                />
                {/* Board edge shadow line */}
                <line
                  x1="28"
                  y1="32"
                  x2="60"
                  y2="38"
                  stroke="#16163a"
                  strokeWidth="0.8"
                  opacity="0.5"
                />
                <line
                  x1="92"
                  y1="32"
                  x2="60"
                  y2="38"
                  stroke="#16163a"
                  strokeWidth="0.8"
                  opacity="0.5"
                />
                {/* Center button */}
                <circle cx="60" cy="32" r="2" fill="#1a1a35" />
                <circle cx="60" cy="32" r="1.2" fill="#f0c040" />
              </g>
              {/* Tassel — hangs from center button */}
              <path
                d="M60 32 Q62 36 68 38 Q74 40 78 46"
                fill="none"
                stroke="#f0c040"
                strokeWidth="1.8"
                strokeLinecap="round"
              />
              {/* Tassel end fringe */}
              <g>
                <line x1="78" y1="46" x2="76" y2="54" stroke="#f0c040" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="78" y1="46" x2="78" y2="55" stroke="#eab308" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="78" y1="46" x2="80" y2="54" stroke="#f0c040" strokeWidth="1.2" strokeLinecap="round" />
                <line x1="78" y1="46" x2="82" y2="52" stroke="#eab308" strokeWidth="1" strokeLinecap="round" />
              </g>
            </g>
          </svg>
        </div>

        {/* ▸ Layer 4 — Pencil & Light bulb (in front) */}
        <div
          className="i3d-layer"
          style={{
            transform: `translateZ(25px) translate(${mouse.x * 15}px, ${mouse.y * 15}px)`,
          }}
        >
          {/* Pencil */}
          <svg
            className="i3d-pencil"
            viewBox="0 0 14 85"
            width="22"
            height="75"
          >
            <defs>
              <filter id="pencilShadow">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="2"
                  floodColor="rgba(251,191,36,0.35)"
                />
              </filter>
            </defs>
            <g filter="url(#pencilShadow)">
              {/* Eraser cap */}
              <rect x="3" y="2" width="8" height="8" rx="2" fill="#f472b6" />
              {/* Metal band */}
              <rect x="2.5" y="9" width="9" height="4" rx="0.5" fill="#d4d4d8" />
              <line
                x1="3.5"
                y1="10.5"
                x2="10.5"
                y2="10.5"
                stroke="#a1a1aa"
                strokeWidth="0.5"
              />
              <line
                x1="3.5"
                y1="12"
                x2="10.5"
                y2="12"
                stroke="#a1a1aa"
                strokeWidth="0.5"
              />
              {/* Body */}
              <rect x="3" y="13" width="8" height="52" rx="1" fill="#fbbf24" />
              {/* Body stripe */}
              <rect x="5.5" y="13" width="3" height="52" fill="#f59e0b" opacity="0.5" />
              {/* Wood tip */}
              <polygon points="7,70 3,65 11,65" fill="#fde68a" />
              {/* Graphite tip */}
              <polygon points="7,74 5,70 9,70" fill="#374151" />
            </g>
          </svg>

          {/* Light bulb with glow */}
          <svg
            className="i3d-lightbulb"
            viewBox="0 0 50 65"
            width="48"
            height="62"
          >
            <defs>
              <radialGradient id="bulbGlow" cx="50%" cy="40%">
                <stop offset="0%" stopColor="rgba(250,204,21,0.45)" />
                <stop offset="60%" stopColor="rgba(250,204,21,0.1)" />
                <stop offset="100%" stopColor="rgba(250,204,21,0)" />
              </radialGradient>
              <linearGradient id="bulbGlass" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#fef9c3" />
                <stop offset="100%" stopColor="#fef08a" />
              </linearGradient>
              <filter id="bulbShadow">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="rgba(250,204,21,0.4)"
                />
              </filter>
            </defs>
            {/* Glow aura */}
            <circle cx="25" cy="24" r="22" fill="url(#bulbGlow)" />
            <g filter="url(#bulbShadow)">
              {/* Glass bulb */}
              <ellipse
                cx="25"
                cy="24"
                rx="12"
                ry="14"
                fill="url(#bulbGlass)"
                stroke="#facc15"
                strokeWidth="0.8"
              />
              {/* Filament lines */}
              <line
                x1="21"
                y1="16"
                x2="21"
                y2="28"
                stroke="#fbbf24"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <line
                x1="25"
                y1="14"
                x2="25"
                y2="28"
                stroke="#fbbf24"
                strokeWidth="1"
                strokeLinecap="round"
              />
              <line
                x1="29"
                y1="16"
                x2="29"
                y2="28"
                stroke="#fbbf24"
                strokeWidth="1"
                strokeLinecap="round"
              />
              {/* Base */}
              <rect x="20" y="36" width="10" height="5" rx="1.5" fill="#a8a29e" />
              <rect x="19" y="40" width="12" height="4" rx="1.5" fill="#78716c" />
              <line
                x1="21"
                y1="38"
                x2="29"
                y2="38"
                stroke="#d6d3d1"
                strokeWidth="0.6"
              />
            </g>
          </svg>

          {/* Notebook */}
          <svg
            className="i3d-notebook"
            viewBox="0 0 52 64"
            width="58"
            height="70"
          >
            <defs>
              <filter id="nbShadow">
                <feDropShadow
                  dx="0"
                  dy="2"
                  stdDeviation="3"
                  floodColor="rgba(0,0,0,0.2)"
                />
              </filter>
            </defs>
            <g filter="url(#nbShadow)">
              {/* Spine */}
              <rect x="4" y="3" width="6" height="58" rx="2" fill="#94a3b8" />
              {/* Page body */}
              <rect
                x="9"
                y="3"
                width="38"
                height="58"
                rx="3"
                fill="white"
                stroke="#cbd5e1"
                strokeWidth="0.5"
              />
              {/* Ruled lines */}
              <line
                x1="15"
                y1="14"
                x2="42"
                y2="14"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="20"
                x2="40"
                y2="20"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="26"
                x2="42"
                y2="26"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="32"
                x2="38"
                y2="32"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="38"
                x2="42"
                y2="38"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="44"
                x2="39"
                y2="44"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              <line
                x1="15"
                y1="50"
                x2="41"
                y2="50"
                stroke="#e2e8f0"
                strokeWidth="0.8"
              />
              {/* Spiral binding dots */}
              <circle cx="7" cy="12" r="2" fill="#64748b" />
              <circle cx="7" cy="22" r="2" fill="#64748b" />
              <circle cx="7" cy="32" r="2" fill="#64748b" />
              <circle cx="7" cy="42" r="2" fill="#64748b" />
              <circle cx="7" cy="52" r="2" fill="#64748b" />
              {/* "Writing" scribble */}
              <path
                d="M16 15 Q20 12 24 15 Q28 18 32 15"
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="0.8"
                opacity="0.6"
              />
              <path
                d="M16 21 Q22 18 28 21"
                fill="none"
                stroke="#a5b4fc"
                strokeWidth="0.8"
                opacity="0.6"
              />
            </g>
          </svg>
        </div>

        {/* ▸ Layer 5 — Sparkle particles (foremost) */}
        <div
          className="i3d-layer"
          style={{
            transform: `translateZ(50px) translate(${mouse.x * 30}px, ${mouse.y * 30}px)`,
          }}
        >
          {[...Array(8)].map((_, i) => (
            <div key={i} className={`i3d-sparkle i3d-sparkle-${i}`} />
          ))}
        </div>
      </div>
    </div>
  );
}
