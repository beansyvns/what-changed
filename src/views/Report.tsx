import { useEffect, useState } from 'react';
import { tutor } from '../lib/api';
import { OUTCOME_LABEL, packOf, type Session } from '../lib/session';
import { Card, QuestionText, Quoted, SourceTag } from '../components/ui';

export function ReportView({ s, setS, onHarder, onRestart }: { s: Session; setS: (fn: (s: Session) => Session) => void; onHarder: () => void; onRestart: () => void }) {
  const pack = packOf(s);
  const method = pack.methods.find((m) => m.id === s.confirmed?.methodId);
  const pred = s.compare?.prediction;
  const tr = s.transfer;
  const hintsUsed = tr?.hintsUsed ?? 0;
  const [loading, setLoading] = useState(!s.summary);

  const texts = [
    { label: 'Your first working', text: s.attempt.working },
    { label: 'Your reason in your own words', text: s.compare?.evidence ?? '' },
  ].filter((t) => t.text.trim());

  useEffect(() => {
    if (s.summary) return;
    let alive = true;
    tutor({
      task: 'session_summary',
      pack: s.packId,
      facts: {
        originalStatus: s.noAttempt ? 'no attempt' : (s.check?.status ?? 'unknown'),
        category: s.category ?? 'unknown',
        confirmedMethod: method?.label ?? (s.noAttempt ? 'no method yet' : 'not confirmed'),
        predictionsCorrect: pred?.correct ? 1 : 0,
        predictionsTotal: pred ? 1 : 0,
        repairStatus: null,
        hintsUsed,
        transferOutcome: tr ? OUTCOME_LABEL[tr.outcome] : 'not attempted',
        transferQuestion: tr ? pack.describe(tr.params).text : '',
      },
      texts,
    }).then((r) => {
      if (!alive) return;
      setS((prev) => ({ ...prev, summary: { ...r.result, source: r.source, note: r.note } }));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outcomeClass = tr ? (tr.outcome === 'independent' ? 'ok' : tr.outcome === 'not_yet' ? 'not' : 'mid') : 'not';
  const firstRight = s.check?.status === 'correct';

  return (
    <div className="report">
      <div className="ws-head">
        <div>
          <div className="pack-subject">Your results · {pack.title}</div>
          <h1 className="ws-title">Here’s what you found</h1>
        </div>
        <button type="button" className="btn ghost small" onClick={() => window.print()}>
          Print / save as PDF
        </button>
      </div>

      <Card className="rule-card">
        <div className="label">The big idea</div>
        <p className="rule">{pack.rule}</p>
      </Card>

      <div className="grid-3 stats">
        <div className={`stat outcome-${s.noAttempt ? 'mid' : firstRight ? 'ok' : 'not'}`}>
          <div className="stat-value">{s.noAttempt ? 'Skipped' : firstRight ? 'Right' : 'Not yet'}</div>
          <div className="stat-label">Your first try</div>
        </div>
        <div className={`stat outcome-${pred ? (pred.correct ? 'ok' : 'mid') : 'not'}`}>
          <div className="stat-value">{pred ? (pred.correct ? 'Right' : 'Surprised') : '—'}</div>
          <div className="stat-label">Your guess in “Test it”</div>
        </div>
        <div className={`stat outcome-${outcomeClass}`}>
          <div className="stat-value">{tr ? OUTCOME_LABEL[tr.outcome] : '—'}</div>
          <div className="stat-label">Your turn{hintsUsed ? ` · ${hintsUsed} hint${hintsUsed === 1 ? '' : 's'}` : ''}</div>
        </div>
      </div>

      <Card title="Summary" aside={s.summary && <SourceTag source={s.summary.source} note={s.summary.note} />}>
        {loading && !s.summary ? (
          <p className="muted">Writing your summary…</p>
        ) : (
          s.summary && (
            <>
              <p>{s.summary.summary}</p>
              {s.summary.evidence.length > 0 && (
                <ul className="evidence-list">
                  {s.summary.evidence.map((e) => (
                    <li key={e.quote}>
                      <mark className="evidence">“{e.quote}”</mark> — {e.point}
                    </li>
                  ))}
                </ul>
              )}
              <p>
                <strong>Next step:</strong> {s.summary.nextStep}
              </p>
            </>
          )
        )}
      </Card>

      <Card title="1 · Your first try">
        <QuestionText d={pack.describe(s.params)} />
        {s.noAttempt ? (
          <p className="muted">You skipped this one at first — that’s fine.</p>
        ) : (
          <>
            <p>
              Your answer: <strong>{s.check?.read}</strong> · Right answer: <strong>{pack.solve(s.params).display}</strong>
            </p>
            {s.board && <img className="board-thumb" src={s.board} alt="Your whiteboard working" />}
            <Quoted text={s.attempt.working} quotes={s.assess?.quotes ?? []} />
            {method && <p className="muted small">Your method: {method.label.toLowerCase()}.</p>}
            {s.slip && <p className="muted small">{s.slip.fixed ? 'You found and fixed your slip.' : `You started looking for the slip (first step to check: ${s.slip.firstWrong ?? '—'}).`}</p>}
          </>
        )}
      </Card>

      {s.compare && (
        <Card title="2 · Test it">
          <p>
            You guessed: <strong>{s.compare.prediction.predicted}</strong>
            <br />
            What happened: <strong>{s.compare.prediction.actual}</strong> {s.compare.prediction.correct ? '✓' : ''}
          </p>
          {s.compare.reason.label && (
            <p>
              The reason you picked: <strong>{s.compare.reason.label}</strong> {s.compare.reason.correct ? '✓' : '✗'}
            </p>
          )}
          {s.compare.evidence.trim() && (
            <>
              <div className="label">In your own words</div>
              <Quoted text={s.compare.evidence} quotes={s.compare.feedback?.quote ? [s.compare.feedback.quote] : []} />
            </>
          )}
        </Card>
      )}

      {tr && (
        <Card title="3 · Your turn">
          <QuestionText d={pack.describe(tr.params)} />
          <p>
            Your answer: <strong>{tr.check.read}</strong> — <span className={`pill outcome-${outcomeClass}`}>{OUTCOME_LABEL[tr.outcome]}</span>
          </p>
          {tr.board && <img className="board-thumb" src={tr.board} alt="Your whiteboard working" />}
          {!tr.board && tr.attempt.working.trim() && <blockquote className="student-text">{tr.attempt.working}</blockquote>}
          {tr.outcome === 'not_yet' && (
            <p className="small">
              Right answer: <strong>{pack.solve(tr.params).display}</strong>
            </p>
          )}
          {tr.followup && (
            <p className="small">
              Bonus: you {tr.followup.predictionCorrect ? 'correctly spotted' : 'didn’t spot'} whether the shortcut works, and your answer was{' '}
              {tr.followup.check.status === 'correct' ? 'right' : 'not right yet'}.
            </p>
          )}
        </Card>
      )}

      <div className="row end no-print">
        <button type="button" className="btn secondary" onClick={onHarder}>
          Try a harder one
        </button>
        <button type="button" className="btn primary" onClick={onRestart}>
          Try another topic
        </button>
      </div>
      <p className="muted small">This isn’t a grade, and it isn’t saved anywhere. Print it or save it as a PDF if you want to keep it.</p>
    </div>
  );
}
