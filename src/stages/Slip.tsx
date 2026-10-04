import { useState } from 'react';
import { equivalent, parseExpr, toRational } from '../../shared/math/expr';
import { closeTo, parseNumericAnswer } from '../../shared/text';
import type { SlipStep } from '../../shared/packs/types';
import { packOf } from '../lib/session';
import { Card, QuestionText } from '../components/ui';
import type { StageProps } from './types';

function stepOk(step: SlipStep, value: string): boolean | null {
  if (!value.trim()) return null;
  if (step.kind === 'number') {
    const p = parseNumericAnswer(value);
    return p.kind === 'number' && closeTo(p.value, step.expected as number);
  }
  const a = parseExpr(value);
  const b = parseExpr(String(step.expected));
  if (!a.ok || !b.ok) return false;
  try {
    return equivalent(toRational(a.node), toRational(b.node));
  } catch {
    return false;
  }
}

export function SlipStage({ s, update, next }: StageProps) {
  const pack = packOf(s);
  const steps = pack.slipSteps(s.params);
  const [vals, setVals] = useState<Record<string, string>>({});
  const [checked, setChecked] = useState(false);
  const [showSolution, setShowSolution] = useState(false);

  const results = steps.map((st) => stepOk(st, vals[st.id] ?? ''));
  const firstWrong = steps.find((_, i) => results[i] !== true);
  const allRight = results.every((r) => r === true);

  function finish() {
    const patch = { slip: { firstWrong: allRight ? null : (firstWrong?.id ?? null), fixed: allRight } };
    update(patch);
    next(patch);
  }

  return (
    <div className="stage">
      <Card title="Your method is sound — let’s find the slip">
        <QuestionText d={pack.describe(s.params)} />
        <p className="muted">Your answer was {s.check?.read}, which isn’t the right answer. Fill in each step; the app checks them one by one.</p>
        <ol className="slip-steps">
          {steps.map((st, i) => {
            const r = results[i];
            return (
              <li key={st.id} className={checked ? (r === true ? 'ok' : r === false ? 'not' : '') : ''}>
                <label>
                  {st.label}
                  <span className="inline-input">
                    <input
                      value={vals[st.id] ?? ''}
                      autoComplete="off"
                      maxLength={80}
                      onChange={(e) => (setVals({ ...vals, [st.id]: e.target.value }), setChecked(false))}
                    />
                    {st.unit && <span className="unit">{st.unit}</span>}
                  </span>
                </label>
                {checked && r === true && <span className="mark ok">✓</span>}
                {checked && r === false && <span className="mark not">✗ check this step</span>}
              </li>
            );
          })}
        </ol>
        <div className="row">
          <button type="button" className="btn primary" onClick={() => setChecked(true)}>
            Check my steps
          </button>
          <button type="button" className="btn ghost" onClick={() => setShowSolution(true)}>
            Show worked solution
          </button>
        </div>
        {checked && (
          <p className={`explain ${allRight ? 'ok' : 'not'}`} role="status">
            {allRight ? 'All steps check out. The slip is fixed.' : `The first step to look at: “${firstWrong?.label}”.`}
          </p>
        )}
        {showSolution && (
          <ol className="worked">
            {pack.solve(s.params).steps.map((t) => (
              <li key={t}>{t}</li>
            ))}
          </ol>
        )}
      </Card>
      {(checked || showSolution) && (
        <div className="row end">
          <button type="button" className="btn primary" onClick={finish}>
            Continue: test the method on a changed case
          </button>
        </div>
      )}
    </div>
  );
}
