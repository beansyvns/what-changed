import { describe, expect, it } from 'vitest';
import { checkedAssess, checkedInterpret, checkedReflect, parseTutorRequest, sanitizeAssess, sanitizeReflect } from '../shared/ai.js';
import { equivalent, parseExpr, toRational } from '../shared/math/expr.js';
import { cancelPack, valueAt } from '../shared/packs/cancel.js';
import { PACK_ORDER, PACKS } from '../shared/packs/index.js';
import { proportionPack } from '../shared/packs/proportion.js';
import { speedPack, trueAverage } from '../shared/packs/speed.js';
import { classify, pathFor } from '../shared/policy.js';
import { isQuoteOf, parseNumericAnswer } from '../shared/text.js';

describe('text helpers', () => {
  it('reads numeric answers', () => {
    expect(parseNumericAnswer('40 km/h')).toMatchObject({ kind: 'number', value: 40 });
    expect(parseNumericAnswer('120/3 = 40')).toMatchObject({ kind: 'number', value: 40 });
    expect(parseNumericAnswer('$23')).toMatchObject({ kind: 'number', value: 23 });
    expect(parseNumericAnswer('40 or 45').kind).toBe('ambiguous');
    expect(parseNumericAnswer('').kind).toBe('empty');
  });
  it('only accepts real quotes', () => {
    expect(isQuoteOf('(30 + 60) ÷ 2', 'so it is (30 + 60) ÷ 2 = 45')).toBe(true);
    expect(isQuoteOf('average of the speeds', 'so it is (30 + 60) ÷ 2 = 45')).toBe(false);
  });
});

describe('expression reader', () => {
  it('reads implicit multiplication tighter than division', () => {
    const a = parseExpr('8x/2x');
    expect(a.ok).toBe(true);
    if (a.ok) expect(equivalent(toRational(a.node), { num: [4], den: [1], excluded: [] })).toBe(true);
  });
  it('rejects x2', () => {
    expect(parseExpr('x2+1').ok).toBe(false);
  });
});

describe('every pack is internally consistent', () => {
  for (const id of PACK_ORDER) {
    const pack = PACKS[id];
    const cases = [pack.example, pack.contrast(pack.example), ...pack.transfers, pack.harder, ...pack.transfers.map(pack.followup)];
    it(`${id}: params validate and solve`, () => {
      for (const p of cases) {
        expect(pack.validate(p)).toEqual(p);
        expect(pack.solve(p).display.length).toBeGreaterThan(0);
        expect(pack.describe(p).text.length).toBeGreaterThan(10);
      }
    });
    it(`${id}: contrast flips whether the shortcut works`, () => {
      const f = pack.focus();
      expect(f.works(pack.example)).not.toBe(f.works(pack.contrast(pack.example)));
    });
    it(`${id}: sample work is classified as the shortcut`, () => {
      const p = pack.example;
      const check = pack.checkAnswer(p, pack.sampleWork.answer);
      expect(check.status).toBe('shortcut');
      const d = pack.detectMethod(p, pack.sampleWork.working, pack.sampleWork.answer);
      expect(d.methodId).toBe(pack.focus().id);
      for (const q of d.quotes) expect(isQuoteOf(q, pack.sampleWork.working)).toBe(true);
    });
    it(`${id}: hints have three tiers and the test prediction has a valid answer`, () => {
      for (const p of cases) {
        expect(pack.hints(p, 'repair').map((h) => h.tier)).toEqual([1, 2, 3]);
        const t = pack.testPrediction(p);
        expect(t.options.map((o) => o.id)).toContain(t.correct);
      }
    });
    it(`${id}: the checked solution is marked correct`, () => {
      for (const p of cases) {
        const answer = pack.answerKind === 'number' ? pack.solve(p).display.replace(/[^\d.$-]/g, ' ') : pack.solve(p).display;
        expect(pack.checkAnswer(p, answer).status, `${pack.key(p)} with "${answer}"`).toBe('correct');
      }
    });
  }
});

describe('speed pack', () => {
  it('computes the classic example', () => {
    expect(trueAverage(speedPack.example)).toBe(40);
    expect(speedPack.checkAnswer(speedPack.example, '40').status).toBe('correct');
    expect(speedPack.checkAnswer(speedPack.example, '45 km/h').status).toBe('shortcut');
  });
  it('reads a typed question', () => {
    const r = speedPack.parseQuestion('A car drives 60 km at 30 km/h and then 60 km at 60 km/h. What is its average speed?');
    expect(r?.params).toMatchObject({ mode: 'distance', a: 60, b: 60, s1: 30, s2: 60 });
  });
});

describe('cancel pack', () => {
  const p = cancelPack.example; // (x+8)/(x+2)
  it('accepts "cannot be simplified" with the restriction', () => {
    expect(cancelPack.checkAnswer(p, 'It cannot be simplified', 'x ≠ -2').status).toBe('correct');
    expect(cancelPack.checkAnswer(p, '(x+8)/(x+2), x ≠ -2').status).toBe('correct');
    expect(cancelPack.checkAnswer(p, '(x+8)/(x+2)').status).toBe('partial');
  });
  it('flags the shortcut', () => {
    expect(cancelPack.checkAnswer(p, '4').status).toBe('shortcut');
  });
  it('checks quadratics', () => {
    const q = { form: 'quad' as const, a: 5, b: 3 };
    expect(cancelPack.checkAnswer(q, '(x+5)/(x+3)', 'x ≠ 0, -3').status).toBe('correct');
    expect(cancelPack.checkAnswer(q, '(x^2+5x)/(x^2+3x)', 'x ≠ 0, -3').status).toBe('partial');
    expect(cancelPack.checkAnswer(q, '5/3').status).toBe('shortcut');
  });
  it('a single match is not proof: x = 0 matches in case A', () => {
    expect(valueAt(p, 0)).toBe(4);
    expect(valueAt(p, 2)).toBe(2.5);
  });
  it('reads a typed question', () => {
    expect(cancelPack.parseQuestion('Simplify (x^2+5x)/(x^2+3x)')?.params).toEqual({ form: 'quad', a: 5, b: 3 });
  });
});

describe('proportion pack', () => {
  const p = proportionPack.example;
  it('computes the taxi example', () => {
    expect(proportionPack.checkAnswer(p, '$23').status).toBe('correct');
    expect(proportionPack.checkAnswer(p, '26').status).toBe('shortcut');
  });
  it('reads a typed question', () => {
    const r = proportionPack.parseQuestion('A taxi charges a $3 pickup fee plus $2 per km. A 5 km ride costs $13. How much does a 10 km ride cost?');
    expect(r?.params).toEqual({ ctx: 'taxi', fee: 3, rate: 2, x1: 5, x2: 10 });
  });
});

describe('policy', () => {
  it('requires the shortcut answer and evidence for wrong_assumption', () => {
    expect(classify({ status: 'shortcut', hasWorking: true, methodKind: 'shortcut', methodWorks: false, signal: null })).toBe('wrong_assumption');
    expect(classify({ status: 'shortcut', hasWorking: true, methodKind: 'unclear', methodWorks: false, signal: 'unsure' })).toBe('wrong_unclear');
    expect(classify({ status: 'shortcut', hasWorking: true, methodKind: 'unclear', methodWorks: false, signal: 'assumption' })).toBe('wrong_assumption');
    expect(classify({ status: 'wrong', hasWorking: true, methodKind: 'shortcut', methodWorks: false, signal: 'assumption' })).toBe('wrong_unclear');
  });
  it('routes paths', () => {
    expect(pathFor('right_sound')).toBe('extend');
    expect(pathFor('wrong_slip')).toBe('slip');
    expect(pathFor('ambiguous')).toBe('clarify');
    expect(pathFor('wrong_assumption')).toBe('explore');
  });
});

describe('AI contract', () => {
  it('drops invented quotes and unapproved methods', () => {
    const req = { task: 'assess_attempt' as const, pack: 'speed' as const, params: speedPack.example, answer: '45', working: 'I did (30+60)/2' };
    const r = sanitizeAssess(req, { methodId: 'made_up', quotes: ['average of speeds'], confidence: 'high', noticed: '' });
    expect(r.methodId).toBe('unclear');
    expect(r.quotes).toEqual([]);
    const r2 = sanitizeAssess(req, { methodId: 'mean_of_speeds', quotes: ['average of speeds'], confidence: 'high', noticed: '' });
    expect(r2.confidence).toBe('low');
  });
  it('validates requests', () => {
    expect(typeof parseTutorRequest({ task: 'assess_attempt', pack: 'speed', params: { mode: 'distance', a: -1 } })).toBe('string');
    expect(typeof parseTutorRequest({ task: 'nope' })).toBe('string');
  });
  it('checked implementations work offline', () => {
    const a = checkedAssess({ task: 'assess_attempt', pack: 'speed', params: speedPack.example, answer: '45', working: speedPack.sampleWork.working });
    expect(a.methodId).toBe('mean_of_speeds');
    expect(checkedInterpret('Simplify (x+8)/(x+2)').pack).toBe('cancel');
    const req = { task: 'reflect_feedback' as const, pack: 'speed' as const, params: speedPack.example, stage: 'compare' as const, prompt: '', text: 'In case A it spends more time at 30.' };
    const f = checkedReflect(req);
    expect(f.mentionsCondition).toBe(true);
    expect(sanitizeReflect(req, f).quote).toBe(f.quote);
  });
});

describe('typed questions with inconsistent numbers', () => {
  it('rejects a stated cost that does not fit fee + rate × amount', () => {
    const r = proportionPack.parseQuestion('A taxi charges a $3 pickup fee plus $2 per km. A 5 km ride costs $20. How much does a 10 km ride cost?');
    expect(r?.params).toBeNull();
    expect(r?.missing?.[0]).toMatch(/fit together/);
  });
});

describe('reflect feedback hint policy', () => {
  const req = { task: 'reflect_feedback' as const, pack: 'speed' as const, params: speedPack.example, stage: 'compare' as const, prompt: '', text: 'In case A it spends more time at 30.' };
  it('never pushes a hint when the condition is named, and never auto-reveals the explanation', () => {
    expect(sanitizeReflect(req, { mentionsCondition: true, quote: 'more time at 30', feedback: 'ok', hintId: 'h3' }).hintId).toBe('none');
    expect(sanitizeReflect(req, { mentionsCondition: false, quote: '', feedback: 'ok', hintId: 'h3' }).hintId).toBe('h2');
  });
});

describe('"Why?" explanations', () => {
  it('explain every example, contrast and practice case in a few plain sentences', () => {
    for (const id of PACK_ORDER) {
      const pack = PACKS[id];
      const cases = [pack.example, pack.contrast(pack.example), ...pack.transfers, pack.harder];
      for (const p of cases) {
        const lines = pack.explainCase(p as never);
        expect(lines.length).toBeGreaterThanOrEqual(2);
        for (const l of lines) {
          expect(l.length).toBeGreaterThan(10);
          expect(l).not.toMatch(/NaN|undefined|Infinity/);
        }
      }
    }
  });

  it('uses the real numbers', () => {
    const lines = speedPack.explainCase(speedPack.example).join(' ');
    expect(lines).toContain('2 hours');
    expect(lines).toContain('= 40 km/h');
    expect(lines).toContain('too high');
  });
});
