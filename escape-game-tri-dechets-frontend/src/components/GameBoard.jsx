import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import confetti from 'canvas-confetti';
import { io } from 'socket.io-client';
import TrashItem from './TrashItem';
import TrashBin from './TrashBin';

// Socket singleton (simple client; expects backend on same origin or localhost:3000)
let socketInstance;
function getSocket() {
  if (!socketInstance) {
    const isDev = import.meta.env.DEV;
    const url = import.meta.env.VITE_SOCKET_URL || (isDev ? 'http://localhost:3001' : window.location.origin);
    socketInstance = io(url, { transports: ['websocket'], autoConnect: true });
  }
  return socketInstance;
}

const BIN_DEFINITIONS = [
  { id: 'yellow', label: 'Plastique', color: '#FFD400', accepts: ['plastic'], digit: '7' },
  { id: 'blue', label: 'Carton', color: '#3B82F6', accepts: ['cardboard', 'paper'], digit: '2' },
  { id: 'green', label: 'Verre', color: '#10B981', accepts: ['glass'], digit: '9' },
  { id: 'brown', label: 'Épluchures', color: '#8B5E3C', accepts: ['organic'], digit: '4' },
];

const INITIAL_ITEMS = [
  { id: 'i1', type: 'plastic', emoji: '🥤', label: 'Bouteille plastique' },
  { id: 'i2', type: 'cardboard', emoji: '📦', label: 'Carton' },
  { id: 'i3', type: 'glass', emoji: '🍾', label: 'Bouteille en verre' },
  { id: 'i4', type: 'organic', emoji: '🍌', label: 'Épluchure' },
  { id: 'i5', type: 'paper', emoji: '📰', label: 'Journal' },
  { id: 'i6', type: 'plastic', emoji: '🍽️', label: 'Barquette plastique' },
  { id: 'i7', type: 'glass', emoji: '🥫', label: 'Pot en verre' },
  { id: 'i8', type: 'organic', emoji: '🍎', label: 'Trognon' },
];

// Secret word and mapping each item to its letter position in the word
const TARGET_WORD = 'ECOSCAPE';
// i1->E(0), i2->C(1), i3->O(2), i4->S(3), i5->C(4), i6->A(5), i7->P(6), i8->E(7)
const ITEM_TO_INDEX = {
  i1: 0,
  i2: 1,
  i3: 2,
  i4: 3,
  i5: 4,
  i6: 5,
  i7: 6,
  i8: 7,
};

function useTone() {
  const ctxRef = useRef(null);
  useEffect(() => {
    ctxRef.current = new (window.AudioContext || window.webkitAudioContext)();
    return () => {
      try { ctxRef.current && ctxRef.current.close(); } catch {}
    };
  }, []);

  const play = useCallback((freq = 880, durationMs = 150, type = 'sine') => {
    const ctx = ctxRef.current;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.value = 0.08;
    osc.connect(gain).connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    osc.stop(now + durationMs / 1000);
  }, []);

  return play;
}

export default function GameBoard() {
  const [items, setItems] = useState(INITIAL_ITEMS);
  // Stores the indices (positions) in TARGET_WORD that are discovered globally
  const [foundIndices, setFoundIndices] = useState([]);
  const [removedItemIds, setRemovedItemIds] = useState([]);
  const [revealedBins, setRevealedBins] = useState([]); // binIds that revealed their digit
  const [isTreasureRevealed, setIsTreasureRevealed] = useState(false);
  const [isUnlockModalOpen, setIsUnlockModalOpen] = useState(false);
  const playTone = useTone();

  // socket setup
  useEffect(() => {
    const s = getSocket();
    const onIndices = (serverIndices) => {
      const normalized = Array.isArray(serverIndices)
        ? serverIndices.map((n) => Number(n)).filter((n) => Number.isInteger(n))
        : [];
      setFoundIndices((prev) => Array.from(new Set([...(normalized || [])])));
    };
    const onItems = (serverItems) => {
      const normalized = Array.isArray(serverItems) ? serverItems.map((id) => String(id)) : [];
      setRemovedItemIds(() => Array.from(new Set(normalized)));
      setItems((prev) => prev.filter((it) => !normalized.includes(it.id)));
    };
    const onIndexFound = (idx) => {
      const num = Number(idx);
      if (!Number.isInteger(num)) return;
      setFoundIndices((prev) => Array.from(new Set([...prev, num])));
    };
    const onItemSorted = (id) => {
      setRemovedItemIds((prev) => {
        if (prev.includes(id)) return prev;
        const updated = [...prev, id];
        setItems((prevItems) => prevItems.filter((it) => it.id !== id));
        return updated;
      });
    };
    s.on('letters:init', onIndices);
    s.on('letters:update', onIndices);
    s.on('letter:found', onIndexFound);
    s.on('items:init', onItems);
    s.on('items:update', onItems);
    s.on('item:sorted', onItemSorted);
    s.on('bins:init', (ids) => setRevealedBins(Array.from(new Set(ids || []))));
    s.on('bins:update', (ids) => setRevealedBins(Array.from(new Set(ids || []))));
    s.on('bin:revealed', (id) => setRevealedBins((prev) => Array.from(new Set([...prev, id]))));
    s.on('treasure:unlock', () => {
      setIsTreasureRevealed(true);
      setIsUnlockModalOpen(false);
      confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } });
      [880, 988, 1175, 1318, 1760].forEach((f, i) => setTimeout(() => playTone(f, 120, 'triangle'), i * 120));
    });
    s.emit('letters:hello');
    return () => {
      s.off('letters:init', onIndices);
      s.off('letters:update', onIndices);
      s.off('letter:found', onIndexFound);
      s.off('items:init', onItems);
      s.off('items:update', onItems);
      s.off('item:sorted', onItemSorted);
      s.off('bins:init');
      s.off('bins:update');
      s.off('bin:revealed');
      s.off('treasure:unlock');
    };
  }, []);

  const targetLetters = useMemo(() => TARGET_WORD.split(''), []);

  useEffect(() => {
    const allFound = targetLetters.every((_l, idx) => foundIndices.includes(idx));
    const allBinsRevealed = BIN_DEFINITIONS.every((b) => revealedBins.includes(b.id));
    if (allFound && allBinsRevealed && !isTreasureRevealed) {
      setIsUnlockModalOpen(true);
    }
  }, [foundIndices, revealedBins, targetLetters, isTreasureRevealed]);

  const onDropItemToBin = useCallback((itemId, binId) => {
    const item = items.find((it) => it.id === itemId);
    const bin = BIN_DEFINITIONS.find((b) => b.id === binId);
    if (!item || !bin) return;

    const isCorrect = bin.accepts.includes(item.type);
    if (isCorrect) {
      // success feedback
      playTone(1046, 120, 'triangle');
      setItems((prev) => prev.filter((it) => it.id !== itemId));
      setRemovedItemIds((prev) => Array.from(new Set([...prev, itemId])));
      const index = ITEM_TO_INDEX[item.id];
      if (Number.isInteger(index)) {
        setFoundIndices((prev) => {
          const updated = Array.from(new Set([...prev, index]));
          // notify others with the index position discovered
          const s = getSocket();
          s.emit('letter:found', index);
          s.emit('item:sorted', itemId);
          return updated;
        });
        confetti({ particleCount: 60, spread: 45, origin: { y: 0.7 } });
      }

      // If this drop satisfied at least one accepted type for a bin, mark bin revealed if all its items sorted
      const binId = bin.id;
      if (!revealedBins.includes(binId)) {
        // Reveal the bin as soon as we sorted one correct item of that type (simpler rule).
        setRevealedBins((prev) => {
          const updated = Array.from(new Set([...prev, binId]));
          getSocket().emit('bin:revealed', binId);
          return updated;
        });
      }
    } else {
      // error feedback
      playTone(220, 220, 'square');
      // shake animation is handled on bins via stateful class (triggered by drop handler)
    }
  }, [items, playTone]);

  const resetBoard = useCallback(() => {
    setItems(INITIAL_ITEMS);
    setIsTreasureRevealed(false);
    setIsUnlockModalOpen(false);
  }, []);

  return (
    <div className="gameboard">
      <header className="gb-header">
        <h1>♻️ Escape Tri des Déchets</h1>
        <div className="letters">
          {targetLetters.map((l, idx) => (
            <span key={idx} className={foundIndices.includes(idx) ? 'found' : ''}>{l}</span>
          ))}
        </div>
        <div className="actions">
          <button className="btn" onClick={resetBoard}>Rejouer</button>
        </div>
      </header>

      <div className="board">
        <div className="items-area">
          {items.map((it) => (
            <TrashItem key={it.id} item={it} />
          ))}
          {items.length === 0 && !isTreasureRevealed && (
            <div className="hint">Dépose les objets dans la bonne poubelle pour révéler le mot secret…</div>
          )}
        </div>
        <div className="bins-area">
          {BIN_DEFINITIONS.map((b) => (
            <TrashBin key={b.id} bin={b} onDrop={onDropItemToBin} revealedDigit={revealedBins.includes(b.id) ? b.digit : null} />
          ))}
        </div>
      </div>

      {isUnlockModalOpen && !isTreasureRevealed && (
        <PinUnlockModal
          onCancel={() => setIsUnlockModalOpen(false)}
          onSubmit={(code) => {
            const expected = BIN_DEFINITIONS.map((b) => b.digit).join('');
            if ((code || '').trim() === expected) {
              setIsTreasureRevealed(true);
              setIsUnlockModalOpen(false);
              confetti({ particleCount: 180, spread: 70, origin: { y: 0.6 } });
              [880, 988, 1175, 1318, 1760].forEach((f, i) => setTimeout(() => playTone(f, 120, 'triangle'), i * 120));
              // notify others about unlock
              getSocket().emit('treasure:unlock');
            } else {
              // small error tone
              playTone(200, 200, 'square');
            }
          }}
        />
      )}

      {isTreasureRevealed && (
        <div className="treasure" aria-live="polite">
          <div className="chest">🪙💎 Cofre trouvé ! 💎🪙</div>
          <div className="sparkles">✨✨✨</div>
        </div>
      )}
    </div>
  );
}

function PinUnlockModal({ onCancel, onSubmit }) {
  const [value, setValue] = useState('');
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Entrez le code</h3>
        <input
          className="pin-input"
          type="text"
          placeholder="Code secret"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') onSubmit?.(value); }}
        />
        <div className="modal-actions">
          <button className="btn" onClick={() => onSubmit?.(value)}>Valider</button>
          <button className="btn" onClick={onCancel}>Annuler</button>
        </div>
      </div>
    </div>
  );
}


