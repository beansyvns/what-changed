// Spending fewer AI requests. Free tiers (e.g. Gemini) limit requests per minute
// and per day, so the server avoids a call whenever it can do so honestly:
//  1. Checked-first: when the app's own rules already give a confident answer,
//     that answer is used (and labelled "Checked guidance"), with no AI call.
//  2. A small in-memory cache: an identical request (e.g. the demo sample attempt
//     clicked by several judges) reuses the earlier AI answer.
// Set AI_SAVER=off to always ask the AI.

import { createHash } from 'node:crypto';
import { checkedAssess, checkedInterpret, type TutorRequest } from '../../shared/ai.js';

export function saverOn(): boolean {
  return (process.env.AI_SAVER ?? '').trim().toLowerCase() !== 'off';
}

/** A confident checked result for this request, or null if the AI is needed. */
export function checkedFirst(req: TutorRequest): unknown | null {
  if (req.task === 'assess_attempt') {
    const r = checkedAssess(req);
    // Only skip the AI when the rules found a method *and* the exact words that show it.
    if (r.methodId !== 'unclear' && r.quotes.length > 0) return r;
  }
  if (req.task === 'interpret_question') {
    const r = checkedInterpret(req.text);
    if (r.pack && r.params) return r;
  }
  return null;
}

const MAX_ENTRIES = 300;
const TTL_MS = 60 * 60 * 1000;
const cache = new Map<string, { at: number; result: unknown }>();

export function cacheKey(req: TutorRequest, model: string): string {
  return createHash('sha256').update(model).update('\0').update(JSON.stringify(req)).digest('hex');
}

export function cacheGet(key: string, now = Date.now()): unknown | undefined {
  const hit = cache.get(key);
  if (!hit) return undefined;
  if (now - hit.at > TTL_MS) {
    cache.delete(key);
    return undefined;
  }
  // Refresh its place so the most recently used entries survive.
  cache.delete(key);
  cache.set(key, hit);
  return hit.result;
}

export function cacheSet(key: string, result: unknown, now = Date.now()): void {
  cache.set(key, { at: now, result });
  while (cache.size > MAX_ENTRIES) cache.delete(cache.keys().next().value!);
}

export function cacheClear(): void {
  cache.clear();
}
