import { useState } from 'react';

export default function TrashBin({ bin, onDrop, revealedDigit }) {
  const [state, setState] = useState('idle'); // idle | over | shake

  const handleDragOver = (e) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setState((s) => (s !== 'shake' ? 'over' : s));
  };

  const handleDragLeave = () => setState('idle');

  const handleDrop = (e) => {
    e.preventDefault();
    const itemId = e.dataTransfer.getData('text/plain');
    setState('idle');
    if (!itemId) return;
    onDrop?.(itemId, bin.id);
  };

  return (
    <div
      className={`trash-bin ${state}`}
      style={{ '--bin-color': bin.color }}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      role="button"
      aria-label={`Poubelle ${bin.label}`}
      tabIndex={0}
    >
      <div className="bin-body">
        <div className="lid" />
        <div className="label">{bin.label}</div>
        {revealedDigit && (
          <div className="digit-badge" aria-live="polite">{revealedDigit}</div>
        )}
      </div>
    </div>
  );
}


