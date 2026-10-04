import { useState } from 'react';
import { tutor } from '../lib/api';
import { packOf } from '../lib/session';
import { Card, QuestionText } from '../components/ui';
import { useWorking, WorkingInput } from '../components/WorkingInput';
import type { StageProps } from './types';

export function AttemptStage({ s, update, next }: StageProps) {
  const pack = packOf(s);
  const [v, setV] = useState(s.attempt);
  const [busy, setBusy] = useState(false);
  const [pending, setPending] = useState<ReturnType<typeof pack.checkAnswer> | null>(null);
  const [stuck, setStuck] = useState(false);
  const w = useWorking(s.packId, s.params, v, setV);

  async function submit(force = false) {
    // Drawn working must be read (and checked by the student) before it's used.
    if (w.drawing && w.live && !w.readCurrent && w.read.state !== 'failed') {
      setPending(null);
      await w.readBoard();
      return;
    }
    const check = pack.checkAnswer(s.params, v.answer, v.exclusions);
    if (check.status === 'empty' && !v.working.trim()) {
      setPending({ ...check, note: 'Write an answer (or some working) first — a guess is fine. Or choose “I don’t know where to start”.' });
      return;
    }
    if (!force && (check.status === 'ambiguous' || check.status === 'unparsed' || check.status === 'empty')) {
      setPending(check);
      return;
    }
    const board = w.boardImage();
    setBusy(true);
    const r = await tutor({ task: 'assess_attempt', pack: s.packId, params: s.params, answer: v.answer, working: v.working });
    setBusy(false);
    update({ attempt: v, board, check, assess: { ...r.result, source: r.source, note: r.note } });
    next({ attempt: v, board, check });
  }

  function dontKnow() {
    update({ attempt: v, noAttempt: true, category: 'no_attempt', path: 'explore', check: pack.checkAnswer(s.params, '', '') });
    next({ noAttempt: true, path: 'explore' });
  }

  const onFields = (nv: typeof v) => (setV(nv), setPending(null));

  return (
    <div className="stage">
      <Card title="Your question" className="question-card">
        <QuestionText d={pack.describe(s.params)} />
        {s.source === 'example' && (
          <button
            type="button"
            className="btn link small"
            onClick={() => {
              setV({ ...pack.sampleWork, exclusions: '' });
              w.setMode('type');
            }}
          >
            Fill in a sample student attempt (for demos)
          </button>
        )}
      </Card>

      <Card title="Your answer">
        <WorkingInput w={w} kind={pack.answerKind} value={v} onChange={onFields} disabled={busy} autoFocus />

        {pending && (
          <div className="notice" role="status">
            <p>
              <strong>{pending.read}</strong> {pending.note}
            </p>
            {(pending.status === 'ambiguous' || pending.status === 'unparsed') && (
              <p className="muted small">Edit your answer above so it shows one final answer, or continue and we’ll work from your working.</p>
            )}
          </div>
        )}
        <div className="row">
          <button type="button" className="btn primary" onClick={() => submit(false)} disabled={busy || w.reading}>
            {busy ? 'Reading your work…' : w.reading ? 'Reading your board…' : 'Continue'}
          </button>
          {pending && (pending.status === 'ambiguous' || pending.status === 'unparsed' || pending.status === 'empty') && (v.answer.trim() || v.working.trim()) && (
            <button type="button" className="btn ghost" onClick={() => submit(true)} disabled={busy || w.reading}>
              Continue anyway
            </button>
          )}
          <button type="button" className="btn ghost" onClick={() => setStuck((x) => !x)} disabled={busy || w.reading}>
            I don’t know where to start
          </button>
        </div>
      </Card>

      {stuck && (
        <Card title={pack.prerequisite.title} className="refresher">
          <ul>
            {pack.prerequisite.body.map((b) => (
              <li key={b}>{b}</li>
            ))}
          </ul>
          <p className="muted">You can try the question again with this in mind, or go straight to comparing two cases.</p>
          <div className="row">
            <button type="button" className="btn secondary" onClick={() => setStuck(false)}>
              Try again
            </button>
            <button type="button" className="btn ghost" onClick={dontKnow}>
              Skip to comparing cases
            </button>
          </div>
        </Card>
      )}
    </div>
  );
}
