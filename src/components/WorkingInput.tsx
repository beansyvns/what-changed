// "Type | Draw" working input, shared by "Try it" and "Your turn". In Draw mode
// the AI can read the whiteboard into text, which the student checks and edits;
// the app then uses that text, never the drawing itself.

import { useEffect, useId, useState } from 'react';
import type { PackId } from '../../shared/packs/types';
import { getStatus, tutor, type AiStatus } from '../lib/api';
import type { Attempt } from '../lib/session';
import { Calculator } from './Calculator';
import { AnswerFields } from './ui';
import { boardToDataUrl, hasInk, Whiteboard, type Stroke } from './Whiteboard';

type BoardRead =
  | { state: 'idle' }
  | { state: 'reading' }
  /** `strokes` is the board that was read, so we can tell when it has changed since. */
  | { state: 'read'; strokes: Stroke[]; image: string; filledAnswer: boolean }
  | { state: 'failed'; message: string };

export function useWorking(packId: PackId, params: unknown, v: Attempt, setV: (fn: (cur: Attempt) => Attempt) => void) {
  const [mode, setMode] = useState<'type' | 'draw'>('type');
  const [strokes, setStrokes] = useState<Stroke[]>([]);
  const [read, setRead] = useState<BoardRead>({ state: 'idle' });
  const [status, setStatus] = useState<AiStatus | null>(null);

  useEffect(() => {
    getStatus().then(setStatus);
  }, []);

  const live = status?.mode === 'live';
  const drawing = mode === 'draw' && hasInk(strokes);
  const readCurrent = read.state === 'read' && read.strokes === strokes;
  const reading = read.state === 'reading';

  async function readBoard() {
    if (!hasInk(strokes)) return;
    setRead({ state: 'reading' });
    const image = boardToDataUrl(strokes);
    const r = await tutor({ task: 'read_board', pack: packId, params, image });
    if (r.source !== 'ai') {
      const busy = /busy|usage limit/i.test(r.note ?? '');
      setRead({
        state: 'failed',
        message: busy
          ? 'The free AI is busy right now — it only allows a few requests a minute. Wait about a minute, then press “Try reading again”, or type your main steps below.'
          : 'I couldn’t read your board just now. Press “Try reading again”, or type your main steps below.',
      });
      return;
    }
    if (!r.result.legible) {
      setRead({ state: 'failed', message: 'I couldn’t make out any working on the board. Try writing a bit bigger, or type your main steps below.' });
      return;
    }
    const filledAnswer = !v.answer.trim() && !!r.result.answer;
    setV((cur) => ({ ...cur, working: r.result.working, answer: cur.answer.trim() ? cur.answer : r.result.answer }));
    setRead({ state: 'read', strokes, image, filledAnswer });
  }

  /** The board as an image to keep for the results page, or undefined if nothing was drawn. */
  const boardImage = () => (drawing ? (read.state === 'read' && readCurrent ? read.image : boardToDataUrl(strokes)) : undefined);

  return { mode, setMode, strokes, setStrokes, read, status, live, drawing, readCurrent, reading, readBoard, boardImage };
}

export type Working = ReturnType<typeof useWorking>;

export function WorkingInput({
  w,
  kind,
  value,
  onChange,
  disabled = false,
  autoFocus,
  workingLabel,
}: {
  w: Working;
  kind: 'number' | 'expression';
  value: Attempt;
  onChange: (v: Attempt) => void;
  disabled?: boolean;
  autoFocus?: boolean;
  workingLabel?: string;
}) {
  const workId = useId();
  const off = disabled || w.reading;
  const [calcOpen, setCalcOpen] = useState(false);
  // Calculator lines can be added to the working whenever a working box is on screen.
  const workingVisible = w.mode === 'type' || !w.live || w.read.state === 'read' || w.read.state === 'failed';
  const addLine = (line: string) => onChange({ ...value, working: value.working.trim() ? `${value.working.trimEnd()}\n${line}` : line });

  const workingBox = (label: string, hint?: string) => (
    <label htmlFor={workId}>
      {label}
      {hint && <span className="label-hint">{hint}</span>}
      <textarea
        id={workId}
        rows={4}
        value={value.working}
        disabled={off}
        maxLength={1500}
        placeholder="Your main steps, one per line."
        onChange={(e) => onChange({ ...value, working: e.target.value })}
      />
    </label>
  );

  return (
    <>
      <div className="work-toolbar">
        <div className="mode-switch" role="group" aria-label="How do you want to show your working?">
          <button
            type="button"
            className={w.mode === 'type' ? 'on' : ''}
            aria-pressed={w.mode === 'type'}
            onClick={() => w.setMode('type')}
            disabled={disabled}
          >
            Type
          </button>
          <button
            type="button"
            className={w.mode === 'draw' ? 'on' : ''}
            aria-pressed={w.mode === 'draw'}
            onClick={() => w.setMode('draw')}
            disabled={disabled}
          >
            Draw
          </button>
        </div>
        <button type="button" className={`btn small calc-toggle${calcOpen ? ' on' : ''}`} aria-expanded={calcOpen} onClick={() => setCalcOpen((x) => !x)}>
          {calcOpen ? 'Hide calculator' : 'Calculator'}
        </button>
      </div>

      <div className={`work-area${calcOpen ? ' with-calc' : ''}`}>
        <div className="work-main">
          {w.mode === 'type' ? (
            <AnswerFields kind={kind} value={value} onChange={onChange} disabled={disabled} autoFocus={autoFocus} workingLabel={workingLabel} />
          ) : (
            <>
              <Whiteboard strokes={w.strokes} onChange={w.setStrokes} disabled={off} />

              {!w.status ? null : !w.live ? (
                <>
                  <p className="notice small">
                    Reading drawings needs the AI, which is off in demo mode. Use the board to think, then type your main steps below so the app can follow your
                    method.
                  </p>
                  {workingBox('Your main steps')}
                </>
              ) : w.read.state === 'failed' ? (
                <>
                  <p className="notice small" role="status">
                    {w.read.message}
                  </p>
                  <div className="row">
                    <button type="button" className="btn ghost small" onClick={w.readBoard} disabled={!hasInk(w.strokes) || disabled}>
                      Try reading again
                    </button>
                  </div>
                  {workingBox('Your main steps')}
                </>
              ) : w.read.state === 'read' ? (
                <div className="board-read">
                  {!w.readCurrent && (
                    <div className="notice small" role="status">
                      You’ve changed the board since I read it.{' '}
                      <button type="button" className="btn link small" onClick={w.readBoard} disabled={disabled}>
                        Read it again
                      </button>
                    </div>
                  )}
                  <div className="card-head">
                    <strong>Here’s what I read — fix anything I got wrong</strong>
                    <span
                      className="source-tag source-ai"
                      title="Read from your drawing by the AI. You check it; the app then uses this text, not the drawing."
                    >
                      AI reading · you check it
                    </span>
                  </div>
                  {workingBox('Your working, as text', 'The app uses this checked text — not the drawing — to see your method.')}
                  {w.read.filledAnswer && <p className="muted small">I also filled in your final answer from the board — check it below.</p>}
                </div>
              ) : (
                <div className="row wb-read-row">
                  <button type="button" className="btn secondary" onClick={w.readBoard} disabled={!hasInk(w.strokes) || off}>
                    {w.reading ? 'Reading your board…' : 'Read my board'}
                  </button>
                  <span className="muted small">The AI writes out what it sees, then you check it.</span>
                </div>
              )}

              <AnswerFields kind={kind} value={value} onChange={onChange} disabled={off} hideWorking />
            </>
          )}
        </div>
        {calcOpen && <Calculator onUse={workingVisible && !off ? addLine : undefined} />}
      </div>
    </>
  );
}
