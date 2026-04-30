import { useEffect, useMemo, useState } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
import { useLanguage } from '../contexts/LanguageContext';
import './MiniGames.css';

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

    // With 12 cards, requiring at least 9 changes makes rounds feel truly different.
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

function GameLauncherCard({ title, description, onPlay, disabled = false }) {
  const { t } = useLanguage();
  return (
    <div className="card mini-card mini-launcher-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="btn btn-primary" onClick={onPlay} disabled={disabled}>
        ▶ {t('miniPlay')}
      </button>
    </div>
  );
}

export default function MiniGames() {
  const { isBreak, secondsLeft } = usePomodoro();
  const { t } = useLanguage();
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    if (!isBreak) setActiveGame(null);
  }, [isBreak]);

  if (!isBreak) {
    return (
      <div className="card mini-locked-card">
        <h2>{t('miniLockedTitle')}</h2>
        <p>{t('miniLockedBody')}</p>
      </div>
    );
  }

  if (activeGame === 'memory') {
    return (
      <div className="mini-fullscreen-overlay">
        <div className="mini-fullscreen-topbar">
          <h2>{t('miniMemoryMatch')}</h2>
          <button className="btn btn-secondary" onClick={() => setActiveGame(null)}>← {t('miniBackToGames')}</button>
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
          <button className="btn btn-secondary" onClick={() => setActiveGame(null)}>← {t('miniBackToGames')}</button>
        </div>
        <EightPuzzle fullScreen />
      </div>
    );
  }

  return (
    <div className="mini-root">
      <section className="card mini-banner">
        <p className="mini-kicker">{t('miniBreakMode')}</p>
        <h2>{t('miniRelax')}</h2>
        <p className="mini-sub">{t('miniBreakEnds')} {Math.floor(secondsLeft / 60)}m {String(secondsLeft % 60).padStart(2, '0')}s</p>
      </section>

      <section className="mini-grid">
        <GameLauncherCard
          title={t('miniMemoryMatch')}
          description={t('miniUnavailable')}
          disabled
        />
        <GameLauncherCard
          title={t('miniPuzzle')}
          description={t('miniSlideTiles')}
          onPlay={() => setActiveGame('puzzle')}
        />
        <GameLauncherCard
          title={t('miniReactionClicker')}
          description={t('miniComingSoon')}
          disabled
        />
      </section>
    </div>
  );
}
