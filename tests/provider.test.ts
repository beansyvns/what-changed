import { afterEach, describe, expect, it, vi } from 'vitest';
import { aiConfig } from '../api/_lib/config.js';
import { handleTutor } from '../api/_lib/handler.js';
import { cacheClear } from '../api/_lib/saver.js';
import { speedPack } from '../shared/packs/speed.js';

const saved = { ...process.env };
afterEach(() => {
  process.env = { ...saved };
  vi.unstubAllGlobals();
  cacheClear();
});

function useGemini() {
  delete process.env.ANTHROPIC_API_KEY;
  delete process.env.AI_MODE;
  process.env.AI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/openai/';
  process.env.AI_API_KEY = 'test-key';
  process.env.AI_MODEL = 'gemini-test';
  // These tests exercise the provider itself, so always call it.
  process.env.AI_SAVER = 'off';
}

const assessReq = () =>
  new Request('http://localhost/api/tutor', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ task: 'assess_attempt', pack: 'speed', params: speedPack.example, answer: '45', working: 'I did (30 + 60) / 2 = 45' }),
  });

const reply = (content: string, status = 200) => new Response(JSON.stringify({ choices: [{ message: { content } }] }), { status });

describe('OpenAI-compatible provider', () => {
  it('detects Gemini from the base URL', () => {
    useGemini();
    const c = aiConfig();
    expect(c).toMatchObject({ mode: 'live', kind: 'openai', provider: 'Google (Gemini)', baseUrl: 'https://generativelanguage.googleapis.com/v1beta/openai' });
  });

  it('stays in demo mode when a setting is missing', () => {
    useGemini();
    delete process.env.AI_MODEL;
    expect(aiConfig()).toMatchObject({ mode: 'demo', reason: 'AI_MODEL is not configured' });
  });

  it('parses JSON (even in a code fence) and still sanitises it', async () => {
    useGemini();
    const fetchMock = vi.fn(async () =>
      reply('```json\n{"methodId":"mean_of_speeds","quotes":["(30 + 60) / 2","invented quote"],"confidence":"high","noticed":""}\n```'),
    );
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(assessReq())).json();
    expect(body.mode).toBe('live');
    expect(body.result.methodId).toBe('mean_of_speeds');
    expect(body.result.quotes).toEqual(['(30 + 60) / 2']);
    const [url, init] = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://generativelanguage.googleapis.com/v1beta/openai/chat/completions');
    expect((init.headers as Record<string, string>).authorization).toBe('Bearer test-key');
  });

  it('falls back to plain JSON mode when strict schemas are rejected', async () => {
    useGemini();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('bad response_format', { status: 400 }))
      .mockResolvedValueOnce(reply('{"methodId":"unclear","quotes":[],"confidence":"low","noticed":""}'));
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(assessReq())).json();
    expect(body.ok).toBe(true);
    expect(JSON.parse((fetchMock.mock.calls[1][1] as RequestInit).body as string).response_format.type).toBe('json_object');
  });

  it('reports failure (so the browser uses labelled fallback guidance) when the provider is down', async () => {
    useGemini();
    vi.stubGlobal('fetch', vi.fn(async () => new Response('down', { status: 503 })));
    const r = await handleTutor(assessReq());
    expect(r.status).toBe(502);
    expect((await r.json()).ok).toBe(false);
  });
});

describe('whiteboard reading (read_board)', () => {
  const IMG = 'data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAP' + 'A'.repeat(200) + '==';
  const boardReq = (image: string) =>
    new Request('http://localhost/api/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'read_board', pack: 'speed', params: speedPack.example, image }),
    });

  it('sends the image to the model and returns a cleaned-up transcript', async () => {
    useGemini();
    const fetchMock = vi.fn(async () => reply('{"working":"  30 + 60 = 90 \\n\\n 90 / 2   = 45  ","answer":"45 km/h","legible":true}'));
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(boardReq(IMG))).json();
    expect(body.ok).toBe(true);
    expect(body.result).toEqual({ working: '30 + 60 = 90\n90 / 2 = 45', answer: '45 km/h', legible: true });
    const sent = JSON.parse((fetchMock.mock.calls[0] as unknown as [string, RequestInit])[1].body as string);
    const user = sent.messages[1].content;
    expect(user[1]).toEqual({ type: 'image_url', image_url: { url: IMG } });
  });

  it('treats an empty reading as not legible', async () => {
    useGemini();
    vi.stubGlobal('fetch', vi.fn(async () => reply('{"working":"","answer":"","legible":true}')));
    const body = await (await handleTutor(boardReq(IMG))).json();
    expect(body.result.legible).toBe(false);
  });

  it('rejects non-images and oversized images, and keeps the small limit for text tasks', async () => {
    useGemini();
    vi.stubGlobal('fetch', vi.fn(async () => reply('{}')));
    expect((await handleTutor(boardReq('data:image/svg+xml;base64,PHN2Zz4='))).status).toBe(400);
    expect((await handleTutor(boardReq('javascript:alert(1)'))).status).toBe(400);
    expect((await handleTutor(boardReq('data:image/png;base64,' + 'A'.repeat(700_000)))).status).toBe(413);
    const bigText = new Request('http://localhost/api/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'interpret_question', text: 'a speed question', pad: 'x'.repeat(50_000) }),
    });
    expect((await handleTutor(bigText)).status).toBe(413);
  });

  it('never reads a board in demo mode', async () => {
    delete process.env.AI_BASE_URL;
    delete process.env.AI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(boardReq(IMG))).json();
    expect(body.mode).toBe('demo');
    expect(body.result.legible).toBe(false);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('provider usage limits', () => {
  it('reports "busy" on a 429 and does not waste quota on an instant retry', async () => {
    useGemini();
    const fetchMock = vi.fn(async () => new Response('quota exceeded', { status: 429 }));
    vi.stubGlobal('fetch', fetchMock);
    const r = await handleTutor(assessReq());
    expect(r.status).toBe(503);
    expect((await r.json()).error).toMatch(/busy/);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});

describe('saving AI requests (AI_SAVER, on by default)', () => {
  const sampleReq = () =>
    new Request('http://localhost/api/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'assess_attempt', pack: 'speed', params: speedPack.example, answer: '45', working: speedPack.sampleWork.working }),
    });
  const vagueReq = () =>
    new Request('http://localhost/api/tutor', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ task: 'assess_attempt', pack: 'speed', params: speedPack.example, answer: '45', working: 'I just thought about it' }),
    });

  it('skips the AI when the checked rules are confident, and labels it as checked', async () => {
    useGemini();
    delete process.env.AI_SAVER;
    const fetchMock = vi.fn();
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(sampleReq())).json();
    expect(body.mode).toBe('checked');
    expect(body.result.methodId).toBe('mean_of_speeds');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('asks the AI once for unclear working, then reuses the answer for an identical request', async () => {
    useGemini();
    delete process.env.AI_SAVER;
    const fetchMock = vi.fn(async () => reply('{"methodId":"unclear","quotes":[],"confidence":"low","noticed":""}'));
    vi.stubGlobal('fetch', fetchMock);
    const first = await (await handleTutor(vagueReq())).json();
    const second = await (await handleTutor(vagueReq())).json();
    expect(first.mode).toBe('live');
    expect(second.cached).toBe(true);
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it('turns off Gemini Flash "thinking", and retries without it if the provider refuses', async () => {
    useGemini();
    process.env.AI_MODEL = 'gemini-2.5-flash';
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(new Response('unknown field reasoning_effort', { status: 400 }))
      .mockResolvedValueOnce(reply('{"methodId":"unclear","quotes":[],"confidence":"low","noticed":""}'));
    vi.stubGlobal('fetch', fetchMock);
    const body = await (await handleTutor(assessReq())).json();
    expect(body.ok).toBe(true);
    const sent = (i: number) => JSON.parse((fetchMock.mock.calls[i][1] as RequestInit).body as string);
    expect(sent(0).reasoning_effort).toBe('none');
    expect(sent(1).reasoning_effort).toBeUndefined();
    expect(sent(1).response_format.type).toBe('json_schema');
  });
});
