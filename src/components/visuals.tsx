// Visual tests for each pack. Each shows both cases on the same scale so the
// student can see the condition that changed, not just be told about it.

import { excluded, shortcutValue, valueAt, type CancelParams } from '../../shared/packs/cancel';
import { answerValue, c1, cost, ctxInfo, scaledValue, type PropParams } from '../../shared/packs/proportion';
import { legs, meanOfSpeeds, trueAverage, type SpeedParams } from '../../shared/packs/speed';
import type { PackId } from '../../shared/packs/types';
import { fmt, fmtPlain, fractionText, money } from '../../shared/text';

export function CompareVisual({ packId, a, b }: { packId: PackId; a: unknown; b: unknown }) {
  if (packId === 'speed') return <TimeBars cases={[a as SpeedParams, b as SpeedParams]} />;
  if (packId === 'cancel') return <SubstitutionTables cases={[a as CancelParams, b as CancelParams]} />;
  return <CostBars cases={[a as PropParams, b as PropParams]} />;
}

const LETTERS = ['A', 'B'];

function TimeBars({ cases }: { cases: SpeedParams[] }) {
  const maxT = Math.max(...cases.map((p) => legs(p).t1 + legs(p).t2));
  const su = (p: SpeedParams) => (p.unit === 'km' ? 'km/h' : 'mph');
  return (
    <div className="visual">
      <p className="visual-title">Time spent at each speed (same scale)</p>
      {cases.map((p, i) => {
        const l = legs(p);
        const w1 = (l.t1 / maxT) * 100;
        const w2 = (l.t2 / maxT) * 100;
        const equal = Math.abs(l.t1 - l.t2) < 1e-9;
        return (
          <div className="vis-case" key={i}>
            <div className="vis-case-label">Case {LETTERS[i]}</div>
            <div className="bar-track" role="img" aria-label={`Case ${LETTERS[i]}: ${fmt(l.t1)} hours at ${p.s1} ${su(p)}, ${fmt(l.t2)} hours at ${p.s2} ${su(p)}`}>
              <div className="seg seg-1" style={{ width: `${w1}%` }}>
                <span>
                  {fmt(l.t1)} h at {fmtPlain(p.s1)}
                </span>
              </div>
              <div className="seg seg-2" style={{ width: `${w2}%` }}>
                <span>
                  {fmt(l.t2)} h at {fmtPlain(p.s2)}
                </span>
              </div>
            </div>
            <div className="vis-facts">
              <span>{equal ? 'Equal time at each speed' : `More time at ${fmtPlain(l.t1 > l.t2 ? p.s1 : p.s2)} ${su(p)}`}</span>
              <span>
                True average: <strong>{fmt(trueAverage(p))}</strong> · Average of speeds: <strong>{fmt(meanOfSpeeds(p))}</strong>{' '}
                {Math.abs(trueAverage(p) - meanOfSpeeds(p)) < 1e-9 ? '✓ match' : '✗ differ'}
              </span>
            </div>
          </div>
        );
      })}
      <p className="vis-note">Each speed counts for as long as it lasts. The longer bar pulls the average towards its speed.</p>
    </div>
  );
}

function SubstitutionTables({ cases }: { cases: CancelParams[] }) {
  return (
    <div className="visual">
      <p className="visual-title">Substitution test: original fraction vs crossing out the x’s</p>
      <div className="grid-2">
        {cases.map((p, i) => {
          const ex = excluded(p);
          const xs = [0, 1, 2, 3, 5, 10].filter((x) => !ex.includes(x)).slice(0, 5);
          const sc = shortcutValue(p);
          const matches = xs.filter((x) => {
            const v = valueAt(p, x);
            return v !== null && Math.abs(v - sc) < 1e-9;
          });
          return (
            <div className="vis-case" key={i}>
              <div className="vis-case-label">Case {LETTERS[i]}</div>
              <table className="sub-table">
                <thead>
                  <tr>
                    <th scope="col">x</th>
                    <th scope="col">Original</th>
                    <th scope="col">Crossed out: {fractionText(p.a, p.b).replace('-', '−')}</th>
                    <th scope="col">Same?</th>
                  </tr>
                </thead>
                <tbody>
                  {xs.map((x) => {
                    const v = valueAt(p, x);
                    const same = v !== null && Math.abs(v - sc) < 1e-9;
                    return (
                      <tr key={x} className={same ? 'same' : 'diff'}>
                        <td>{x}</td>
                        <td>{v === null ? '—' : fmt(v)}</td>
                        <td>{fmt(sc)}</td>
                        <td>{same ? '✓' : '✗'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
              <p className="vis-facts">
                {matches.length === xs.length
                  ? 'Matches for every x tested — and the algebra shows it always will.'
                  : matches.length > 0
                    ? `Matches at x = ${matches.join(', ')} only. One match isn’t proof — it must match for every allowed x.`
                    : 'Never matches in this table.'}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function CostBars({ cases }: { cases: PropParams[] }) {
  const maxC = Math.max(...cases.flatMap((p) => [answerValue(p), scaledValue(p)]));
  const H = 150;
  return (
    <div className="visual">
      <p className="visual-title">Cost built from its parts (same scale)</p>
      <div className="grid-2">
        {cases.map((p, i) => {
          const info = ctxInfo(p.ctx);
          const xs = [0, p.x1, p.x2];
          return (
            <div className="vis-case" key={i}>
              <div className="vis-case-label">Case {LETTERS[i]}</div>
              <div className="cost-chart" role="img" aria-label={`Case ${LETTERS[i]}: 0 ${info.units} costs ${money(cost(p, 0))}, ${p.x1} costs ${money(c1(p))}, ${p.x2} costs ${money(answerValue(p))}`}>
                {xs.map((x) => {
                  const fee = (p.fee / maxC) * H;
                  const grow = ((p.rate * x) / maxC) * H;
                  const scaledTop = x === p.x2 ? (scaledValue(p) / maxC) * H : null;
                  return (
                    <div className="cost-col" key={x}>
                      <div className="cost-stack" style={{ height: H }}>
                        {scaledTop !== null && Math.abs(scaledValue(p) - answerValue(p)) > 1e-9 && (
                          <div className="scaled-mark" style={{ bottom: scaledTop }} title="What scaling the whole cost predicts">
                            <span>scaled: {money(scaledValue(p))}</span>
                          </div>
                        )}
                        <div className="cost-grow" style={{ height: grow }} />
                        <div className="cost-fee" style={{ height: fee }} />
                      </div>
                      <div className="cost-value">{money(cost(p, x))}</div>
                      <div className="cost-x">
                        {fmtPlain(x)} {x === 1 ? info.unit : info.units}
                      </div>
                    </div>
                  );
                })}
              </div>
              <p className="legend">
                <span>
                  <span className="key key-fee" /> {info.feeName} {money(p.fee)}
                </span>
                <span>
                  <span className="key key-grow" /> {money(p.rate)} per {info.unit}
                </span>
              </p>
            </div>
          );
        })}
      </div>
      <p className="vis-note">The fixed part is paid once. Only the per-{ctxInfo(cases[0].ctx).unit} part grows with the amount.</p>
    </div>
  );
}
