// Structured output from any OpenAI-compatible chat API (Gemini, Featherless, Backboard…).
// Asks for JSON matching the schema, then validates it with Zod — the model's word is
// never trusted on shape. If the provider rejects strict JSON-schema mode, it retries
// with plain JSON mode and the schema written into the prompt.

import { z } from 'zod';

export class ProviderError extends Error {
  constructor(
    message: string,
    readonly status = 0,
  ) {
    super(message);
  }
}

interface Opts {
  baseUrl: string;
  key: string;
  model: string;
  system: string;
  user: string;
  maxTokens: number;
  /** Optional image (data URL) sent alongside the user text. */
  image?: string;
}

async function post(url: string, key: string, body: unknown): Promise<unknown> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 28_000);
  try {
    const r = await fetch(url, {
      method: 'POST',
      headers: { 'content-type': 'application/json', authorization: `Bearer ${key}` },
      body: JSON.stringify(body),
      signal: ctrl.signal,
    });
    const text = await r.text();
    if (!r.ok) throw new ProviderError(`HTTP ${r.status}: ${text.slice(0, 200)}`, r.status);
    return JSON.parse(text);
  } catch (e) {
    if (e instanceof ProviderError) throw e;
    throw new ProviderError((e as Error).name === 'AbortError' ? 'timed out' : (e as Error).message);
  } finally {
    clearTimeout(timer);
  }
}

function extractJson(content: string): unknown {
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(content);
  const raw = (fenced ? fenced[1] : content).trim();
  const start = raw.indexOf('{');
  const end = raw.lastIndexOf('}');
  if (start < 0 || end < start) throw new ProviderError('The model did not return JSON.');
  return JSON.parse(raw.slice(start, end + 1));
}

export async function openAiCompatParse<S extends z.ZodType>(schema: S, o: Opts): Promise<z.infer<S>> {
  const jsonSchema = z.toJSONSchema(schema);
  const url = `${o.baseUrl}/chat/completions`;
  const messages = (extra: string) => [
    { role: 'system', content: o.system + extra },
    { role: 'user', content: o.image ? [{ type: 'text', text: o.user }, { type: 'image_url', image_url: { url: o.image } }] : o.user },
  ];
  // Gemini Flash "thinks" before answering by default, which costs tokens and time
  // these short tasks don't need. Turn it off; if the provider rejects that, retry without.
  let noThink = /generativelanguage\.googleapis\.com/.test(o.baseUrl) && /flash/i.test(o.model);
  const attempt = async (strict: boolean, retry5xx = true): Promise<unknown> => {
    const common = {
      model: o.model,
      // Room for models that still "think" before answering (e.g. Gemini 2.5 Pro).
      max_tokens: o.maxTokens + (noThink ? 300 : 3000),
      temperature: 0.2,
      ...(noThink ? { reasoning_effort: 'none' } : {}),
    };
    const body = strict
      ? {
          ...common,
          messages: messages('\n\nRespond only with JSON matching the requested schema.'),
          response_format: { type: 'json_schema', json_schema: { name: 'result', schema: jsonSchema, strict: true } },
        }
      : {
          ...common,
          messages: messages(`\n\nRespond only with a single JSON object matching this JSON Schema, no other text:\n${JSON.stringify(jsonSchema)}`),
          response_format: { type: 'json_object' },
        };
    try {
      return await post(url, o.key, body);
    } catch (e) {
      // One retry for transient server errors. Not for 429: an immediate retry
      // would only use up more of the provider's per-minute quota.
      if (retry5xx && e instanceof ProviderError && e.status >= 500) {
        await new Promise((r) => setTimeout(r, 800));
        return attempt(strict, false);
      }
      throw e;
    }
  };

  let res: unknown;
  const is400 = (e: unknown) => e instanceof ProviderError && e.status === 400;
  try {
    res = await attempt(true);
  } catch (e) {
    if (!is400(e)) throw e;
    if (noThink) {
      noThink = false;
      try {
        res = await attempt(true);
      } catch (e2) {
        if (!is400(e2)) throw e2;
        res = await attempt(false);
      }
    } else res = await attempt(false);
  }
  const choice = (res as { choices?: { message?: { content?: string | null; refusal?: string | null }; finish_reason?: string }[] }).choices?.[0];
  if (choice?.message?.refusal) throw new ProviderError('The model declined this request.', 422);
  const content = choice?.message?.content;
  if (!content) throw new ProviderError(`Empty response${choice?.finish_reason ? ` (${choice.finish_reason})` : ''}.`);
  if (choice?.finish_reason === 'length') throw new ProviderError('The response was cut off (output limit reached).');
  const parsed = schema.safeParse(extractJson(content));
  if (!parsed.success) throw new ProviderError('The model’s JSON did not match the schema.');
  return parsed.data;
}
