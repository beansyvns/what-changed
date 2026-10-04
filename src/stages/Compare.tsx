import { useMemo, useState } from 'react';
import { tutor, type Source } from '../lib/api';
import { packOf, type PredictionRecord } from '../lib/session';
import type { ReflectResult } from '../../shared/ai';
import { CompareVisual } from '../components/visuals';
import { Card, Choice, QuestionText, SourceTag, useStep } from '../components/ui';
import type { StageProps } from './types';

// "Test it": one prediction → see what really happens → pick the reason (+ optional own words).
export function CompareStage({ s, update, next }: StageProps) {
  const pack = packOf(s);
  const focusId = s.confirmed && pack.focus(s.confirmed.methodId).id === s.confirmed.methodId ? s.confirmed.methodId : undefined;
  const focus = pack.focus(focusId);
  const A = s.params;
  const B = useMemo(() => pack.contrast(A, focusId), [pack, A, focusId]);
  const cases = [A, B];
  const sol = cases.map((p) => pack.solve(p));
  const works = cases.map((p) => focus.works(p));
  const Focus = focus.name.charAt(0).toUpperCase() + focus.name.slice(1);

  const [step, advance] = useStep(0);
  const [guess, setGuess] = useState<string | null>(null);
  const [reason, setReason] = useState<string | null>(null);
  const [showWhy, setShowWhy] = useState(false);
  const [evidence, setEvidence] = useState('');
  const [busy, setBusy] = useState(false);
  const [feedback, setFeedback] = useState<(ReflectResult & { source: Source; note?: string }) | null>(null);

  const predict = {
    question: `Where will ${focus.name} give the right answer?`,
    options: [
      { id: 'both', label: 'On both questions' },
      { id: 'a', label: 'Only on my question (A)' },
      { id: 'b', label: 'Only on the new question (B)' },
      { id: 'neither', label: 'On neither' },
    ],
    correct: works[0] && works[1] ? 'both' : works[0] ? 'a' : works[1] ? 'b' : 'neither',
    explain: '',
  };
  const guessedRight = guess === predict.correct;
  const label = (id: string | null) => predict.options.find((o) => o.id === id)?.label ?? '—';

  async function sendEvidence() {
    if (!evidence.trim()) return;
    setBusy(true);
    const r = await tutor({
      task: 'reflect_feedback',
      pack: s.packId,
      params: A,
      stage: 'compare',
      prompt: `Why does ${focus.name} work on one question but not the other?`,
      text: evidence,
    });
    setBusy(false);
    setFeedback({ ...r.result, source: r.source, note: r.note });
  }

  function finish() {
    const prediction: PredictionRecord = {
      label: `Where ${focus.name} works`,
      predicted: label(guess),
      actual: label(predict.correct),
      correct: guessedRight,
    };
    const picked = pack.ruleQuestion.options.find((o) => o.id === reason);
    const patch = {
      compare: {
        prediction,
        reason: { label: picked?.label ?? '', correct: reason === pack.ruleQuestion.correct },
        evidence,
        feedback: feedback ?? undefined,
      },
    };
    update(patch);
    next(patch);
  }

  const status = s.check?.status;
  const intro = s.noAttempt
    ? `No problem. Lots of students use a shortcut here: ${focus.name}. Let’s test when it works.`
    : status === 'correct'
      ? 'Nice — your answer is right! But does your method work every time? Let’s test it.'
      : 'Your answer isn’t right yet — and that’s useful. Let’s find out why.';

  return (
    <div className="stage">
      <p className="lead">{intro}</p>

      <div className="grid-2 cases">
        {cases.map((p, i) => (
          <Card key={i} title={i === 0 ? 'A · Your question' : 'B · One thing changed'} className={`case case-${'ab'[i]}`}>
            <QuestionText d={pack.describe(p)} highlight />
          </Card>
        ))}
      </div>
      <p className="muted small center">The highlighted part is the only difference.</p>

      <Card title="1 · Make a guess">
        <Choice q={predict} value={guess} reveal={false} disabled={step >= 1} onChange={setGuess} />
        {step === 0 && (
          <div className="row">
            <button type="button" className="btn primary" disabled={!guess} onClick={() => advance(1)}>
              Show me what happens
            </button>
            <span className="muted small">Just guess — it’s not marked.</span>
          </div>
        )}
      </Card>

      {step >= 1 && (
        <Card title="2 · What really happens">
          <CompareVisual packId={s.packId} a={A} b={B} />
          <div className="grid-2 results">
            {cases.map((p, i) => (
              <div key={i} className={`result ${works[i] ? 'ok' : 'not'}`}>
                <div className="label">{i === 0 ? 'A · Your question' : 'B · One thing changed'}</div>
                <p>
                  Right answer: <strong>{sol[i].display}</strong>
                  <br />
                  {Focus} gives: <strong>{focus.result(p)}</strong> {works[i] ? '✓ works' : '✗ doesn’t work'}
                </p>
              </div>
            ))}
          </div>
          <div className="row">
            <button type="button" className="btn secondary small" aria-expanded={showWhy} onClick={() => setShowWhy((x) => !x)}>
              {showWhy ? 'Hide the why' : 'Why? Show me the maths'}
            </button>
          </div>
          {showWhy && (
            <div className="grid-2 why-box">
              {cases.map((p, i) => (
                <div key={i}>
                  <div className="label">{i === 0 ? 'A · Your question' : 'B · One thing changed'}</div>
                  <ol>
                    {pack.explainCase(p, focusId).map((line) => (
                      <li key={line}>{line}</li>
                    ))}
                  </ol>
                </div>
              ))}
            </div>
          )}
          <p className={`explain ${guessedRight ? 'ok' : 'not'}`} role="status">
            {guessedRight ? (
              <>
                <strong>You guessed right!</strong> {label(guess)}.
              </>
            ) : (
              <>
                <strong>Surprise!</strong> You guessed “{label(guess)}”, but it’s actually “{label(predict.correct)}”. That’s exactly why we test.
              </>
            )}
          </p>
          {step === 1 && (
            <div className="row end">
              <button type="button" className="btn primary" onClick={() => advance(2)}>
                Next
              </button>
            </div>
          )}
        </Card>
      )}

      {step >= 2 && (
        <Card title="3 · So when does it work?" aside={feedback && <SourceTag source={feedback.source} note={feedback.note} />}>
          <p className="muted">Look at the picture above, then pick the best reason.</p>
          <Choice q={pack.ruleQuestion} value={reason} onChange={setReason} />
          {reason && (
            <>
              <label>
                Want to say it in your own words? <span className="muted">(optional)</span>
                <textarea
                  rows={2}
                  value={evidence}
                  maxLength={1200}
                  onChange={(e) => (setEvidence(e.target.value), setFeedback(null))}
                  placeholder="It works when…"
                />
              </label>
              {feedback && (
                <div className={`feedback ${feedback.mentionsCondition ? 'ok' : 'not'}`} role="status">
                  {feedback.quote && (
                    <p>
                      <mark className="evidence">“{feedback.quote}”</mark>
                    </p>
                  )}
                  <p>{feedback.feedback}</p>
                  {feedback.hintId !== 'none' && (
                    <p className="muted small">Hint: {pack.hints(A, 'repair').find((h) => h.id === feedback.hintId)?.text}</p>
                  )}
                </div>
              )}
              <div className="row end">
                {!feedback && evidence.trim() && (
                  <button type="button" className="btn secondary" disabled={busy} onClick={sendEvidence}>
                    {busy ? 'Reading…' : 'Check my words'}
                  </button>
                )}
                <button type="button" className="btn primary" disabled={busy} onClick={finish}>
                  Next: your turn
                </button>
              </div>
            </>
          )}
        </Card>
      )}
    </div>
  );
}
