// Concept pack 2 — Cancelling in algebraic fractions: factors versus terms.
// Shortcut under test: crossing out the x in the top and the bottom. It is valid
// only when x is a factor of the whole top and the whole bottom.

import {
  equivalent,
  exclusionsText,
  isCannotSimplifyPhrase,
  isSimplified,
  parseExclusions,
  parseExpr,
  sameSet,
  splitAnswerAndExclusions,
  toRational,
  toText,
  type Rational,
} from '../math/expr.js';
import * as P from '../math/poly.js';
import { fmt, fractionText } from '../text.js';
import type { AnswerCheck, ChoiceQuestion, ConceptPack, Diagnostic, Focus, Hint, MethodOption, SlipStep } from './types.js';

export interface CancelParams {
  /** sum: (x+a)/(x+b) · product: (ax)/(bx) · quad: (x²+ax)/(x²+bx) */
  form: 'sum' | 'product' | 'quad';
  a: number;
  b: number;
}

const neg = (s: string) => s.replace(/-/g, '−');
const signed = (n: number) => (n < 0 ? ` − ${-n}` : ` + ${n}`);

export function topText(p: CancelParams): string {
  if (p.form === 'sum') return `x${signed(p.a)}`;
  if (p.form === 'product') return `${neg(String(p.a))}x`;
  return `x²${signed(p.a)}x`;
}
export function bottomText(p: CancelParams): string {
  if (p.form === 'sum') return `x${signed(p.b)}`;
  if (p.form === 'product') return `${neg(String(p.b))}x`;
  return `x²${signed(p.b)}x`;
}
export const exprText = (p: CancelParams) => `(${topText(p)}) / (${bottomText(p)})`;

export function original(p: CancelParams): Rational {
  if (p.form === 'sum') return { num: [p.a, 1], den: [p.b, 1], excluded: [-p.b] };
  if (p.form === 'product') return { num: [0, p.a], den: [0, p.b], excluded: [0] };
  return { num: [0, p.a, 1], den: [0, p.b, 1], excluded: [-p.b, 0].sort((x, y) => x - y) };
}

export const excluded = (p: CancelParams) => original(p).excluded;
export const shortcutValue = (p: CancelParams) => p.a / p.b;
export const xIsFactor = (p: CancelParams) => p.form !== 'sum';

export function valueAt(p: CancelParams, x: number): number | null {
  const den = P.evaluate(original(p).den, x);
  if (Math.abs(den) < 1e-12) return null;
  return P.evaluate(original(p).num, x) / den;
}

/** Simplified form as text, e.g. "(x + 5)/(x + 3)". */
export function simplifiedText(p: CancelParams): string {
  if (p.form === 'product') return neg(fractionText(p.a, p.b));
  return `(x${signed(p.a)})/(x${signed(p.b)})`;
}

/** A sensible x to test with: small, positive, allowed, and where the shortcut visibly fails if it can. */
export function testX(p: CancelParams): number {
  for (const x of [2, 3, 1, 4, 5]) if (!excluded(p).includes(x)) return x;
  return 7;
}

const methods: MethodOption<CancelParams>[] = [
  {
    id: 'cancel_terms',
    kind: 'shortcut',
    label: 'Crossed out the x in the top and the bottom',
    restate: 'It looks like you crossed out the x that appears in the top and the bottom, leaving just the numbers.',
    aiHint: 'Cancelling x (or x²) wherever it appears, even when it is added rather than multiplied, e.g. "the x’s cancel so 8/2 = 4".',
    worksFor: xIsFactor,
  },
  {
    id: 'factor_first',
    kind: 'sound',
    label: 'Factorised the top and the bottom first, then cancelled common factors',
    restate: 'It looks like you factorised the top and the bottom and cancelled only what they have in common.',
    aiHint: 'Writing the top and bottom as products (e.g. "x(x+5)") and cancelling common factors, or stating there is no common factor.',
    worksFor: () => true,
  },
  {
    id: 'substitute',
    kind: 'alternative',
    label: 'Tested values of x to check',
    restate: 'It looks like you substituted values of x to see what the fraction does.',
    aiHint: 'Substituting numbers for x (e.g. "if x = 2 ...") to compare the original and a simplified version.',
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

const focusCancel: Focus<CancelParams> = {
  id: 'cancel_terms',
  name: 'crossing out the x in the top and the bottom',
  works: xIsFactor,
  // For x² forms, cancelling the factor x leaves (x + a)/(x + b), not a/b.
  result: (p) => (p.form === 'quad' ? neg(simplifiedText(p)) : neg(fractionText(p.a, p.b))),
};

function describe(p: CancelParams) {
  const parts = ['Simplify  (', { mark: topText(p) }, ') / (', { mark: bottomText(p) }, ')  and state any values x cannot take.'];
  const text = parts.map((x) => (typeof x === 'string' ? x : x.mark)).join('').replace(/\s{2,}/g, ' ');
  return { parts, text };
}

function solve(p: CancelParams) {
  const ex = neg(exclusionsText(excluded(p)));
  if (p.form === 'sum')
    return {
      display: `${neg(exprText(p))} cannot be simplified; ${ex}`,
      steps: [
        `The top, ${topText(p)}, is a sum: x is added to ${neg(String(p.a))}, not multiplied. So x is not a factor of the whole top.`,
        `${topText(p)} and ${bottomText(p)} have no common factor, so nothing can be cancelled.`,
        `The bottom is 0 when x = ${neg(String(-p.b))}, so ${ex}.`,
        `Answer: ${neg(exprText(p))} cannot be simplified; ${ex}.`,
      ],
    };
  if (p.form === 'product')
    return {
      display: `${simplifiedText(p)}, ${ex}`,
      steps: [
        `${topText(p)} = ${neg(String(p.a))} × x and ${bottomText(p)} = ${neg(String(p.b))} × x, so x is a factor of the whole top and the whole bottom.`,
        `Cancel the common factor x: ${neg(String(p.a))}/${neg(String(p.b))} = ${simplifiedText(p)}.`,
        `The original divides by ${bottomText(p)}, which is 0 when x = 0, so ${ex}.`,
      ],
    };
  return {
    display: `${simplifiedText(p)}, ${ex}`,
    steps: [
      `Factorise the top: ${topText(p)} = x(x${signed(p.a)}).`,
      `Factorise the bottom: ${bottomText(p)} = x(x${signed(p.b)}).`,
      `x is a common factor of the whole top and bottom, so cancel it: ${simplifiedText(p)}.`,
      `The original bottom is 0 when x = 0 or x = ${neg(String(-p.b))}, so ${ex}.`,
    ],
  };
}

function formLabel(p: CancelParams): string {
  if (p.form === 'sum') return `x is added (${topText(p)})`;
  if (p.form === 'product') return `x is multiplied (${topText(p)})`;
  return `the top is x²${signed(p.a)}x`;
}

const esc = (n: number) => String(n).replace('-', '[-−]\\s*');

function checkExpression(p: CancelParams, answer: string, exclusionsIn?: string): AnswerCheck {
  const raw = answer.trim();
  if (!raw) return { status: 'empty', read: 'No answer yet.', note: '' };
  let exprPart = raw;
  let exclText = exclusionsIn ?? null;
  if (exclusionsIn === undefined || exclusionsIn.trim() === '') {
    const split = splitAnswerAndExclusions(raw);
    exprPart = split.expr;
    exclText = split.exclusions ?? exclusionsIn ?? null;
  }
  const orig = original(p);
  const exPars = parseExclusions(exclText);
  const exclRead =
    exPars.kind === 'values' ? `, with ${neg(exclusionsText(exPars.values))}` : exPars.kind === 'error' ? ' (I couldn’t read the excluded values)' : '';
  const exclOk = exPars.kind === 'values' && sameSet(exPars.values, orig.excluded);
  const exclNote = exclOk
    ? ''
    : exPars.kind === 'none-given'
      ? ` Also state the values x cannot take (${neg(exclusionsText(orig.excluded))}).`
      : ` Check the values x cannot take: the original bottom is 0 when ${orig.excluded.map((v) => `x = ${neg(String(v))}`).join(' or ')}.`;

  const cannot = isCannotSimplifyPhrase(exprPart) || /^(it\s+)?(can'?t|cannot)\b/i.test(exprPart);
  let student: Rational;
  let readExpr: string;
  if (cannot) {
    student = orig;
    readExpr = '“cannot be simplified”';
  } else {
    const parsed = parseExpr(exprPart);
    if (!parsed.ok) return { status: 'unparsed', read: `I couldn’t read “${exprPart}” as an expression.`, note: parsed.error };
    try {
      student = toRational(parsed.node);
    } catch (e) {
      return { status: 'unparsed', read: `I couldn’t use “${exprPart}”.`, note: (e as Error).message };
    }
    readExpr = neg(toText(parsed.node));
  }
  const read = `${readExpr}${exclRead}`;
  if (equivalent(student, orig)) {
    const simplified = isSimplified(student);
    if (!simplified)
      return { status: 'partial', read, note: 'That is equal to the original, but it can still be simplified: the top and bottom share a common factor.' };
    if (!exclOk) return { status: 'partial', read, note: `The expression is right.${exclNote}` };
    return { status: 'correct', read, note: 'That’s right, including the values x cannot take.' };
  }
  const isConst = P.degree(student.den) <= 0 && P.degree(student.num) <= 0;
  if (isConst && Math.abs(student.num[0] / student.den[0] - shortcutValue(p)) < 1e-9)
    return { status: 'shortcut', read, note: `${read} is what crossing out the x’s gives. It doesn’t equal the original for every x.` };
  return { status: 'wrong', read, note: `${readExpr} doesn’t equal the original expression for every allowed x.` };
}

export const cancelPack: ConceptPack<CancelParams> = {
  id: 'cancel',
  title: 'Cancelling in fractions',
  distinction: 'Factors vs terms',
  subject: 'Algebra',
  blurb: 'An algebraic fraction with x in the top and the bottom. Can you just cross the x’s out?',
  coreQuestion: 'When can you cancel x from the top and the bottom of a fraction?',
  rule: 'You can only cancel a common factor — something that multiplies the whole top and the whole bottom. A term that is added cannot be cancelled.',
  answerKind: 'expression',
  example: { form: 'sum', a: 8, b: 2 },
  sampleWork: {
    answer: '4',
    working: 'The x’s cancel out, so it is 8/2 = 4.',
  },
  methods,

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const form = r.form === 'sum' || r.form === 'product' || r.form === 'quad' ? r.form : null;
    const a = Number(r.a);
    const b = Number(r.b);
    if (!form || !Number.isInteger(a) || !Number.isInteger(b)) return null;
    if (a === 0 || b === 0 || a === b || Math.abs(a) > 50 || Math.abs(b) > 50) return null;
    if (form === 'product' && (a < 0 || b < 0)) return null;
    return { form, a, b };
  },

  describe,
  unitLabel: () => '',
  solve,

  focus: () => focusCancel,

  contrast(p) {
    if (p.form === 'product') return { form: 'sum', a: p.a, b: p.b };
    return { form: 'product', a: Math.abs(p.a), b: Math.abs(p.b) === Math.abs(p.a) ? Math.abs(p.b) + 1 : Math.abs(p.b) };
  },

  explainCase(p) {
    const n = (v: number | null) => (v === null ? '—' : neg(fmt(v)));
    const ab = `${neg(String(p.a))}/${neg(String(p.b))}`;
    if (p.form === 'sum') {
      // A test value where the shortcut visibly gives a different number.
      const x = [2, 3, 1, 4, 5, 7].find((t) => !excluded(p).includes(t) && Math.abs((valueAt(p, t) ?? NaN) - shortcutValue(p)) > 1e-9) ?? testX(p);
      return [
        `Try a number, like x = ${x}. The top is ${x}${signed(p.a)} = ${neg(String(x + p.a))} and the bottom is ${x}${signed(p.b)} = ${neg(String(x + p.b))}, so the fraction equals ${n(valueAt(p, x))}.`,
        `Crossing out the x leaves ${ab} = ${n(shortcutValue(p))} — a different number, so the shortcut changed the answer.`,
        'Why: here x is added to a number. You can only cancel something that multiplies the whole top and the whole bottom.',
      ];
    }
    if (p.form === 'product') {
      const x = testX(p);
      return [
        `Here x multiplies everything: the top is ${neg(String(p.a))} × x and the bottom is ${neg(String(p.b))} × x.`,
        `Dividing the top and the bottom by x leaves ${ab} = ${n(shortcutValue(p))}. That’s real cancelling, so it works (x just can’t be 0).`,
        `Check with x = ${x}: ${neg(String(p.a * x))}/${neg(String(p.b * x))} = ${n(valueAt(p, x))} — the same ✓`,
      ];
    }
    return [
      `x is in every term, so take it out as a factor: ${topText(p)} = x(x${signed(p.a)}) and ${bottomText(p)} = x(x${signed(p.b)}).`,
      `Now x multiplies the whole top and the whole bottom, so it cancels: ${neg(simplifiedText(p))}.`,
      'Only the factor x cancels. Crossing out x² or x terms on their own would change the answer.',
    ];
  },

  whatChanged(a, b): ChoiceQuestion {
    return {
      question: 'What changed between case A and case B?',
      options: [
        { id: 'numbers', label: 'The numbers changed' },
        { id: 'condition', label: `${topText(a)} became ${topText(b)} (and the same for the bottom)` },
        { id: 'letter', label: 'The letter changed' },
        { id: 'none', label: 'Nothing important changed' },
      ],
      correct: 'condition',
      explain: `In case A ${formLabel(a)}; in case B ${formLabel(b)}. Whether x is multiplied or added decides whether it is a factor.`,
    };
  },

  preserve(p) {
    const swapTop = p.form === 'sum' ? `${p.a} + x` : p.form === 'product' ? `x × ${p.a}` : `${p.a}x + x²`;
    return {
      change: `The top of case A is written the other way round: ${neg(swapTop)} instead of ${topText(p)}.`,
      question: 'Does the simplified answer for case A change?',
      options: [
        { id: 'yes', label: 'Yes, it changes' },
        { id: 'no', label: 'No, it stays the same' },
        { id: 'unsure', label: 'Not sure' },
      ],
      correct: 'no',
      explain: `Reordering an addition or a multiplication doesn’t change its value, so the answer is still ${solve(p).display}. Not every change matters — what matters is whether x multiplies everything.`,
    };
  },

  testPrediction(p) {
    const x = testX(p);
    const v = valueAt(p, x);
    const same = v !== null && Math.abs(v - shortcutValue(p)) < 1e-9;
    return {
      question: `Put x = ${x} into the original fraction. Will it equal ${neg(fractionText(p.a, p.b))} (what crossing out the x’s gives)?`,
      options: [
        { id: 'same', label: `Yes, it gives ${neg(fractionText(p.a, p.b))}` },
        { id: 'different', label: 'No, it gives something else' },
        { id: 'unsure', label: 'Not sure' },
      ],
      correct: same ? 'same' : 'different',
      explain:
        v === null
          ? `x = ${x} isn’t allowed here.`
          : `At x = ${x} the original is ${neg(String(Math.round(v * 1000) / 1000))}${same ? ', which matches.' : `, not ${neg(fractionText(p.a, p.b))}.`}`,
    };
  },

  statements: [
    { id: 'factor', text: 'You can cancel a factor that multiplies the whole top and the whole bottom', kind: 'both', why: 'Dividing top and bottom by the same non-zero factor keeps the value.' },
    { id: 'zero', text: 'x cannot be a value that makes the original bottom 0', kind: 'both', why: 'Division by 0 is undefined in every case.' },
    { id: 'cross', text: 'Cross out the x in the top and the bottom', kind: 'depends', why: 'Only allowed when x is a factor of everything, not when it is added.' },
    { id: 'numbers', text: 'The answer is just the two numbers as a fraction', kind: 'depends', why: 'True when x multiplies both numbers; false when x is added to them.' },
  ],

  ruleQuestion: {
    question: 'When can you cancel x from the top and the bottom?',
    options: [
      { id: 'always', label: 'Whenever x appears in both' },
      { id: 'factor', label: 'When x is a factor of the whole top and the whole bottom' },
      { id: 'even', label: 'When the numbers divide evenly' },
      { id: 'never', label: 'Never' },
    ],
    correct: 'factor',
    explain: 'Cancelling means dividing the top and the bottom by the same thing. (x + 8) ÷ x is not 8, so x can only be cancelled when it multiplies everything.',
  },

  diagnostic(p): Diagnostic {
    const factor = xIsFactor(p);
    const what = p.form === 'quad' ? 'x' : 'x';
    return {
      question: `Is ${what} a factor of the whole top and the whole bottom — does it multiply everything?`,
      options: [
        { id: 'yes', label: 'Yes, x multiplies everything', signal: factor ? 'sound' : 'assumption' },
        { id: 'no', label: 'No, x is added to something', signal: factor ? 'assumption' : 'sound' },
        { id: 'unsure', label: 'I’m not sure', signal: 'unsure' },
      ],
    };
  },

  hints(p, role): Hint[] {
    const x = testX(p);
    const v = valueAt(p, x);
    const s = solve(p);
    const sub = v === null ? '' : `Try x = ${x} in the original: it gives ${neg(String(Math.round(v * 1000) / 1000))}. Does your answer give the same at x = ${x}?`;
    const prompt =
      role === 'transfer'
        ? 'Before cancelling, write the top and the bottom as products. What multiplies everything?'
        : `Cancelling only works on factors. Is x multiplying everything in ${topText(p)}, or is it added?`;
    return [
      { tier: 1, id: 'h1', label: 'Hint 1 · a prompt', text: prompt },
      { tier: 2, id: 'h2', label: 'Hint 2 · a concrete test', text: p.form === 'quad' ? `Factorise: ${topText(p)} = x(x${signed(p.a)}). ${sub}` : sub },
      { tier: 3, id: 'h3', label: 'Worked explanation', text: s.steps.join(' ') },
    ];
  },

  prerequisite: {
    title: 'Quick refresher: factors and terms',
    body: [
      'A factor multiplies. In 6x = 6 × x, both 6 and x are factors.',
      'A term is added. In x + 6, x and 6 are terms — x is not a factor of x + 6.',
      'You can cancel a common factor of the whole top and the whole bottom: 6x/3x = 6/3 = 2.',
      'Values of x that make the bottom 0 are not allowed.',
    ],
  },

  slipSteps(p): SlipStep[] {
    if (p.form === 'sum')
      return [
        { id: 'common', label: 'Common factor of the top and bottom (type 1 if there is none)', kind: 'expr', expected: '1' },
        { id: 'final', label: 'Simplest form', kind: 'expr', expected: `(x+${p.a})/(x+${p.b})`.replace(/\+-/g, '-') },
        { id: 'excl', label: 'Value x cannot take', kind: 'number', expected: -p.b },
      ];
    if (p.form === 'product')
      return [
        { id: 'common', label: 'Common factor of the top and bottom', kind: 'expr', expected: 'x' },
        { id: 'final', label: 'Simplest form', kind: 'expr', expected: `${p.a}/${p.b}` },
        { id: 'excl', label: 'Value x cannot take', kind: 'number', expected: 0 },
      ];
    return [
      { id: 'top', label: 'Top, factorised', kind: 'expr', expected: `x(x+${p.a})`.replace(/\+-/g, '-') },
      { id: 'bottom', label: 'Bottom, factorised', kind: 'expr', expected: `x(x+${p.b})`.replace(/\+-/g, '-') },
      { id: 'final', label: 'Simplest form', kind: 'expr', expected: `(x+${p.a})/(x+${p.b})`.replace(/\+-/g, '-') },
    ];
  },

  checkAnswer: (p, answer, exclusions) => checkExpression(p, answer, exclusions),

  detectMethod(p, working, answer) {
    const text = `${working}`;
    const found: { id: string; quote: string }[] = [];
    const tryAdd = (id: string, re: RegExp) => {
      const m = re.exec(text);
      if (m && m[0].trim().length >= 2) found.push({ id, quote: m[0].trim() });
      return !!m;
    };
    tryAdd('cancel_terms', /\b(?:x'?s|x’s|the\s+x(?:es|s)?|x\^?2'?s?)\s+(?:cancel|cross|go\s+away|disappear)\w*(?:\s+out)?/i) ||
      tryAdd('cancel_terms', /\b(?:cancel(?:led|ed|ing)?|cross(?:ed|ing)?\s+out|crossed|remov(?:e|ed|ing)|get\s+rid\s+of)\s+(?:the\s+|both\s+)?x(?:'?s|’s|es)?\b/i) ||
      tryAdd('cancel_terms', new RegExp(String.raw`(?<![\d.x])${esc(p.a)}\s*(?:\/|÷|over)\s*${esc(p.b)}(?![\d.x])`, 'i'));
    tryAdd('factor_first', /\bfactor\w*/i) || tryAdd('factor_first', /\bx\s*\(\s*x\s*[+−-]\s*\d+\s*\)/i) || tryAdd('factor_first', /\bno\s+common\s+factors?\b/i);
    tryAdd('substitute', /\b(?:substitut\w*|plug\w*\s+in|tr(?:y|ied)\s+x\s*=\s*-?\d+|let\s+x\s*=\s*-?\d+|if\s+x\s*=\s*-?\d+|when\s+x\s*=\s*-?\d+)/i);
    if (found.length === 0) {
      if (isCannotSimplifyPhrase(text)) return { methodId: 'factor_first', quotes: [] };
      return { methodId: 'unclear', quotes: [] };
    }
    const check = checkExpression(p, answer);
    const pick = (id: string) => found.filter((f) => f.id === id);
    let chosen: string;
    if (check.status === 'shortcut' && pick('cancel_terms').length) chosen = 'cancel_terms';
    else if (pick('factor_first').length) chosen = 'factor_first';
    else if (pick('substitute').length) chosen = 'substitute';
    else chosen = 'cancel_terms';
    return { methodId: chosen, quotes: pick(chosen).map((f) => f.quote).slice(0, 2) };
  },

  transfers: [
    { form: 'quad', a: 5, b: 3 },
    { form: 'quad', a: 2, b: 7 },
    { form: 'sum', a: 6, b: 3 },
  ],
  followup: (t) => (t.form === 'product' ? { form: 'sum', a: t.a, b: t.b } : { form: 'product', a: Math.abs(t.a), b: Math.abs(t.b) }),
  harder: { form: 'quad', a: -4, b: 2 },

  parseQuestion(text) {
    if (!/simplif|cancel|\//i.test(text) || !/x/i.test(text)) return null;
    const m = /(?:simplify|cancel)?\s*:?\s*([()x0-9+\-−*×^²\s/.]+\/[()x0-9+\-−*×^²\s.]+)/i.exec(text);
    if (!m) return { params: null, missing: ['the fraction to simplify'] };
    const parsed = parseExpr(m[1].trim());
    if (!parsed.ok) return { params: null, missing: ['a fraction I can read, e.g. (x + 8)/(x + 2)'] };
    let r: Rational;
    try {
      r = toRational(parsed.node);
    } catch {
      return { params: null, missing: ['a fraction that doesn’t divide by zero'] };
    }
    const num = P.trim(r.num);
    const den = P.trim(r.den);
    const intish = (n: number) => Math.abs(n - Math.round(n)) < 1e-9;
    let cand: unknown = null;
    if (num.length === 2 && den.length === 2 && num[1] === 1 && den[1] === 1) cand = { form: 'sum', a: num[0], b: den[0] };
    else if (num.length === 2 && den.length === 2 && num[0] === 0 && den[0] === 0) cand = { form: 'product', a: num[1], b: den[1] };
    else if (num.length === 3 && den.length === 3 && num[0] === 0 && den[0] === 0 && num[2] === 1 && den[2] === 1) cand = { form: 'quad', a: num[1], b: den[1] };
    const params = cand && Object.values(cand as Record<string, unknown>).every((v) => typeof v === 'string' || intish(v as number)) ? cancelPack.validate(cand) : null;
    return params ? { params } : { params: null, missing: ['a supported form: (x + a)/(x + b), (ax)/(bx) or (x² + ax)/(x² + bx)'] };
  },

  key: (p) => `${p.form}:${p.a}:${p.b}`,
};
