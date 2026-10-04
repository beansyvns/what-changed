// Small in-memory rate limiter (per server instance). It protects the API key
// from accidental loops and casual abuse; it is not a substitute for a shared store.

const WINDOW_MS = 60_000;
const MAX_PER_WINDOW = 30;
const hits = new Map<string, number[]>();

export function clientId(request: Request): string {
  const fwd = request.headers.get('x-forwarded-for') ?? '';
  return fwd.split(',')[0].trim() || request.headers.get('x-real-ip') || 'local';
}

/** Returns seconds to wait, or 0 when the request may proceed. */
export function rateLimit(id: string, now = Date.now()): number {
  const list = (hits.get(id) ?? []).filter((t) => now - t < WINDOW_MS);
  if (list.length >= MAX_PER_WINDOW) {
    hits.set(id, list);
    return Math.ceil((WINDOW_MS - (now - list[0])) / 1000);
  }
  list.push(now);
  hits.set(id, list);
  if (hits.size > 5000) for (const [k, v] of hits) if (v.every((t) => now - t >= WINDOW_MS)) hits.delete(k);
  return 0;
}
