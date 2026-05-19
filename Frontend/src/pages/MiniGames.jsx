import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useLanguage } from '../contexts/LanguageContext';
import { Lock, Gamepad2, Timer, Zap } from 'lucide-react';
import './MiniGames.css';

/* ═══════════════════════════════════════════════════════════════════════════
   Shared helpers
   ═══════════════════════════════════════════════════════════════════════════ */

const MEMORY_IMAGES = [
  '/Boneca-Ambalabu-PNG.png',
  '/Brr-Brr-Patapim-PNG.png',
  '/Cappuccino-Assassino-PNG.png',
  '/Odindin-Dean-Dean-Dunmadin-Dean-Dundun-PNG.png',
  '/Tralalero-Tralala-PNG.png',
  '/Tung-Tung-Tung-Sahur-PNG-Photos.png',
];

function shuffle(items) {
  const arr = [...items];
  const getRandom = () => {
    if (window.crypto && window.crypto.getRandomValues) {
      const buf = new Uint32Array(1);
      window.crypto.getRandomValues(buf);
      return buf[0] / 0xffffffff;
    }
    return Math.random();
  };

  for (let i = arr.length - 1; i > 0; i -= 1) {
    const j = Math.floor(getRandom() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

/* ═══════════════════════════════════════════════════════════════════════════
   Memory Match
   ═══════════════════════════════════════════════════════════════════════════ */

function buildShuffledDeck(previousDeck = []) {
  const source = [...MEMORY_IMAGES, ...MEMORY_IMAGES];
  const previousOrder = previousDeck.map((card) => card.image);

  let candidate = source;
  let best = source;
  let bestChanged = -1;

  for (let attempt = 0; attempt < 12; attempt += 1) {
    candidate = shuffle(source);
    if (!previousOrder.length) {
      best = candidate;
      break;
    }

    const changedPositions = candidate.reduce(
      (count, image, idx) => count + (image !== previousOrder[idx] ? 1 : 0),
      0,
    );

    if (changedPositions > bestChanged) {
      bestChanged = changedPositions;
      best = candidate;
    }

    if (changedPositions >= 9) {
      best = candidate;
      break;
    }
  }

  return best.map((image, idx) => ({
    id: `${Date.now()}-${idx}`,
    image,
    matched: false,
  }));
}

function MemoryMatch({ fullScreen = false }) {
  const { t } = useLanguage();
  const [deck, setDeck] = useState(() => buildShuffledDeck());
  const [flipped, setFlipped] = useState([]);
  const [moves, setMoves] = useState(0);

  useEffect(() => {
    if (flipped.length !== 2) return;

    const [first, second] = flipped;
    const firstCard = deck.find((d) => d.id === first);
    const secondCard = deck.find((d) => d.id === second);

    if (firstCard && secondCard && firstCard.image === secondCard.image) {
      setDeck((prev) => prev.map((c) => (c.id === first || c.id === second ? { ...c, matched: true } : c)));
      setFlipped([]);
      return;
    }

    const timer = setTimeout(() => setFlipped([]), 650);
    return () => clearTimeout(timer);
  }, [flipped, deck]);

  const done = useMemo(() => deck.every((card) => card.matched), [deck]);

  function onFlip(id) {
    if (flipped.length === 2) return;
    if (flipped.includes(id)) return;
    const card = deck.find((c) => c.id === id);
    if (!card || card.matched) return;
    setFlipped((prev) => [...prev, id]);
    setMoves((v) => v + 1);
  }

  function resetGame() {
    setDeck((prev) => buildShuffledDeck(prev));
    setFlipped([]);
    setMoves(0);
  }

  return (
    <div className={`card mini-card ${fullScreen ? 'mini-card-fullscreen' : ''}`}>
      <div className="mini-header">
        <h3>{t('miniMemoryMatch')}</h3>
        <button className="btn btn-secondary btn-sm" onClick={resetGame}>{t('miniReset')}</button>
      </div>
      <p className="mini-sub">{t('miniMoves')}: {moves} {done && ` • ${t('miniCompleted')}`}</p>
      <div className="memory-grid">
        {deck.map((card) => {
          const shown = card.matched || flipped.includes(card.id);
          return (
            <button key={card.id} className={`memory-tile ${shown ? 'shown' : ''}`} onClick={() => onFlip(card.id)}>
              {shown ? (
                <img src={card.image} alt={t('miniMemoryCardAlt')} className="memory-tile-image" />
              ) : (
                <span>❔</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   8-Puzzle
   ═══════════════════════════════════════════════════════════════════════════ */

function isSolvedBoard(board) {
  return board.every((value, idx) => (idx === 8 ? value === 0 : value === idx + 1));
}

function isSolvableBoard(board) {
  const tiles = board.filter((v) => v !== 0);
  let inversions = 0;

  for (let i = 0; i < tiles.length; i += 1) {
    for (let j = i + 1; j < tiles.length; j += 1) {
      if (tiles[i] > tiles[j]) inversions += 1;
    }
  }

  return inversions % 2 === 0;
}

function buildShuffledPuzzle() {
  const base = [1, 2, 3, 4, 5, 6, 7, 8, 0];
  let candidate = base;

  do {
    candidate = shuffle(base);
  } while (!isSolvableBoard(candidate) || isSolvedBoard(candidate));

  return candidate;
}

function EightPuzzle({ fullScreen = false }) {
  const { t } = useLanguage();
  const [board, setBoard] = useState(() => buildShuffledPuzzle());
  const [moves, setMoves] = useState(0);

  const solved = useMemo(() => isSolvedBoard(board), [board]);

  function resetPuzzle() {
    setBoard(buildShuffledPuzzle());
    setMoves(0);
  }

  function canSwap(indexA, indexB) {
    const rowA = Math.floor(indexA / 3);
    const colA = indexA % 3;
    const rowB = Math.floor(indexB / 3);
    const colB = indexB % 3;

    return Math.abs(rowA - rowB) + Math.abs(colA - colB) === 1;
  }

  function moveTile(index) {
    if (solved) return;

    const emptyIndex = board.indexOf(0);
    if (!canSwap(index, emptyIndex)) return;

    setBoard((prev) => {
      const next = [...prev];
      [next[index], next[emptyIndex]] = [next[emptyIndex], next[index]];
      return next;
    });
    setMoves((v) => v + 1);
  }

  return (
    <div className={`card mini-card ${fullScreen ? 'mini-card-fullscreen' : ''}`}>
      <div className="mini-header">
        <h3>{t('miniPuzzle')}</h3>
        <button className="btn btn-secondary btn-sm" onClick={resetPuzzle}>{t('miniReset')}</button>
      </div>
      <p className="mini-sub">{t('miniMoves')}: {moves} {solved && ` • ${t('miniSolved')}`}</p>
      <div className="puzzle-grid" role="group" aria-label="8 puzzle board">
        {board.map((value, idx) => {
          const isEmpty = value === 0;
          const emptyIndex = board.indexOf(0);
          const movable = !isEmpty && canSwap(idx, emptyIndex);

          return (
            <button
              key={`${value}-${idx}`}
              className={`puzzle-tile ${isEmpty ? 'empty' : ''} ${movable ? 'movable' : ''}`}
              onClick={() => moveTile(idx)}
              disabled={isEmpty || solved}
              aria-label={isEmpty ? t('miniEmptyTile') : `${t('miniTile')} ${value}`}
            >
              {!isEmpty ? value : ''}
            </button>
          );
        })}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   Reaction Clicker
   ═══════════════════════════════════════════════════════════════════════════ */

const TOTAL_ROUNDS = 5;
const BEST_KEY = 'reaction_best_v1';

function getReactionRating(ms, t) {
  if (ms < 200) return { emoji: '⚡', text: t('reactionRatingLightning'), tier: 'lightning' };
  if (ms < 300) return { emoji: '🔥', text: t('reactionRatingFast'), tier: 'fast' };
  if (ms < 400) return { emoji: '👍', text: t('reactionRatingGood'), tier: 'good' };
  return { emoji: '🐢', text: t('reactionRatingSlow'), tier: 'slow' };
}

function ReactionClicker({ fullScreen = false }) {
  const { t } = useLanguage();

  // 'idle' | 'waiting' | 'ready' | 'result' | 'tooEarly' | 'finished'
  const [phase, setPhase] = useState('idle');
  const [round, setRound] = useState(0);
  const [times, setTimes] = useState([]);
  const [currentTime, setCurrentTime] = useState(0);
  const [bestTime, setBestTime] = useState(() => {
    const saved = localStorage.getItem(BEST_KEY);
    return saved ? Number(saved) : null;
  });

  const readyAtRef = useRef(0);
  const timerRef = useRef(null);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  const startRound = useCallback(() => {
    setPhase('waiting');
    const delay = 1000 + Math.random() * 3000; // 1–4 seconds
    timerRef.current = setTimeout(() => {
      readyAtRef.current = performance.now();
      setPhase('ready');
    }, delay);
  }, []);

  const handleClick = useCallback(() => {
    if (phase === 'idle') {
      setRound(1);
      setTimes([]);
      setCurrentTime(0);
      startRound();
      return;
    }

    if (phase === 'waiting') {
      // Clicked too early
      if (timerRef.current) clearTimeout(timerRef.current);
      setPhase('tooEarly');
      return;
    }

    if (phase === 'tooEarly') {
      // Retry same round
      startRound();
      return;
    }

    if (phase === 'ready') {
      const elapsed = Math.round(performance.now() - readyAtRef.current);
      setCurrentTime(elapsed);
      setTimes((prev) => [...prev, elapsed]);

      // Update best time
      if (!bestTime || elapsed < bestTime) {
        setBestTime(elapsed);
        localStorage.setItem(BEST_KEY, String(elapsed));
      }

      if (round >= TOTAL_ROUNDS) {
        setPhase('finished');
      } else {
        setPhase('result');
      }
      return;
    }

    if (phase === 'result') {
      setRound((r) => r + 1);
      startRound();
      return;
    }

    if (phase === 'finished') {
      // Reset for new game
      setPhase('idle');
      setRound(0);
      setTimes([]);
      setCurrentTime(0);
      return;
    }
  }, [phase, round, bestTime, startRound]);

  const average = times.length > 0
    ? Math.round(times.reduce((a, b) => a + b, 0) / times.length)
    : 0;

  const rating = currentTime > 0 ? getReactionRating(currentTime, t) : null;
  const avgRating = average > 0 ? getReactionRating(average, t) : null;

  // Phase-specific rendering
  let zoneClass = 'rc-zone rc-idle';
  let zoneContent;

  if (phase === 'idle') {
    zoneClass = 'rc-zone rc-idle';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-zone-icon">⚡</div>
        <p className="rc-zone-title">{t('reactionTitle')}</p>
        <p className="rc-zone-hint">{t('reactionDesc')}</p>
        <span className="rc-zone-action">Click to start</span>
      </div>
    );
  } else if (phase === 'waiting') {
    zoneClass = 'rc-zone rc-waiting';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-waiting-dots">
          <span /><span /><span />
        </div>
        <p className="rc-zone-title">{t('reactionWait')}</p>
        <p className="rc-zone-round">{t('reactionRound')} {round}/{TOTAL_ROUNDS}</p>
      </div>
    );
  } else if (phase === 'ready') {
    zoneClass = 'rc-zone rc-ready';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-zone-icon rc-go-pulse">🟢</div>
        <p className="rc-zone-title rc-go-text">{t('reactionGo')}</p>
      </div>
    );
  } else if (phase === 'tooEarly') {
    zoneClass = 'rc-zone rc-too-early';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-zone-icon">❌</div>
        <p className="rc-zone-title">{t('reactionTooEarly')}</p>
      </div>
    );
  } else if (phase === 'result') {
    zoneClass = 'rc-zone rc-result';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-zone-icon">{rating?.emoji}</div>
        <p className="rc-result-time">{currentTime}<span className="rc-ms">{t('reactionMs')}</span></p>
        <p className={`rc-result-rating rc-tier-${rating?.tier}`}>{rating?.text}</p>
        <p className="rc-zone-round">{t('reactionRound')} {round}/{TOTAL_ROUNDS} — Click for next</p>
      </div>
    );
  } else if (phase === 'finished') {
    zoneClass = 'rc-zone rc-finished';
    zoneContent = (
      <div className="rc-zone-inner">
        <div className="rc-zone-icon">{avgRating?.emoji}</div>
        <p className="rc-finished-label">{t('reactionAverage')}</p>
        <p className="rc-result-time">{average}<span className="rc-ms">{t('reactionMs')}</span></p>
        <p className={`rc-result-rating rc-tier-${avgRating?.tier}`}>{avgRating?.text}</p>

        <div className="rc-round-results">
          {times.map((time, idx) => (
            <div key={idx} className="rc-round-row">
              <span className="rc-round-label">R{idx + 1}</span>
              <div className="rc-round-bar-track">
                <div
                  className={`rc-round-bar-fill rc-tier-${getReactionRating(time, t).tier}`}
                  style={{ width: `${Math.min(100, (time / 600) * 100)}%` }}
                />
              </div>
              <span className="rc-round-time">{time}{t('reactionMs')}</span>
            </div>
          ))}
        </div>

        {bestTime && (
          <p className="rc-best">{t('reactionBest')}: {bestTime}{t('reactionMs')}</p>
        )}

        <span className="rc-zone-action">{t('reactionPlayAgain')}</span>
      </div>
    );
  }

  return (
    <div className={`card mini-card ${fullScreen ? 'mini-card-fullscreen' : ''}`}>
      <div className="mini-header">
        <h3><Zap size={16} style={{ display: 'inline', marginRight: 6 }} />{t('reactionTitle')}</h3>
        {bestTime && (
          <span className="rc-best-badge">🏆 {t('reactionBest')}: {bestTime}{t('reactionMs')}</span>
        )}
      </div>

      <div className={zoneClass} onClick={handleClick}>
        {zoneContent}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════
   MiniGames — Standalone Page
   ═══════════════════════════════════════════════════════════════════════════ */

export default function MiniGames() {
  const { isBreak, secondsLeft, breakMinutes } = usePomodoro();
  const { t } = useLanguage();
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    if (!isBreak) setActiveGame(null);
  }, [isBreak]);

  const breakProgress = breakMinutes > 0
    ? Math.max(0, Math.min(100, ((breakMinutes * 60 - secondsLeft) / (breakMinutes * 60)) * 100))
    : 0;

  /* Locked state — show when not in break */
  if (!isBreak) {
    return (
      <div className="mg-page">
        <div className="mg-page-header">
          <div className="mg-page-title-group">
            <h1><Gamepad2 className="mg-page-icon" /> {t('miniGamesPageTitle')}</h1>
            <p>{t('miniGamesPageSubtitle')}</p>
          </div>
        </div>
        <div className="fh-games-locked">
          <div className="fh-games-locked-icon">
            <Lock size={24} />
          </div>
          <h2>{t('miniLockedTitle')}</h2>
          <p>{t('miniLockedBody')}</p>
          <Link to="/pomodoro" className="mg-start-focus-btn">
            <Timer size={16} />
            {t('miniStartFocusFirst')}
          </Link>
        </div>
      </div>
    );
  }

  /* Fullscreen game overlay */
  if (activeGame === 'memory') {
    return (
      <div className="mini-fullscreen-overlay">
        <div className="mini-fullscreen-topbar">
          <h2>{t('miniMemoryMatch')}</h2>
          <button className="fh-btn fh-btn-secondary" onClick={() => setActiveGame(null)}>← {t('miniBackToGames')}</button>
        </div>
        <MemoryMatch fullScreen />
      </div>
    );
  }

  if (activeGame === 'puzzle') {
    return (
      <div className="mini-fullscreen-overlay">
        <div className="mini-fullscreen-topbar">
          <h2>{t('miniPuzzle')}</h2>
          <button className="fh-btn fh-btn-secondary" onClick={() => setActiveGame(null)}>← {t('miniBackToGames')}</button>
        </div>
        <EightPuzzle fullScreen />
      </div>
    );
  }

  if (activeGame === 'reaction') {
    return (
      <div className="mini-fullscreen-overlay">
        <div className="mini-fullscreen-topbar">
          <h2>{t('reactionTitle')}</h2>
          <button className="fh-btn fh-btn-secondary" onClick={() => setActiveGame(null)}>← {t('miniBackToGames')}</button>
        </div>
        <ReactionClicker fullScreen />
      </div>
    );
  }

  /* Game launcher */
  return (
    <div className="mg-page">
      {/* Page Header */}
      <div className="mg-page-header">
        <div className="mg-page-title-group">
          <h1><Gamepad2 className="mg-page-icon" /> {t('miniGamesPageTitle')}</h1>
          <p>{t('miniGamesPageSubtitle')}</p>
        </div>
        <Link to="/pomodoro" className="mg-back-btn">
          <Timer size={16} />
          {t('miniBackToTimer')}
        </Link>
      </div>

      <div className="fh-games-content">
        {/* Break Banner */}
        <div className="fh-break-banner">
          <div className="fh-break-banner-left">
            <span className="fh-break-banner-kicker">{t('miniBreakMode')}</span>
            <span className="fh-break-banner-title">{t('miniRelax')}</span>
          </div>
          <div className="fh-break-countdown">
            <span>{Math.floor(secondsLeft / 60)}:{String(secondsLeft % 60).padStart(2, '0')}</span>
            <div className="fh-break-countdown-bar">
              <div className="fh-break-countdown-fill" style={{ width: `${100 - breakProgress}%` }} />
            </div>
          </div>
        </div>

        {/* Game Cards */}
        <div className="fh-games-grid">
          {/* Memory Match */}
          <div className="fh-game-card" onClick={() => setActiveGame('memory')} style={{ '--card-gradient-start': 'rgba(168,85,247,0.06)', '--card-gradient-end': 'rgba(168,85,247,0.02)' }}>
            <div className="fh-game-icon memory">🧠</div>
            <h3>{t('miniMemoryMatch')}</h3>
            <p>{t('miniMemoryDesc')}</p>
            <button className="fh-game-play-btn" onClick={(e) => { e.stopPropagation(); setActiveGame('memory'); }}>▶ {t('miniPlay')}</button>
          </div>

          {/* 8-Puzzle */}
          <div className="fh-game-card" onClick={() => setActiveGame('puzzle')} style={{ '--card-gradient-start': 'rgba(59,130,246,0.06)', '--card-gradient-end': 'rgba(59,130,246,0.02)' }}>
            <div className="fh-game-icon puzzle">🧩</div>
            <h3>{t('miniPuzzle')}</h3>
            <p>{t('miniSlideTiles')}</p>
            <button className="fh-game-play-btn" onClick={(e) => { e.stopPropagation(); setActiveGame('puzzle'); }}>▶ {t('miniPlay')}</button>
          </div>

          {/* Reaction Clicker — Now Playable! */}
          <div className="fh-game-card" onClick={() => setActiveGame('reaction')} style={{ '--card-gradient-start': 'rgba(245,158,11,0.06)', '--card-gradient-end': 'rgba(245,158,11,0.02)' }}>
            <span className="fh-game-badge new">NEW</span>
            <div className="fh-game-icon reaction">⚡</div>
            <h3>{t('reactionTitle')}</h3>
            <p>{t('reactionDesc')}</p>
            <button className="fh-game-play-btn" onClick={(e) => { e.stopPropagation(); setActiveGame('reaction'); }}>▶ {t('miniPlay')}</button>
          </div>
        </div>
      </div>
    </div>
  );
}
