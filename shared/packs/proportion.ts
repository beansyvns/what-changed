// Concept pack 3 — Proportional reasoning: proportional versus linear with a fixed fee.
// Shortcut under test: scaling the total cost (double the distance, double the cost).
// It is valid only when there is no fixed part — when 0 units would cost $0.

import { closeTo, fmtPlain, money, parseNumericAnswer } from '../text.js';
import type { AnswerCheck, ChoiceQuestion, ConceptPack, Diagnostic, Focus, Hint, MethodOption, SlipStep } from './types.js';

export type Ctx = 'taxi' | 'gym' | 'plumber' | 'generic';

export interface PropParams {
  ctx: Ctx;
  fee: number;
  rate: number;
  x1: number;
  x2: number;
}

interface CtxInfo {
  who: string;
  feeName: string;
  unit: string;
  units: string;
  thing: (x: number) => string;
  defaultFee: number;
}

const CTX: Record<Ctx, CtxInfo> = {
  taxi: { who: 'A taxi company', feeName: 'pickup fee', unit: 'km', units: 'km', thing: (x) => `a ${fmtPlain(x)} km ride`, defaultFee: 3 },
  gym: { who: 'A gym', feeName: 'joining fee', unit: 'month', units: 'months', thing: (x) => `${fmtPlain(x)} month${x === 1 ? '' : 's'} of membership`, defaultFee: 20 },
  plumber: { who: 'A plumber', feeName: 'call-out fee', unit: 'hour', units: 'hours', thing: (x) => `a ${fmtPlain(x)}-hour job`, defaultFee: 40 },
  generic: { who: 'A company', feeName: 'fixed fee', unit: 'unit', units: 'units', thing: (x) => `${fmtPlain(x)} unit${x === 1 ? '' : 's'}`, defaultFee: 5 },
};

export const ctxInfo = (c: Ctx) => CTX[c];
export const cost = (p: PropParams, x: number) => p.fee + p.rate * x;
export const c1 = (p: PropParams) => cost(p, p.x1);
export const answerValue = (p: PropParams) => cost(p, p.x2);
export const scaledValue = (p: PropParams) => (c1(p) * p.x2) / p.x1;
export const proportional = (p: PropParams) => Math.abs(p.fee) < 1e-9;
const k = (p: PropParams) => p.x2 / p.x1;
const factorWord = (p: PropParams) => {
  const r = k(p);
  if (Math.abs(r - 2) < 1e-9) return 'double';
  if (Math.abs(r - 3) < 1e-9) return 'triple';
  if (Math.abs(r - 0.5) < 1e-9) return 'half';
  return `${fmtPlain(r)} times`;
};

const methods: MethodOption<PropParams>[] = [
  {
    id: 'scale_total',
    kind: 'shortcut',
    label: 'Scaled the whole cost up (e.g. doubled it)',
    restate: 'It looks like you scaled the whole cost by the same factor as the distance or time.',
    aiHint: 'Multiplying the given total cost by x2/x1, e.g. "10 km is double 5 km so 13 × 2", or finding cost per unit as total ÷ units and multiplying.',
    worksFor: proportional,
  },
  {
    id: 'fee_plus_rate',
    kind: 'sound',
    label: 'Used fixed fee + price per unit × number of units',
    restate: 'It looks like you separated the fixed fee from the part that grows, then used fee + rate × amount.',
    aiHint: 'Building the cost as fixed fee plus rate times amount, e.g. "3 + 2 × 10".',
    worksFor: () => true,
  },
  {
    id: 'add_extra',
    kind: 'alternative',
    label: 'Added the cost of the extra units to the known cost',
    restate: 'It looks like you took the known cost and added the price of the extra units.',
    aiHint: 'Starting from the known total and adding rate × (x2 − x1), e.g. "13 + 5 × 2".',
    worksFor: () => true,
  },
  {
    id: 'unclear',
    kind: 'unclear',
    label: 'Something else, or I’m not sure',
    restate: 'I couldn’t tell which method you used from the working.',
    aiHint: 'Use when the working does not show a recognisable method.',
    worksFor: () => false,
  },
];

const focusScale: Focus<PropParams> = {
  id: 'scale_total',
  name: 'scaling the whole cost',
  works: proportional,
  result: (p) => money(scaledValue(p)),
};

function describe(p: PropParams) {
  const c = CTX[p.ctx];
  const feePart = p.fee > 0 ? `a ${money(p.fee)} ${c.feeName}` : `no ${c.feeName}`;
  const ratePart = `${money(p.rate)} per ${c.unit}`;
  const parts =
    p.fee > 0
      ? [`${c.who} charges `, { mark: feePart }, ` plus ${ratePart}. `, `${cap(c.thing(p.x1))} costs ${money(c1(p))}. How much does ${c.thing(p.x2)} cost?`]
      : [`${c.who} charges ${ratePart}, with `, { mark: feePart }, `. `, `${cap(c.thing(p.x1))} costs ${money(c1(p))}. How much does ${c.thing(p.x2)} cost?`];
  const text = parts.map((x) => (typeof x === 'string' ? x : x.mark)).join('');
  return { parts, text };
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

function solve(p: PropParams) {
  const c = CTX[p.ctx];
  const steps =
    p.fee > 0
      ? [
          `The ${c.feeName} is ${money(p.fee)} whatever the ${c.unit === 'km' ? 'distance' : 'length'}. Only the ${money(p.rate)} per ${c.unit} part grows.`,
          `Check: ${money(p.fee)} + ${money(p.rate)} × ${fmtPlain(p.x1)} = ${money(c1(p))} ✓`,
          `Cost for ${fmtPlain(p.x2)} ${c.units} = ${money(p.fee)} + ${money(p.rate)} × ${fmtPlain(p.x2)} = ${money(answerValue(p))}`,
        ]
      : [
          `There is no ${c.feeName}, so 0 ${c.units} cost $0 and the cost is proportional.`,
          `Cost for ${fmtPlain(p.x2)} ${c.units} = ${money(p.rate)} × ${fmtPlain(p.x2)} = ${money(answerValue(p))}`,
        ];
  return { display: money(answerValue(p)), steps };
}

const esc = (n: number) => fmtPlain(n).replace('.', '\\.');

export const proportionPack: ConceptPack<PropParams> = {
  id: 'proportion',
  title: 'Proportional reasoning',
  distinction: 'Proportional vs fixed fee',
  subject: 'Maths',
  blurb: 'A price with a fixed fee and a price per unit. Twice as far — twice the cost?',
  coreQuestion: 'When does doubling the amount double the cost?',
  rule: 'Scaling the whole cost only works when the cost is proportional — when 0 units would cost $0. With a fixed fee, only the per-unit part scales.',
  answerKind: 'number',
  example: { ctx: 'taxi', fee: 3, rate: 2, x1: 5, x2: 10 },
  sampleWork: {
    answer: '$26',
    working: '10 km is double 5 km, so the cost doubles: 13 × 2 = $26.',
  },
  methods,

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const ctx: Ctx = r.ctx === 'taxi' || r.ctx === 'gym' || r.ctx === 'plumber' ? r.ctx : 'generic';
    const fee = Number(r.fee);
    const rate = Number(r.rate);
    const x1 = Number(r.x1);
    const x2 = Number(r.x2);
    if (![fee, rate, x1, x2].every(Number.isFinite)) return null;
    if (fee < 0 || fee > 100000 || rate <= 0 || rate > 100000 || x1 <= 0 || x2 <= 0 || x1 > 10000 || x2 > 10000) return null;
    if (Math.abs(x1 - x2) < 1e-9) return null;
    return { ctx, fee, rate, x1, x2 };
  },

  describe,
  unitLabel: () => '$',
  solve,

  focus: () => focusScale,

  contrast(p) {
    if (p.fee > 0) return { ...p, fee: 0 };
    return { ...p, fee: CTX[p.ctx].defaultFee };
  },

  explainCase(p) {
    const c = CTX[p.ctx];
    const times = fmtPlain(k(p));
    const lines = [
      p.fee > 0
        ? `Each ${c.unit} costs ${money(p.rate)}, plus a ${money(p.fee)} ${c.feeName} that you pay only once.`
        : `Each ${c.unit} costs ${money(p.rate)}, and there’s no fixed fee.`,
      `${cap(c.thing(p.x2))}: ${p.fee > 0 ? `${money(p.fee)} + ` : ''}${fmtPlain(p.x2)} × ${money(p.rate)} = ${money(answerValue(p))}.`,
    ];
    lines.push(
      proportional(p)
        ? `With no fixed fee, the cost grows in step with the ${c.units}: ${times} times the ${c.units} means ${times} times the cost. So scaling ${money(c1(p))} works.`
        : `Scaling ${money(c1(p))} by ${times} gives ${money(scaledValue(p))}. That multiplies the ${c.feeName} too — but it’s only paid once, so the shortcut is off by ${money(Math.abs(scaledValue(p) - answerValue(p)))}.`,
    );
    return lines;
  },

  whatChanged(a, b): ChoiceQuestion {
    const c = CTX[a.ctx];
    const desc = (p: PropParams) => (p.fee > 0 ? `a ${money(p.fee)} ${c.feeName}` : `no ${c.feeName}`);
    return {
      question: 'What changed between case A and case B?',
      options: [
        { id: 'rate', label: `The price per ${c.unit} changed` },
        { id: 'condition', label: `${cap(desc(a))} became ${desc(b)}` },
        { id: 'amount', label: `The number of ${c.units} changed` },
        { id: 'none', label: 'Nothing important changed' },
      ],
      correct: 'condition',
      explain: `The price per ${c.unit} (${money(a.rate)}) and the ${c.units} stay the same. Only the fixed part changed: ${desc(a)} → ${desc(b)}.`,
    };
  },

  preserve(p) {
    const c = CTX[p.ctx];
    const q = { ...p, rate: p.rate + 1 };
    return {
      change: `The price per ${c.unit} in case A goes up to ${money(q.rate)}. The ${c.feeName} stays ${money(p.fee)}.`,
      question: `Does “fixed fee + price per ${c.unit} × ${c.units}” still give the right cost?`,
      options: [
        { id: 'yes', label: 'Yes, it still works' },
        { id: 'no', label: 'No, it breaks' },
        { id: 'unsure', label: 'Not sure' },
      ],
      correct: 'yes',
      explain: `It still works: ${money(q.fee)} + ${money(q.rate)} × ${fmtPlain(q.x2)} = ${money(answerValue(q))}. Changing the price doesn’t change the structure of the cost — not every change matters.`,
    };
  },

  testPrediction(p) {
    const c = CTX[p.ctx];
    const actual = answerValue(p);
    const scaled = scaledValue(p);
    const word = factorWord(p);
    const correct = Math.abs(actual - scaled) < 1e-9 ? 'exact' : actual < scaled ? 'less' : 'more';
    return {
      question: `Compared with ${c.thing(p.x1)}, how will the cost of ${c.thing(p.x2)} compare?`,
      options: [
        { id: 'less', label: `Less than ${word} the cost` },
        { id: 'exact', label: `Exactly ${word} the cost` },
        { id: 'more', label: `More than ${word} the cost` },
      ],
      correct,
      explain: `${money(c1(p))} → ${money(actual)}. ${word === 'double' ? 'Doubling' : `Scaling by ${fmtPlain(k(p))}`} would give ${money(scaled)}.`,
    };
  },

  statements: [
    { id: 'rule', text: 'Total cost = fixed fee + price per unit × number of units', kind: 'both', why: 'This describes both cases; in one of them the fee is just $0.' },
    { id: 'step', text: 'Each extra unit adds the same amount', kind: 'both', why: 'The price per unit is constant in both cases.' },
    { id: 'double', text: 'Double the amount, double the cost', kind: 'depends', why: 'Only true when there is no fixed fee.' },
    { id: 'zero', text: '0 units cost $0', kind: 'depends', why: 'Only true when there is no fixed fee.' },
  ],

  ruleQuestion: {
    question: 'When does doubling the amount double the cost?',
    options: [
      { id: 'always', label: 'Always' },
      { id: 'nofee', label: 'Only when there is no fixed fee (0 units cost $0)' },
      { id: 'whole', label: 'When the price per unit is a whole number' },
      { id: 'never', label: 'Never' },
    ],
    correct: 'nofee',
    explain: 'Doubling the amount doubles the per-unit part, but a fixed fee is paid only once. So the total only doubles when the fee is $0.',
  },

  diagnostic(p): Diagnostic {
    const c = CTX[p.ctx];
    const zero = proportional(p);
    return {
      question: `If it were 0 ${c.units}, would it cost $0?`,
      options: [
        { id: 'yes', label: 'Yes, $0', signal: zero ? 'sound' : 'assumption' },
        { id: 'no', label: 'No, there would still be a cost', signal: zero ? 'assumption' : 'sound' },
        { id: 'unsure', label: 'I’m not sure', signal: 'unsure' },
      ],
    };
  },

  hints(p, role): Hint[] {
    const c = CTX[p.ctx];
    const s = solve(p);
    const worked = `${s.steps.join(' ')} Scaling the whole cost would give ${money(scaledValue(p))}${
      proportional(p) ? ', which matches here because there is no fixed fee.' : ', which counts the fee more than once.'
    }`;
    return [
      {
        tier: 1,
        id: 'h1',
        label: 'Hint 1 · a prompt',
        text: role === 'transfer' ? `Is any part of the cost paid only once, whatever the number of ${c.units}?` : `Which part of the cost grows with the ${c.units}, and which part doesn’t?`,
      },
      {
        tier: 2,
        id: 'h2',
        label: 'Hint 2 · a concrete test',
        text: `What would 0 ${c.units} cost? ${p.fee > 0 ? `${money(p.fee)} — the fee.` : '$0.'} Now build the cost for ${fmtPlain(p.x2)} ${c.units}: fee + ${money(p.rate)} × ${fmtPlain(p.x2)}.`,
      },
      { tier: 3, id: 'h3', label: 'Worked explanation', text: worked },
    ];
  },

  prerequisite: {
    title: 'Quick refresher: proportional means “0 costs 0”',
    body: [
      'Two amounts are proportional when one is always the same multiple of the other — double one, double the other.',
      'A proportional cost starts at $0: 0 units cost nothing.',
      'A fixed fee is paid once. Cost = fee + price per unit × units, which is linear but not proportional.',
    ],
  },

  slipSteps(p): SlipStep[] {
    const c = CTX[p.ctx];
    return [
      { id: 'fee', label: `The ${c.feeName}`, kind: 'number', expected: p.fee, unit: '$' },
      { id: 'grow', label: `Per-${c.unit} part for ${fmtPlain(p.x2)} ${c.units} (${money(p.rate)} × ${fmtPlain(p.x2)})`, kind: 'number', expected: p.rate * p.x2, unit: '$' },
      { id: 'total', label: 'Total cost', kind: 'number', expected: answerValue(p), unit: '$' },
    ];
  },

  checkAnswer(p, answer): AnswerCheck {
    const parsed = parseNumericAnswer(answer);
    if (parsed.kind === 'empty') return { status: 'empty', read: 'No answer yet.', note: '' };
    if (parsed.kind === 'none') return { status: 'unparsed', read: `I couldn’t find a number in “${answer.trim()}”.`, note: 'Please give your final answer as a number.' };
    if (parsed.kind === 'ambiguous')
      return { status: 'ambiguous', read: `I found more than one number: ${parsed.values.map((v) => money(v)).join(' and ')}.`, note: 'Which one is your final answer?' };
    const v = parsed.value;
    const read = money(v);
    if (closeTo(v, answerValue(p))) return { status: 'correct', read, note: `${read} is right.` };
    if (!proportional(p) && closeTo(v, scaledValue(p))) return { status: 'shortcut', read, note: `${read} is what scaling the whole cost gives. That’s not the right answer here.` };
    return { status: 'wrong', read, note: `${read} isn’t the right answer.` };
  },

  detectMethod(p, working, answer) {
    const text = working;
    const found: { id: string; quote: string }[] = [];
    const tryAdd = (id: string, re: RegExp) => {
      const m = re.exec(text);
      if (m && m[0].trim().length >= 2) found.push({ id, quote: m[0].trim() });
      return !!m;
    };
    const C1 = esc(c1(p));
    const K = esc(k(p));
    tryAdd('scale_total', new RegExp(String.raw`\$?${C1}\s*[x*×·]\s*${K}(?![\d.])`, 'i')) ||
      tryAdd('scale_total', new RegExp(String.raw`(?<![\d.])${K}\s*[x*×·]\s*\$?${C1}(?![\d.])`, 'i')) ||
      tryAdd('scale_total', /\b(?:double|doubles|doubled|twice|triple|half)\b[^.]*?\b(?:cost|price|fare|so|=)/i) ||
      tryAdd('scale_total', new RegExp(String.raw`\$?${C1}\s*(?:\/|÷)\s*${esc(p.x1)}(?![\d.])`, 'i')) ||
      tryAdd('scale_total', /\bproportional\b|\bscale[ds]?\b/i);
    tryAdd('fee_plus_rate', new RegExp(String.raw`\$?${esc(p.fee)}\s*\+\s*\$?${esc(p.rate)}\s*[x*×·(]`, 'i')) ||
      tryAdd('fee_plus_rate', new RegExp(String.raw`\$?${esc(p.rate)}\s*[x*×·]\s*${esc(p.x2)}(?![\d.])`, 'i')) ||
      tryAdd('fee_plus_rate', /\b(?:fee|fixed)\b[^.]*?\b(?:plus|\+|add)/i);
    tryAdd('add_extra', new RegExp(String.raw`\$?${C1}\s*\+\s*\$?\d`, 'i')) || tryAdd('add_extra', /\bextra\s+(?:km|kilomet|hours?|months?|units?)\b/i);
    if (found.length === 0) return { methodId: 'unclear', quotes: [] };
    const parsed = parseNumericAnswer(answer);
    const value = parsed.kind === 'number' ? parsed.value : NaN;
    const pick = (id: string) => found.filter((f) => f.id === id);
    let chosen: string;
    if (Number.isFinite(value) && closeTo(value, scaledValue(p)) && pick('scale_total').length) chosen = 'scale_total';
    else if (pick('fee_plus_rate').length) chosen = 'fee_plus_rate';
    else if (pick('add_extra').length) chosen = 'add_extra';
    else chosen = 'scale_total';
    return { methodId: chosen, quotes: pick(chosen).map((f) => f.quote).slice(0, 2) };
  },

  transfers: [
    { ctx: 'gym', fee: 20, rate: 15, x1: 4, x2: 8 },
    { ctx: 'taxi', fee: 4, rate: 3, x1: 6, x2: 12 },
    { ctx: 'generic', fee: 5, rate: 4, x1: 10, x2: 30 },
  ],
  followup: (t) => (t.fee > 0 ? { ...t, fee: 0 } : { ...t, fee: CTX[t.ctx].defaultFee }),
  harder: { ctx: 'plumber', fee: 40, rate: 30, x1: 2, x2: 5 },

  parseQuestion(text) {
    if (!/\$|£|€|cost|price|fee|charge|fare/i.test(text)) return null;
    const t = text.replace(/,(\d{3})/g, '$1');
    const NUMS = String.raw`(\d+(?:\.\d+)?)`;
    const ctx: Ctx = /taxi|cab|ride|fare/i.test(t) ? 'taxi' : /gym|member/i.test(t) ? 'gym' : /plumber|electrician|call-?out/i.test(t) ? 'plumber' : 'generic';
    const feeM = new RegExp(String.raw`[$£€]\s*${NUMS}\s*(?:fixed\s+|flat\s+|one-?off\s+)?(?:pick-?up|joining|call-?out|booking|fixed|flat|base|starting|sign-?up)?\s*(?:fee|charge)`, 'i').exec(t);
    const noFee = /\bno\s+(?:\w+\s+)?fee\b/i.test(t);
    const rateM = new RegExp(String.raw`[$£€]\s*${NUMS}\s*(?:per|an?|each|\/)\s*(km|kilomet\w*|mile|hour|hr|month|unit|day|kg|item)`, 'i').exec(t);
    const unitWord = String.raw`(?:km|kilomet\w*|miles?|hours?|hrs?|h|months?|units?|days?|kg|items?)`;
    const amounts = [...t.matchAll(new RegExp(String.raw`(?<![$£€\d.])${NUMS}\s*-?\s*${unitWord}\b`, 'gi'))]
      .filter((m) => !rateM || m.index !== rateM.index)
      .map((m) => parseFloat(m[1]));
    const fee = feeM ? parseFloat(feeM[1]) : noFee ? 0 : undefined;
    const rate = rateM ? parseFloat(rateM[1]) : undefined;
    const partial: Partial<PropParams> = { ctx, fee, rate, x1: amounts[0], x2: amounts[1] };
    const missing: string[] = [];
    if (fee === undefined) missing.push('the fixed fee (or say there is none)');
    if (rate === undefined) missing.push('the price per unit');
    if (amounts.length < 2) missing.push('the two amounts (e.g. 5 km and 10 km)');
    if (missing.length) return { params: null, partial, missing };
    // If the question states a total for the first amount, it must agree with fee + rate × amount.
    const stated = new RegExp(String.raw`cost\w*\s+[$£€]\s*${NUMS}`, 'i').exec(t);
    if (stated && Math.abs(parseFloat(stated[1]) - (fee! + rate! * amounts[0])) > 1e-6)
      return { params: null, partial, missing: [`numbers that fit together (${money(fee!)} + ${money(rate!)} × ${amounts[0]} isn’t ${money(parseFloat(stated[1]))})`] };
    const params = proportionPack.validate(partial);
    return params ? { params } : { params: null, partial, missing: ['two different amounts and a positive price'] };
  },

  key: (p) => `${p.ctx}:${p.fee}:${p.rate}:${p.x1}:${p.x2}`,
};
