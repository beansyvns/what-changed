import { useEffect, useRef } from 'react';
import { nextStage, packOf, STAGE_INTRO, STAGE_LABEL, stagesFor, type Session } from '../lib/session';
import { AttemptStage } from '../stages/Attempt';
import { CompareStage } from '../stages/Compare';
import { ConfirmStage } from '../stages/Confirm';
import { SlipStage } from '../stages/Slip';
import { TransferStage } from '../stages/Transfer';

export function WorkspaceView({ s, setS, onReport, onExit }: { s: Session; setS: (fn: (s: Session) => Session) => void; onReport: () => void; onExit: () => void }) {
  const pack = packOf(s);
  const stages = stagesFor(s);
  const current = stages.indexOf(s.stage);
  const topRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    topRef.current?.focus({ preventScroll: true });
  }, [s.stage]);

  const update = (patch: Partial<Session>) => setS((prev) => ({ ...prev, ...patch }));
  const next = (patch: Partial<Session> = {}) => {
    // Stages pass everything that decides the route in `patch`, so it can be computed here.
    const n = nextStage({ ...s, ...patch });
    setS((prev) => ({ ...prev, ...patch, ...(n === 'report' ? {} : { stage: n }) }));
    if (n === 'report') onReport();
  };

  const props = { s, update, next };

  return (
    <div className="workspace">
      <div className="ws-head" ref={topRef} tabIndex={-1}>
        <div>
          <div className="pack-subject">
            {pack.subject} · {pack.distinction}
          </div>
          <h1 className="ws-title">{pack.title}</h1>
        </div>
        <button type="button" className="btn ghost small" onClick={onExit}>
          ← Pick another topic
        </button>
      </div>
      <nav aria-label="Progress">
        <ol className="stepper">
          {stages.map((st, i) => (
            <li key={st} className={i < current ? 'done' : i === current ? 'current' : ''} aria-current={i === current ? 'step' : undefined}>
              <span className="dot">{i < current ? '✓' : i + 1}</span>
              {STAGE_LABEL[st]}
            </li>
          ))}
          <li>
            <span className="dot">{stages.length + 1}</span>Results
          </li>
        </ol>
      </nav>
      <p className="stage-intro">
        <strong>{STAGE_LABEL[s.stage]}:</strong> {STAGE_INTRO[s.stage]}
      </p>
      {s.stage === 'attempt' && <AttemptStage key={`a-${pack.key(s.params)}`} {...props} />}
      {s.stage === 'confirm' && <ConfirmStage {...props} />}
      {s.stage === 'slip' && <SlipStage {...props} />}
      {s.stage === 'compare' && <CompareStage {...props} />}
      {s.stage === 'transfer' && <TransferStage {...props} />}
    </div>
  );
}
