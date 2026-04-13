import { useEffect, useMemo, useState } from 'react';
import { usePomodoro } from '../contexts/PomodoroContext';
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
        <h3>Memory Match</h3>
        <button className="btn btn-secondary btn-sm" onClick={resetGame}>Reset</button>
      </div>
      <p className="mini-sub">Moves: {moves} {done && ' • Completed!'}</p>
      <div className="memory-grid">
        {deck.map((card) => {
          const shown = card.matched || flipped.includes(card.id);
          return (
            <button key={card.id} className={`memory-tile ${shown ? 'shown' : ''}`} onClick={() => onFlip(card.id)}>
              {shown ? (
                <img src={card.image} alt="Memory card" className="memory-tile-image" />
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

function GameLauncherCard({ title, description, onPlay, disabled = false }) {
  return (
    <div className="card mini-card mini-launcher-card">
      <h3>{title}</h3>
      <p>{description}</p>
      <button className="btn btn-primary" onClick={onPlay} disabled={disabled}>
        ▶ Play
      </button>
    </div>
  );
}

export default function MiniGames() {
  const { isBreak, secondsLeft } = usePomodoro();
  const [activeGame, setActiveGame] = useState(null);

  useEffect(() => {
    if (!isBreak) setActiveGame(null);
  }, [isBreak]);

  if (!isBreak) {
    return (
      <div className="card mini-locked-card">
        <h2>Mini Games Locked</h2>
        <p>This tab is only available during Pomodoro breaks.</p>
      </div>
    );
  }

  if (activeGame === 'memory') {
    return (
      <div className="mini-fullscreen-overlay">
        <div className="mini-fullscreen-topbar">
          <h2>Memory Match</h2>
          <button className="btn btn-secondary" onClick={() => setActiveGame(null)}>← Back to Games</button>
        </div>
        <MemoryMatch fullScreen />
      </div>
    );
  }

  return (
    <div className="mini-root">
      <section className="card mini-banner">
        <p className="mini-kicker">Break Mode Active</p>
        <h2>Relax with mini games</h2>
        <p className="mini-sub">Break ends in {Math.floor(secondsLeft / 60)}m {String(secondsLeft % 60).padStart(2, '0')}s</p>
      </section>

      <section className="mini-grid">
        <GameLauncherCard
          title="Memory Match"
          description="Match all image pairs before break ends."
          onPlay={() => setActiveGame('memory')}
        />
        <GameLauncherCard
          title="Quick Math Challenge"
          description="To be added soon"
          disabled
        />
        <GameLauncherCard
          title="Reaction Clicker"
          description="To be added soon"
          disabled
        />
      </section>
    </div>
  );
}
