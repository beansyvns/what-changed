import { afterEach, describe, expect, it } from 'vitest';
import { handleStatus, handleTutor } from '../api/_lib/handler.js';
import { speedPack } from '../shared/packs/speed.js';

const post = (body: unknown, raw = false) =>
  new Request('http://localhost/api/tutor', { method: 'POST', headers: { 'content-type': 'application/json' }, body: raw ? (body as string) : JSON.stringify(body) });

describe('API handler (demo mode)', () => {
  const saved = { ...process.env };
  afterEach(() => {
    process.env = { ...saved };
  });

  it('reports demo mode without a key and never exposes one', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const s = await handleStatus().json();
    expect(s.mode).toBe('demo');
    process.env.ANTHROPIC_API_KEY = 'sk-ant-secret-value';
    process.env.AI_MODE = 'demo';
    const text = await handleStatus().text();
    expect(text).not.toContain('sk-ant');
    expect(JSON.parse(text).mode).toBe('demo');
  });

  it('answers with checked guidance in demo mode, labelled as demo', async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const r = await handleTutor(post({ task: 'assess_attempt', pack: 'speed', params: speedPack.example, answer: '45', working: speedPack.sampleWork.working }));
    const body = await r.json();
    expect(r.status).toBe(200);
    expect(body.mode).toBe('demo');
    expect(body.result.methodId).toBe('mean_of_speeds');
  });

  it('rejects bad input', async () => {
    expect((await handleTutor(post('not json', true))).status).toBe(400);
    expect((await handleTutor(post({ task: 'assess_attempt', pack: 'nope' }))).status).toBe(400);
    expect((await handleTutor(post({ task: 'interpret_question', text: 'x'.repeat(20000) }))).status).toBe(413);
    expect((await handleTutor(new Request('http://localhost/api/tutor'))).status).toBe(405);
  });
});
