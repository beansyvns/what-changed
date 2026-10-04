import { useState, type ReactNode } from 'react';
import { PACK_ORDER, PACKS } from '../../shared/packs/index';
import type { PackId } from '../../shared/packs/types';
import { tutor, type AiStatus } from '../lib/api';

const OWN_EXAMPLES: { pack: PackId; label: string; text: string }[] = [
  { pack: 'speed', label: 'Average speed', text: 'A bus travels 40 km at 20 km/h and then 40 km at 80 km/h. What is its average speed?' },
  { pack: 'cancel', label: 'Simplify a fraction', text: 'Simplify (x^2 + 6x)/(x^2 + 2x)' },
  { pack: 'proportion', label: 'Cost with a fixed fee', text: 'A gym charges a $30 joining fee plus $10 per month. 3 months cost $60. How much do 6 months cost?' },
];

export function StartView({ status, onStart }: { status: AiStatus | null; onStart: (pack: PackId, params: unknown, source: 'example' | 'own') => void }) {
  const [text, setText] = useState('');
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ title: string; body: string } | null>(null);

  async function readOwn() {
    if (!text.trim()) return;
    setBusy(true);
    setMsg(null);
    const r = await tutor({ task: 'interpret_question', text });
    setBusy(false);
    const { pack, params, missing } = r.result;
    if (pack && params) return onStart(pack, params, 'own');
    setMsg(
      pack
        ? {
            title: `This looks like a ${PACKS[pack].title.toLowerCase()} question, but something is missing.`,
            body: `I couldn’t find ${missing.join(', ') || 'all the numbers I need'}. Compare it with the “${OWN_EXAMPLES.find((e) => e.pack === pack)?.label}” example above and try again.`,
          }
        : {
            title: 'Sorry — I can’t use this question.',
            body: 'This app only works with the three kinds of problem listed above, because it checks every answer itself. Click one of the examples, then change the numbers if you like.',
          },
    );
  }

  return (
    <div className="start">
      <section className="hero">
        <div className="hero-text">
          <p className="eyebrow">An interactive maths workbook · grades 7–9</p>
          <h1>
            What <em className="accent">changed?</em>
          </h1>
          <p className="hero-sub">
            Lots of maths shortcuts only work <em>sometimes</em>. Solve a problem your way, then test your method on a question where just one thing is
            different — and find out <strong>when</strong> it really works.
          </p>
          <div className="row">
            <button type="button" className="btn primary" onClick={() => onStart('speed', PACKS.speed.example, 'example')}>
              Start with average speed
            </button>
            <a className="btn ghost" href="#choose">
              See all chapters
            </a>
          </div>
        </div>
        <HeroFigure />
      </section>

      <section className="contents" aria-labelledby="how">
        <h2 id="how">How each chapter works</h2>
        <ol className="flow">
          {[
            ['Try it', 'Solve it your way — type or draw your working.'],
            ['Check', 'The app reads your method and asks if it got it right.'],
            ['Test it', 'An almost identical question, with one thing changed.'],
            ['Your turn', 'A new question, on your own.'],
            ['Results', 'What you found, in your own words.'],
          ].map(([name, what]) => (
            <li key={name}>
              <strong>{name}</strong>
              <span className="leader" aria-hidden="true" />
              <span>{what}</span>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="choose" className="chapters">
        <h2 id="choose">Pick a chapter</h2>
        <div className="pack-grid">
          {PACK_ORDER.map((id) => {
            const p = PACKS[id];
            return (
              <article key={id} className="pack-card">
                <PackGlyph id={id} />
                <div className="pack-subject">{p.subject}</div>
                <h3>{p.title}</h3>
                <div className="pack-distinction">{p.distinction}</div>
                <p>{p.blurb}</p>
                <button type="button" className="btn secondary" onClick={() => onStart(id, p.example, 'example')}>
                  Start chapter →
                </button>
              </article>
            );
          })}
        </div>
      </section>

      <section className="own card" aria-labelledby="own">
        <h2 id="own">Or bring your own question</h2>
        <p>
          Got a homework question like one of these? Type it in. It has to be <strong>one of these three kinds</strong> — click one to try it, then change the numbers if you like:
        </p>
        <div className="example-chips">
          {OWN_EXAMPLES.map((e) => (
            <button
              key={e.pack}
              type="button"
              className="example-chip"
              onClick={() => {
                setText(e.text);
                setMsg(null);
              }}
            >
              <span className="chip-label">{e.label}</span>
              <span className="chip-text">{e.text}</span>
            </button>
          ))}
        </div>
        <label htmlFor="own-q">Your question</label>
        <textarea
          id="own-q"
          rows={3}
          maxLength={600}
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            setMsg(null);
          }}
          placeholder="Type or paste your question here…"
        />
        {msg && (
          <div className="notice" role="status">
            <strong>{msg.title}</strong>
            <p className="small">{msg.body}</p>
          </div>
        )}
        <div className="row">
          <button type="button" className="btn primary" disabled={!text.trim() || busy} onClick={readOwn}>
            {busy ? 'Reading your question…' : 'Use my question'}
          </button>
        </div>
        <p className="muted small">The app works out the right answer itself, so it only accepts questions it can check.</p>
      </section>

      <section className="privacy card" aria-labelledby="privacy">
        <h2 id="privacy">Privacy</h2>
        <ul>
          <li>No accounts and no personal information. Please don’t type or draw your name or other personal details.</li>
          <li>Nothing is saved: refreshing the page clears your session.</li>
          {status?.mode === 'live' ? (
            <li>
              <strong>AI is on.</strong> What you type (answers, working, explanations) — and a picture of the whiteboard, if you choose to draw your working — is sent to {status.provider ?? 'the AI provider'} to read your method and give feedback. The
              app checks every answer itself and only shows AI output that quotes your exact words.
            </li>
          ) : (
            <li>
              <strong>Demo mode.</strong> No AI calls are made — guidance comes from the app’s checked rules{status?.reason ? ` (${status.reason})` : ''}. Nothing you type leaves this page.
            </li>
          )}
        </ul>
      </section>
    </div>
  );
}

/** One example per chapter: the same shortcut on two problems that differ in one thing. */
const HERO_EXAMPLES: { topic: string; q: string; a: ReactNode; b: ReactNode; work: [string, string] }[] = [
  {
    topic: 'Average speed',
    q: 'Average speed?',
    a: (
      <>
        A car travels <mark className="changed">60 km</mark> at 30 km/h, then <mark className="changed">60 km</mark> at 60 km/h.
      </>
    ),
    b: (
      <>
        A car travels <mark className="changed">for 1 hour</mark> at 30 km/h, then <mark className="changed">for 1 hour</mark> at 60 km/h.
      </>
    ),
    work: ['(30 + 60) ÷ 2 = 45 ✗', '(30 + 60) ÷ 2 = 45 ✓'],
  },
  {
    topic: 'Simplifying fractions',
    q: 'Simplify it.',
    a: (
      <>
        Simplify <span className="mono">(x <mark className="changed">+</mark> 8) / (x <mark className="changed">+</mark> 2)</span>
      </>
    ),
    b: (
      <>
        Simplify <span className="mono">(8<mark className="changed">x</mark>) / (2<mark className="changed">x</mark>)</span>
      </>
    ),
    work: ['cross out the x’s → 8/2 = 4 ✗', 'cross out the x’s → 8/2 = 4 ✓'],
  },
  {
    topic: 'Cost with a fixed fee',
    q: 'How much for 6 months?',
    a: (
      <>
        A gym costs <mark className="changed">$30 to join</mark>, then $10 a month. 3 months cost $60.
      </>
    ),
    b: (
      <>
        A gym costs <mark className="changed">nothing to join</mark>, then $20 a month. 3 months cost $60.
      </>
    ),
    work: ['$60 × 2 = $120 ✗', '$60 × 2 = $120 ✓'],
  },
];

/** Two problem slips with the one difference highlighted — the idea of the app at a glance. Press Δ for the next chapter's example. */
function HeroFigure() {
  const [i, setI] = useState(0);
  const ex = HERO_EXAMPLES[i];
  const next = HERO_EXAMPLES[(i + 1) % HERO_EXAMPLES.length];
  return (
    <figure className="hero-figure">
      <div className="slip-stack" key={i} aria-live="polite">
        <div className="slip slip-a">
          <span className="slip-tag">A</span>
          <p>{ex.a}</p>
          <p className="slip-q">{ex.q}</p>
          <p className="slip-work">{ex.work[0]}</p>
        </div>
        <div className="slip-delta">
          <button type="button" onClick={() => setI((x) => (x + 1) % HERO_EXAMPLES.length)} aria-label={`Show another example: ${next.topic}`} title={`Next example: ${next.topic}`}>
            Δ
          </button>
        </div>
        <div className="slip slip-b">
          <span className="slip-tag">B</span>
          <p>{ex.b}</p>
          <p className="slip-q">{ex.q}</p>
          <p className="slip-work">{ex.work[1]}</p>
        </div>
      </div>
      <figcaption>
        One thing changes. Does the shortcut still work?
        <span className="hero-dots" aria-label={`Example ${i + 1} of ${HERO_EXAMPLES.length}: ${ex.topic}`}>
          {HERO_EXAMPLES.map((e, n) => (
            <button key={e.topic} type="button" className={n === i ? 'on' : ''} aria-label={e.topic} aria-pressed={n === i} onClick={() => setI(n)} />
          ))}
          <span className="hero-topic">{ex.topic}</span>
        </span>
      </figcaption>
    </figure>
  );
}

/** A tiny drawing for each chapter. */
function PackGlyph({ id }: { id: PackId }) {
  const stroke = { stroke: 'currentColor', strokeWidth: 2, fill: 'none', strokeLinecap: 'round' as const };
  return (
    <svg className="pack-glyph" viewBox="0 0 96 48" aria-hidden="true" focusable="false">
      {id === 'speed' && (
        <>
          <rect x="4" y="10" width="56" height="10" rx="1.5" className="g-fill" />
          <rect x="60" y="10" width="28" height="10" rx="1.5" className="g-fill-2" />
          <rect x="4" y="28" width="42" height="10" rx="1.5" className="g-fill" />
          <rect x="46" y="28" width="42" height="10" rx="1.5" className="g-fill-2" />
        </>
      )}
      {id === 'cancel' && (
        <>
          <text x="48" y="19" textAnchor="middle" className="g-text">x + 8</text>
          <line x1="22" y1="25" x2="74" y2="25" {...stroke} />
          <text x="48" y="42" textAnchor="middle" className="g-text">x + 2</text>
          <line x1="30" y1="44" x2="44" y2="4" {...stroke} className="g-strike" />
        </>
      )}
      {id === 'proportion' && (
        <>
          <line x1="4" y1="44" x2="92" y2="44" {...stroke} />
          {[0, 1, 2].map((i) => (
            <g key={i}>
              <rect x={14 + i * 28} y={36} width="16" height="8" className="g-fee" />
              <rect x={14 + i * 28} y={36 - (i + 1) * 9} width="16" height={(i + 1) * 9} className="g-fill" />
            </g>
          ))}
        </>
      )}
    </svg>
  );
}
