import { useState } from 'react';
import { calculate, formatCalc } from '../../shared/calc';

const KEYS = [
  ['C', '(', ')', '÷'],
  ['7', '8', '9', '×'],
  ['4', '5', '6', '−'],
  ['1', '2', '3', '+'],
  ['0', '.', '⌫', '='],
];
const OPS = ['÷', '×', '−', '+'];

/** A simple calculator. `onUse` (optional) adds a finished line like "30 + 60 = 90" to the working. */
export function Calculator({ onUse }: { onUse?: (line: string) => void }) {
  const [input, setInput] = useState('');
  const [history, setHistory] = useState<string[]>([]);
  const [justDone, setJustDone] = useState(false);
  const preview = calculate(input);

  function equals() {
    const r = calculate(input);
    if (!r.ok) return;
    const line = `${input.trim()} = ${formatCalc(r.value)}`;
    setHistory((h) => [line, ...h.filter((x) => x !== line)].slice(0, 5));
    setInput(formatCalc(r.value));
    setJustDone(true);
  }

  function press(k: string) {
    if (k === '=') return equals();
    if (k === 'C') return (setInput(''), setJustDone(false));
    if (k === '⌫') return (setInput((x) => x.slice(0, -1)), setJustDone(false));
    // After "=", a number starts fresh; an operator carries the result on.
    setInput((x) => (justDone && !OPS.includes(k) ? k : x + (OPS.includes(k) ? ` ${k} ` : k)));
    setJustDone(false);
  }

  return (
    <div className="calc" aria-label="Calculator">
      <input
        className="calc-display"
        value={input}
        inputMode="decimal"
        aria-label="Calculation"
        placeholder="0"
        maxLength={200}
        onChange={(e) => (setInput(e.target.value), setJustDone(false))}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === '=') {
            e.preventDefault();
            equals();
          } else if (e.key === 'Escape') setInput('');
        }}
      />
      <div className="calc-preview" aria-live="polite">
        {preview.ok ? (justDone ? '' : `= ${formatCalc(preview.value)}`) : preview.error}
      </div>
      <div className="calc-keys">
        {KEYS.flat().map((k) => (
          <button
            key={k}
            type="button"
            className={`calc-key${OPS.includes(k) ? ' op' : ''}${k === '=' ? ' eq' : ''}${k === 'C' ? ' clear' : ''}`}
            aria-label={k === '⌫' ? 'Delete' : k === 'C' ? 'Clear' : k}
            onClick={() => press(k)}
          >
            {k}
          </button>
        ))}
      </div>
      {history.length > 0 && (
        <ul className="calc-history">
          {history.map((h) => (
            <li key={h}>
              <span>{h}</span>
              {onUse && (
                <button type="button" className="btn link small" onClick={() => onUse(h)} title="Add this line to your working">
                  + Add to working
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
