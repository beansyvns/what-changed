// The /api/tutor request handler: validate → rate-limit → call the AI model with a
// schema-constrained output → sanitise → respond. In demo mode it never calls
// an AI model and says so in the response.

import Anthropic from '@anthropic-ai/sdk';
import { betaZodOutputFormat } from '@anthropic-ai/sdk/helpers/beta/zod';
import type { z } from 'zod';
import {
  LIMITS,
  parseTutorRequest,
  runChecked,
  sanitizeAssess,
  sanitizeInterpret,
  sanitizeReadBoard,
  sanitizeReflect,
  sanitizeSummary,
  type InterpretResult,
  type TutorRequest,
} from '../../shared/ai.js';
import { aiConfig } from './config.js';
import { openAiCompatParse, ProviderError } from './openaiCompat.js';
import { assessPrompt, interpretPrompt, readBoardPrompt, reflectPrompt, summaryPrompt } from './prompts.js';
import { clientId, rateLimit } from './ratelimit.js';
import { cacheGet, cacheKey, cacheSet, checkedFirst, saverOn } from './saver.js';
import { AssessSchema, InterpretSchema, ReadBoardSchema, ReflectSchema, SummarySchema } from './schemas.js';

const json = (status: number, body: unknown, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json', 'cache-control': 'no-store', ...headers } });

let client: Anthropic | null = null;
let clientKey = '';
function getClient(key: string) {
  if (!client || clientKey !== key) {
    client = new Anthropic({ apiKey: key, timeout: 20_000, maxRetries: 1 });
    clientKey = key;
  }
  return client;
}

class RefusalError extends Error {}

function imageBlock(dataUrl: string) {
  const m = /^data:(image\/(?:png|jpeg));base64,(.*)$/.exec(dataUrl)!;
  return { type: 'image' as const, source: { type: 'base64' as const, media_type: m[1] as 'image/png' | 'image/jpeg', data: m[2] } };
}

async function callModel<S extends z.ZodType>(schema: S, prompt: { system: string; user: string }, maxTokens: number, image?: string): Promise<z.infer<S>> {
  const cfg = aiConfig();
  if (cfg.kind === 'openai') {
    try {
      return await openAiCompatParse(schema, { baseUrl: cfg.baseUrl, key: cfg.key, model: cfg.model, system: prompt.system, user: prompt.user, maxTokens, image });
    } catch (e) {
      if (e instanceof ProviderError && e.status === 422) throw new RefusalError(e.message);
      throw e;
    }
  }
  const c = getClient(cfg.key);
  const isHaiku = /haiku/i.test(cfg.model);
  const base = {
    model: cfg.model,
    max_tokens: maxTokens,
    system: prompt.system,
    messages: [{ role: 'user' as const, content: image ? [imageBlock(image), { type: 'text' as const, text: prompt.user }] : prompt.user }],
    output_config: { ...(isHaiku ? {} : { effort: 'low' as const }), format: betaZodOutputFormat(schema) },
  };
  const run = async (withFallbacks: boolean) => {
    const msg = await c.beta.messages.parse(
      withFallbacks ? { ...base, betas: ['server-side-fallback-2026-07-01'], fallbacks: 'default' as const } : base,
    );
    if (msg.stop_reason === 'refusal') throw new RefusalError('The model declined this request.');
    if (!msg.parsed_output) throw new Error('The model returned no structured output.');
    return msg.parsed_output as z.infer<S>;
  };
  try {
    return await run(true);
  } catch (e) {
    // If this account or model doesn't accept the fallback beta, retry once without it.
    if (e instanceof Anthropic.APIError && e.status === 400 && /fallback/i.test(e.message)) return run(false);
    throw e;
  }
}

async function runLive(req: TutorRequest) {
  switch (req.task) {
    case 'assess_attempt':
      return sanitizeAssess(req, await callModel(AssessSchema, assessPrompt(req), 600));
    case 'interpret_question': {
      const out = await callModel(InterpretSchema, interpretPrompt(req.text), 600);
      const params = out.pack === 'none' ? null : out[out.pack];
      return sanitizeInterpret({ pack: out.pack === 'none' ? null : out.pack, params, missing: out.missing } as Partial<InterpretResult>);
    }
    case 'reflect_feedback':
      return sanitizeReflect(req, await callModel(ReflectSchema, reflectPrompt(req), 500));
    case 'session_summary':
      return sanitizeSummary(req, await callModel(SummarySchema, summaryPrompt(req), 900));
    case 'read_board':
      return sanitizeReadBoard(await callModel(ReadBoardSchema, readBoardPrompt(req), 800, req.image));
  }
}

export function handleStatus(): Response {
  const cfg = aiConfig();
  return json(200, {
    mode: cfg.mode,
    provider: cfg.mode === 'live' ? cfg.provider : null,
    model: cfg.mode === 'live' ? cfg.model : null,
    reason: cfg.reason || null,
  });
}

export async function handleTutor(request: Request): Promise<Response> {
  if (request.method !== 'POST') return json(405, { ok: false, error: 'Use POST.' }, { allow: 'POST' });
  // Only whiteboard images may be large; every other task keeps the small text limit (checked after parsing).
  const len = Number(request.headers.get('content-length') ?? 0);
  if (len > LIMITS.imageBodyBytes) return json(413, { ok: false, error: 'Request is too large.' });
  let text: string;
  try {
    text = await request.text();
  } catch {
    return json(400, { ok: false, error: 'Could not read the request.' });
  }
  if (text.length > LIMITS.imageBodyBytes) return json(413, { ok: false, error: 'Request is too large.' });
  let body: unknown;
  try {
    body = JSON.parse(text);
  } catch {
    return json(400, { ok: false, error: 'Request body must be JSON.' });
  }
  const req = parseTutorRequest(body);
  if (typeof req === 'string') return json(400, { ok: false, error: req });
  if (req.task !== 'read_board' && text.length > LIMITS.bodyBytes) return json(413, { ok: false, error: 'Request is too large.' });

  const cfg = aiConfig();
  if (cfg.mode === 'demo') return json(200, { ok: true, mode: 'demo', result: runChecked(req) });

  // Save AI requests: use a confident checked answer, or an identical earlier AI answer.
  const saver = saverOn();
  if (saver) {
    const checked = checkedFirst(req);
    if (checked) return json(200, { ok: true, mode: 'checked', result: checked });
  }
  const key = saver ? cacheKey(req, cfg.model) : '';
  const cached = saver ? cacheGet(key) : undefined;
  if (cached !== undefined) return json(200, { ok: true, mode: 'live', model: cfg.model, cached: true, result: cached });

  const wait = rateLimit(clientId(request));
  if (wait) return json(429, { ok: false, error: `Too many requests. Try again in ${wait} s.` }, { 'retry-after': String(wait) });

  try {
    const result = await runLive(req);
    if (saver) cacheSet(key, result);
    return json(200, { ok: true, mode: 'live', model: cfg.model, result });
  } catch (e) {
    const refused = e instanceof RefusalError;
    // Log a short reason server-side only; never echo the student's text or key.
    console.error(`[tutor] ${req.task} failed: ${e instanceof Error ? e.name + ': ' + e.message.slice(0, 200) : 'unknown error'}`);
    if (refused) return json(422, { ok: false, error: 'The AI declined this request.' });
    const quota = (e instanceof ProviderError && e.status === 429) || (e instanceof Anthropic.APIError && e.status === 429);
    if (quota) return json(503, { ok: false, error: 'the AI is busy (usage limit reached) — wait a minute and try again' }, { 'retry-after': '60' });
    return json(502, { ok: false, error: 'The AI service is unavailable right now.' });
  }
}
