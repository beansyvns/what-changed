import { useMemo, useState } from 'react';
import type { AnswerCheck } from '../../shared/packs/types';
import { packOf, transferParams, type TransferOutcome } from '../lib/session';
import { AnswerFields, Card, Choice, HintLadder, QuestionText } from '../components/ui';
import { useWorking, WorkingInput } from '../components/WorkingInput';
import type { StageProps } from './types';

const blank = { answer: '', working: '', exclusions: '' };

// "Your turn": a new question with the same idea. It replaces a separate "repair"
// step — getting this one right is how the student shows they fixed their method.
export function TransferStage({ s, update, next }: StageProps) {
  const pack = packOf(s);
  const t = useMemo(() => transferParams(s), [s]);
  const hints = pack.hints(t, 'transfer');
  const focus = pack.focus();
  const [v, setV] = useState(blank);
  const [shown, setShown] = useState(0);
  const [check, setCheck] = useState<AnswerCheck | null>(null);
  const [tries, setTries] = useState(0);
  const [outcome, setOutcome] = useState<TransferOutcome | null>(null);
  const [wantHelp, setWantHelp] = useState(false);
  const w = useWorking(s.packId, t, v, setV);

  // Optional bonus: the same problem with one thing changed.
  const f = useMemo(() => pack.followup(t), [pack, t]);
  const [bonus, setBonus] = useState(false);
  const [fPred, setFPred] = useState<string | null>(null);
  const [fv, setFv] = useState(blank);
  const [fCheck, setFCheck] = useState<AnswerCheck | null>(null);

  const sawExplanation = shown >= hints.length;
  const done = outcome !== null;

  function submit() {
    const c = pack.checkAnswer(t, v.answer, v.exclusions);
    setCheck(c);
    setTries((n) => n + 1);
    if (c.status === 'correct') setOutcome(sawExplanation ? 'explanation' : shown > 0 ? 'hint' : 'independent');
  }

  function finish() {
    const fWorks = focus.works(f);
    const patch = {
      transfer: {
        params: t,
        attempt: v,
        check: check ?? pack.checkAnswer(t, v.answer, v.exclusions),
        hintsUsed: Math.min(shown, hints.length),
        sawExplanation,
        outcome: outcome ?? 'not_yet',
        reflection: '',
        board: w.boardImage(),
        followup: fCheck
          ? { params: f, prediction: fPred ?? '', predictionCorrect: (fPred === 'yes') === fWorks && fPred !== 'unsure', check: fCheck }
          : undefined,
      },
    };
    update(patch);
    next(patch);
  }

  const praise: Record<TransferOutcome, string> = {
    independent: 'You got it on your own! 🎉',
    hint: 'You got it — with a hint. 👍',
    explanation: 'You got it after seeing the explanation.',
    not_yet: '',
  };

  return (
    <div className="stage">
      <Card title="Your turn">
        <QuestionText d={pack.describe(t)} />
        <WorkingInput
          w={w}
          kind={pack.answerKind}
          value={v}
          onChange={(nv) => (setV(nv), done ? null : setCheck(null))}
          disabled={done}
          workingLabel="Working (optional)"
          autoFocus
        />
        {!done && (
          <div className="row">
            <button type="button" className="btn primary" disabled={!v.answer.trim() || w.reading} onClick={submit}>
              Check my answer
            </button>
            {!wantHelp && !check && (
              <button type="button" className="btn ghost" onClick={() => setWantHelp(true)}>
                I’m stuck
              </button>
            )}
          </div>
        )}
        {check && (
          <p className={`explain ${check.status === 'correct' ? 'ok' : 'not'}`} role="status">
            <strong>{check.status === 'correct' ? praise[outcome ?? 'independent'] : 'Not yet. '}</strong> {check.status === 'correct' ? '' : check.note}
          </p>
        )}
        {!done && (wantHelp || (check && check.status !== 'correct')) && (
          <div className="help">
            <div className="label">Need help?</div>
            <HintLadder hints={hints} shown={shown} onShow={setShown} allowDontKnow={false} />
            {tries > 0 && (
              <div className="row">
                <button type="button" className="btn ghost small" onClick={() => setOutcome('not_yet')}>
                  Skip this question
                </button>
              </div>
            )}
          </div>
        )}
        {outcome === 'not_yet' && <p className="muted">That’s okay — your results will show what to practise next.</p>}
      </Card>

      {done && !bonus && (
        <div className="row end">
          <button type="button" className="btn secondary" onClick={() => setBonus(true)}>
            Bonus challenge (optional)
          </button>
          <button type="button" className="btn primary" onClick={finish}>
            See my results
          </button>
        </div>
      )}

      {done && bonus && (
        <>
          <Card title="Bonus: one thing changes" className="followup">
            <QuestionText d={pack.describe(f)} highlight />
            <Choice
              q={{
                question: `Would ${focus.name} give the right answer now?`,
                options: [
                  { id: 'yes', label: 'Yes' },
                  { id: 'no', label: 'No' },
                  { id: 'unsure', label: 'Not sure' },
                ],
                correct: focus.works(f) ? 'yes' : 'no',
                explain: focus.works(f) ? 'Yes — the shortcut works in this version.' : 'No — the shortcut doesn’t work in this version.',
              }}
              value={fPred}
              onChange={setFPred}
              compact
            />
            {fPred && (
              <>
                <AnswerFields kind={pack.answerKind} value={fv} onChange={(nv) => (setFv(nv), setFCheck(null))} workingLabel="Working (optional)" />
                <div className="row">
                  <button type="button" className="btn secondary" disabled={!fv.answer.trim()} onClick={() => setFCheck(pack.checkAnswer(f, fv.answer, fv.exclusions))}>
                    Check
                  </button>
                </div>
                {fCheck && (
                  <p className={`explain ${fCheck.status === 'correct' ? 'ok' : 'not'}`} role="status">
                    <strong>{fCheck.status === 'correct' ? 'Correct!' : 'Not quite.'}</strong> {fCheck.status !== 'correct' && `The right answer is ${pack.solve(f).display}.`}
                  </p>
                )}
              </>
            )}
          </Card>
          <div className="row end">
            <button type="button" className="btn primary" onClick={finish}>
              See my results
            </button>
          </div>
        </>
      )}
    </div>
  );
}
