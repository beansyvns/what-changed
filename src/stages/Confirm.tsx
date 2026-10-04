import { useState } from 'react';
import { classify, pathFor } from '../../shared/policy';
import { packOf } from '../lib/session';
import { Card, Choice, Quoted, SourceTag } from '../components/ui';
import type { StageProps } from './types';

export function ConfirmStage({ s, update, next }: StageProps) {
  const pack = packOf(s);
  const assess = s.assess!;
  const proposed = pack.methods.find((m) => m.id === assess.methodId) ?? pack.methods[pack.methods.length - 1];
  const [agree, setAgree] = useState<'yes' | 'no' | null>(proposed.id === 'unclear' ? 'no' : null);
  const [picked, setPicked] = useState<string | null>(null);
  const [diag, setDiag] = useState<string | null>(null);

  const methodId = agree === 'yes' ? proposed.id : picked;
  const diagnostic = pack.diagnostic(s.params);
  const ready = methodId !== null && diag !== null;

  function finish() {
    const method = pack.methods.find((m) => m.id === methodId)!;
    const opt = diagnostic.options.find((o) => o.id === diag)!;
    const check = s.check!;
    const category = classify({
      status: check.status,
      hasWorking: !!s.attempt.working.trim(),
      methodKind: method.kind,
      methodWorks: method.worksFor(s.params),
      signal: opt.signal,
    });
    const patch = {
      confirmed: { methodId: method.id, how: agree === 'yes' ? ('agreed' as const) : ('picked' as const) },
      diagnostic: { optionId: opt.id, label: opt.label, signal: opt.signal },
      category,
      path: pathFor(category),
    };
    update(patch);
    next(patch);
  }

  return (
    <div className="stage">
      <Card title="Here’s how I read your work" aside={<SourceTag source={assess.source} note={assess.note} />}>
        {assess.note && <p className="notice small">{assess.note}</p>}
        <div className="grid-2">
          <div>
            <div className="label">Your answer</div>
            <p className="big-read">{s.check?.read}</p>
            {s.board && <img className="board-thumb" src={s.board} alt="Your whiteboard working" />}
            <div className="label">{s.board ? 'Your working (as you checked it)' : 'Your working'}</div>
            <Quoted text={s.attempt.working} quotes={assess.quotes} />
          </div>
          <div>
            <div className="label">What it looks like you did</div>
            <p className="restate">{proposed.restate}</p>
            {assess.quotes.length > 0 && (
              <p className="muted small">
                Based on your words: {assess.quotes.map((q) => `“${q}”`).join(', ')}
              </p>
            )}
            {assess.source === 'ai' && assess.noticed && <p className="muted small">Also noticed: {assess.noticed}</p>}
          </div>
        </div>
        {proposed.id !== 'unclear' && (
          <Choice
            q={{
              question: 'Is that what you did?',
              options: [
                { id: 'yes', label: 'Yes, that’s it' },
                { id: 'no', label: 'Not quite' },
              ],
              correct: '',
              explain: '',
            }}
            value={agree}
            reveal={false}
            onChange={(id) => setAgree(id as 'yes' | 'no')}
            compact
          />
        )}
        {agree === 'no' && (
          <Choice
            q={{ question: 'Which is closest to what you did?', options: pack.methods.map((m) => ({ id: m.id, label: m.label })), correct: '', explain: '' }}
            value={picked}
            reveal={false}
            onChange={setPicked}
          />
        )}
      </Card>

      {methodId && (
        <Card title="One quick question">
          <Choice q={{ question: diagnostic.question, options: diagnostic.options, correct: '', explain: '' }} value={diag} reveal={false} onChange={setDiag} />
          <p className="muted small">There’s no wrong answer here — it tells the app what you were assuming.</p>
        </Card>
      )}

      {ready && (
        <div className="row end">
          <button type="button" className="btn primary" onClick={finish}>
            Continue
          </button>
        </div>
      )}
    </div>
  );
}
