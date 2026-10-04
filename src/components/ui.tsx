import { useId, useState, type ReactNode } from 'react';
import type { ChoiceQuestion, Described, Hint } from '../../shared/packs/types';
import type { Source } from '../lib/api';

export function QuestionText({ d, highlight = false }: { d: Described; highlight?: boolean }) {
  return (
    <p className="question-text">
      {d.parts.map((p, i) =>
        typeof p === 'string' ? (
          <span key={i}>{p}</span>
        ) : highlight ? (
          <mark key={i} className="changed">
            {p.mark}
          </mark>
        ) : (
          <span key={i}>{p.mark}</span>
        ),
      )}
    </p>
  );
}

export function SourceTag({ source, note }: { source: Source; note?: string }) {
  const label = source === 'ai' ? 'AI reading · checked by the app' : source === 'fallback' ? 'Checked guidance (AI unavailable)' : 'Checked guidance';
  return (
    <span className={`source-tag source-${source}`} title={note ?? (source === 'ai' ? 'Read by Claude, then validated against the app’s approved methods and your exact words.' : 'From the app’s own checked rules — no AI call.')}>
      {label}
    </span>
  );
}

/** A multiple-choice question. Once answered, shows whether it matched and the explanation. */
export function Choice({
  q,
  value,
  onChange,
  reveal = true,
  disabled = false,
  compact = false,
}: {
  q: ChoiceQuestion;
  value: string | null;
  onChange: (id: string) => void;
  reveal?: boolean;
  disabled?: boolean;
  compact?: boolean;
}) {
  const name = useId();
  const answered = value !== null;
  return (
    <fieldset className={`choice${compact ? ' compact' : ''}`}>
      <legend>{q.question}</legend>
      <div className="options" role="radiogroup">
        {q.options.map((o) => {
          const chosen = value === o.id;
          const state = answered && reveal ? (o.id === q.correct ? 'right' : chosen ? 'wrong' : '') : '';
          return (
            <button
              type="button"
              key={o.id}
              role="radio"
              aria-checked={chosen}
              name={name}
              className={`option ${chosen ? 'chosen' : ''} ${state}`}
              disabled={disabled || (answered && reveal)}
              onClick={() => onChange(o.id)}
            >
              {o.label}
            </button>
          );
        })}
      </div>
      {answered && reveal && (
        <p className={`explain ${value === q.correct ? 'ok' : 'not'}`} role="status">
          <strong>{value === q.correct ? 'Yes. ' : 'Not quite. '}</strong>
          {q.explain}
        </p>
      )}
    </fieldset>
  );
}

/** Progressive hints: each tier unlocks the next. The last tier is the worked explanation. */
export function HintLadder({
  hints,
  shown,
  onShow,
  allowDontKnow = true,
  onDontKnow,
}: {
  hints: Hint[];
  shown: number;
  onShow: (n: number) => void;
  allowDontKnow?: boolean;
  onDontKnow?: () => void;
}) {
  const next = hints[shown];
  return (
    <div className="hints">
      {hints.slice(0, shown).map((h) => (
        <div key={h.id} className={`hint tier-${h.tier}`}>
          <div className="hint-label">{h.label}</div>
          <p>{h.text}</p>
        </div>
      ))}
      <div className="row">
        {next && next.tier < 3 && (
          <button type="button" className="btn secondary" onClick={() => onShow(shown + 1)}>
            {shown === 0 ? 'Show a hint' : 'Next hint'}
          </button>
        )}
        {allowDontKnow && shown === 0 && onDontKnow && (
          <button type="button" className="btn ghost" onClick={onDontKnow}>
            I don’t know
          </button>
        )}
        {shown < hints.length && (
          <button type="button" className="btn ghost" onClick={() => onShow(hints.length)}>
            Show explanation
          </button>
        )}
      </div>
    </div>
  );
}

export function AnswerFields({
  kind,
  value,
  onChange,
  disabled,
  workingLabel = 'Your working',
  workingPlaceholder,
  autoFocus,
  hideWorking = false,
}: {
  kind: 'number' | 'expression';
  value: { answer: string; working: string; exclusions: string };
  onChange: (v: { answer: string; working: string; exclusions: string }) => void;
  disabled?: boolean;
  workingLabel?: string;
  workingPlaceholder?: string;
  autoFocus?: boolean;
  /** Hide the working box (e.g. when the working is drawn on the whiteboard instead). */
  hideWorking?: boolean;
}) {
  const id = useId();
  return (
    <div className="answer-fields">
      <div className={kind === 'expression' ? 'grid-2' : ''}>
        <label htmlFor={`${id}-a`}>
          Final answer
          <input
            id={`${id}-a`}
            value={value.answer}
            disabled={disabled}
            autoFocus={autoFocus}
            maxLength={200}
            autoComplete="off"
            placeholder={kind === 'expression' ? 'e.g. (x + 1)/(x + 4) or “cannot be simplified”' : 'e.g. 42'}
            onChange={(e) => onChange({ ...value, answer: e.target.value })}
          />
        </label>
        {kind === 'expression' && (
          <label htmlFor={`${id}-x`}>
            Values x can’t take
            <input
              id={`${id}-x`}
              value={value.exclusions}
              disabled={disabled}
              maxLength={80}
              autoComplete="off"
              placeholder="e.g. x ≠ −4, or “none”"
              onChange={(e) => onChange({ ...value, exclusions: e.target.value })}
            />
          </label>
        )}
      </div>
      {!hideWorking && (
        <label htmlFor={`${id}-w`}>
          {workingLabel}
          <textarea
            id={`${id}-w`}
            rows={4}
            value={value.working}
            disabled={disabled}
            maxLength={1500}
            placeholder={workingPlaceholder ?? 'Show how you got your answer — words, numbers, anything.'}
            onChange={(e) => onChange({ ...value, working: e.target.value })}
          />
        </label>
      )}
    </div>
  );
}

export function Card({ title, children, className = '', aside }: { title?: ReactNode; children: ReactNode; className?: string; aside?: ReactNode }) {
  return (
    <section className={`card ${className}`}>
      {(title || aside) && (
        <header className="card-head">
          {title && <h3>{title}</h3>}
          {aside}
        </header>
      )}
      {children}
    </section>
  );
}

/** Highlight exact quotes inside the student's own text. */
export function Quoted({ text, quotes }: { text: string; quotes: string[] }) {
  if (!text.trim()) return <p className="muted">(no working written)</p>;
  const norm = (s: string) => s.toLowerCase();
  const ranges: [number, number][] = [];
  for (const q of quotes) {
    const i = norm(text).indexOf(norm(q));
    if (i >= 0) ranges.push([i, i + q.length]);
  }
  ranges.sort((a, b) => a[0] - b[0]);
  const out: ReactNode[] = [];
  let pos = 0;
  ranges.forEach(([s, e], k) => {
    if (s < pos) return;
    out.push(text.slice(pos, s));
    out.push(<mark key={k} className="evidence">{text.slice(s, e)}</mark>);
    pos = e;
  });
  out.push(text.slice(pos));
  return <blockquote className="student-text">{out}</blockquote>;
}

export function useStep(initial = 0) {
  const [step, setStep] = useState(initial);
  const advance = (to: number) => setStep((s) => Math.max(s, to));
  return [step, advance] as const;
}
