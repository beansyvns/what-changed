// Browser-side client for the tutor API. In demo mode nothing is sent anywhere:
// the checked (deterministic) implementations run in the page. In live mode a
// failed AI call falls back to the checked version and says so.

import {
  runChecked,
  type AssessRequest,
  type AssessResult,
  type InterpretRequest,
  type InterpretResult,
  type ReadBoardRequest,
  type ReadBoardResult,
  type ReflectRequest,
  type ReflectResult,
  type SummaryRequest,
  type SummaryResult,
  type TutorRequest,
} from '../../shared/ai';

export interface AiStatus {
  mode: 'live' | 'demo';
  model: string | null;
  provider: string | null;
  reason: string | null;
}

/** Where a piece of guidance came from — always shown to the student. */
export type Source = 'ai' | 'checked' | 'fallback';

export interface Sourced<T> {
  result: T;
  source: Source;
  note?: string;
}

let statusPromise: Promise<AiStatus> | null = null;

export function getStatus(): Promise<AiStatus> {
  if (!statusPromise)
    statusPromise = fetch('/api/status', { headers: { accept: 'application/json' } })
      .then(async (r) => {
        if (!r.ok) throw new Error(String(r.status));
        const s = (await r.json()) as AiStatus;
        return { mode: s.mode === 'live' ? 'live' : 'demo', model: s.model ?? null, provider: s.provider ?? null, reason: s.reason ?? null } as AiStatus;
      })
      .catch(() => ({ mode: 'demo', model: null, provider: null, reason: 'the AI server could not be reached' }) as AiStatus);
  return statusPromise;
}

type ResultFor<R extends TutorRequest> = R extends AssessRequest
  ? AssessResult
  : R extends InterpretRequest
    ? InterpretResult
    : R extends ReflectRequest
      ? ReflectResult
      : R extends SummaryRequest
        ? SummaryResult
        : R extends ReadBoardRequest
          ? ReadBoardResult
          : never;

export async function tutor<R extends TutorRequest>(req: R): Promise<Sourced<ResultFor<R>>> {
  const status = await getStatus();
  if (status.mode === 'demo') return { result: runChecked(req) as ResultFor<R>, source: 'checked' };
  try {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 35_000);
    const r = await fetch('/api/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(req),
      signal: ctrl.signal,
    });
    clearTimeout(timer);
    const body = (await r.json().catch(() => null)) as { ok: boolean; mode?: string; result?: unknown; error?: string } | null;
    if (!r.ok || !body?.ok) throw new Error(body?.error || `HTTP ${r.status}`);
    return { result: body.result as ResultFor<R>, source: body.mode === 'live' ? 'ai' : 'checked' };
  } catch (e) {
    return {
      result: runChecked(req) as ResultFor<R>,
      source: 'fallback',
      note: `The AI couldn’t answer (${(e as Error).message || 'network error'}), so this uses the app’s checked guidance instead.`,
    };
  }
}
