// Concept pack 1 — Average speed: equal distances versus equal times.
// Shortcut under test: averaging the two speeds. It is valid only when the
// time spent at each speed is equal.

import { closeTo, fmt, fmtPlain, lcmInt, parseNumericAnswer } from '../text.js';
import type { AnswerCheck, ChoiceQuestion, ConceptPack, Diagnostic, Focus, Hint, MethodOption, SlipStep } from './types.js';

export interface SpeedParams {
  mode: 'distance' | 'time';
  /** Distance of each part (distance mode) or hours in each part (time mode). */
  a: number;
  b: number;
  s1: number;
  s2: number;
  unit: 'km' | 'mi';
  who: string;
}

const EPS = 1e-9;

export function legs(p: SpeedParams) {
  if (p.mode === 'distance') return { d1: p.a, d2: p.b, t1: p.a / p.s1, t2: p.b / p.s2 };
  return { d1: p.a * p.s1, d2: p.b * p.s2, t1: p.a, t2: p.b };
}
export const trueAverage = (p: SpeedParams) => {
  const l = legs(p);
  return (l.d1 + l.d2) / (l.t1 + l.t2);
};
export const meanOfSpeeds = (p: SpeedParams) => (p.s1 + p.s2) / 2;
export const harmonicMean = (p: SpeedParams) => (2 * p.s1 * p.s2) / (p.s1 + p.s2);
export const timesEqual = (p: SpeedParams) => {
  const l = legs(p);
  return Math.abs(l.t1 - l.t2) < EPS;
};
export const distancesEqual = (p: SpeedParams) => {
  const l = legs(p);
  return Math.abs(l.d1 - l.d2) < EPS;
};

const su = (p: SpeedParams) => (p.unit === 'km' ? 'km/h' : 'mph');
const du = (p: SpeedParams) => (p.unit === 'km' ? 'km' : 'miles');
const hours = (h: number) => (Math.abs(h - 1) < EPS ? '1 hour' : `${fmtPlain(h)} hours`);
const article = (who: string) => (/^[aeiou]/i.test(who) ? 'An' : 'A');

function niceEqualDistance(s1: number, s2: number): number {
  if (Number.isInteger(s1) && Number.isInteger(s2)) {
    const l = lcmInt(s1, s2);
    if (l <= 600) return l;
  }
  return 60;
}

const methods: MethodOption<SpeedParams>[] = [
  {
    id: 'mean_of_speeds',
    kind: 'shortcut',
    label: 'Added the two speeds and halved the total',
    restate: 'It looks like you averaged the two speeds: added them and divided by 2.',
    aiHint: 'Arithmetic mean of the two speeds, e.g. "(30+60)/2", "average of the speeds", "halfway between".',
    worksFor: timesEqual,
  },
  {
    id: 'total_over_total',
    kind: 'sound',
    label: 'Divided the total distance by the total time',
    restate: 'It looks like you found the total distance and the total time, then divided one by the other.',
    aiHint: 'Total distance divided by total time, usually after working out the time (or distance) of each part.',
    worksFor: () => true,
  },
  {
    id: 'time_weighted',
    kind: 'alternative',
    label: 'Weighted each speed by how long it lasted',
    restate: 'It looks like you weighted each speed by the time spent at it.',
    aiHint: 'Time-weighted mean, e.g. "(30×2 + 60×1)/3". Valid for any case.',
    worksFor: () => true,
  },
  {
    id: 'harmonic',
    kind: 'alternative',
    label: 'Used 2 ÷ (1/speed₁ + 1/speed₂)',
    restate: 'It looks like you used the harmonic mean of the speeds: 2 ÷ (1/v₁ + 1/v₂).',
    aiHint: 'Harmonic mean of the speeds, e.g. "2/(1/30+1/60)" or "2×30×60/(30+60)". Valid only when the two distances are equal.',
    worksFor: distancesEqual,
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

const focusMean: Focus<SpeedParams> = {
  id: 'mean_of_speeds',
  name: 'averaging the two speeds',
  works: timesEqual,
  result: (p) => `${fmt(meanOfSpeeds(p))} ${su(p)}`,
};
const focusHarmonic: Focus<SpeedParams> = {
  id: 'harmonic',
  name: 'the formula 2 ÷ (1/v₁ + 1/v₂)',
  works: distancesEqual,
  result: (p) => `${fmt(harmonicMean(p))} ${su(p)}`,
};

function describe(p: SpeedParams) {
  const lead = `${article(p.who)} ${p.who} travels `;
  const tail = p.mode === 'distance' ? ' Ignore stops. Find the average speed over the whole journey.' : ' Find the average speed over the whole journey.';
  const parts =
    p.mode === 'distance'
      ? [lead, { mark: `${fmtPlain(p.a)} ${du(p)}` }, ` at ${fmtPlain(p.s1)} ${su(p)} and then `, { mark: `${fmtPlain(p.b)} ${du(p)}` }, ` at ${fmtPlain(p.s2)} ${su(p)}.`, tail]
      : [lead, { mark: `for ${hours(p.a)}` }, ` at ${fmtPlain(p.s1)} ${su(p)} and then `, { mark: `for ${hours(p.b)}` }, ` at ${fmtPlain(p.s2)} ${su(p)}.`, tail];
  const text = parts.map((x) => (typeof x === 'string' ? x : x.mark)).join('');
  return { parts, text };
}

function solve(p: SpeedParams) {
  const l = legs(p);
  const D = l.d1 + l.d2;
  const T = l.t1 + l.t2;
  const avg = D / T;
  const steps =
    p.mode === 'distance'
      ? [
          `Time for the first part = ${fmtPlain(p.a)} ÷ ${fmtPlain(p.s1)} = ${fmt(l.t1)} h`,
          `Time for the second part = ${fmtPlain(p.b)} ÷ ${fmtPlain(p.s2)} = ${fmt(l.t2)} h`,
          `Total distance = ${fmtPlain(p.a)} + ${fmtPlain(p.b)} = ${fmt(D)} ${du(p)}`,
          `Total time = ${fmt(l.t1)} + ${fmt(l.t2)} = ${fmt(T)} h`,
          `Average speed = ${fmt(D)} ÷ ${fmt(T)} = ${fmt(avg)} ${su(p)}`,
        ]
      : [
          `Distance in the first part = ${fmtPlain(p.s1)} × ${fmtPlain(p.a)} = ${fmt(l.d1)} ${du(p)}`,
          `Distance in the second part = ${fmtPlain(p.s2)} × ${fmtPlain(p.b)} = ${fmt(l.d2)} ${du(p)}`,
          `Total distance = ${fmt(D)} ${du(p)}`,
          `Total time = ${fmtPlain(p.a)} + ${fmtPlain(p.b)} = ${fmt(T)} h`,
          `Average speed = ${fmt(D)} ÷ ${fmt(T)} = ${fmt(avg)} ${su(p)}`,
        ];
  return { display: `${fmt(avg)} ${su(p)}`, steps };
}

function conditionLabel(p: SpeedParams): string {
  if (p.mode === 'time') return timesEqual(p) ? 'equal time at each speed' : 'a set time at each speed';
  return distancesEqual(p) ? 'equal distances at each speed' : 'a set distance at each speed';
}

const NUM = String.raw`\d+(?:\.\d+)?`;
const SPEED_UNIT = String.raw`(km\s*\/\s*h|kmh|kph|km\s+per\s+hour|kilomet(?:re|er)s?\s+(?:per|an)\s+hour|mph|miles\s+(?:per|an)\s+hour)`;
const DIST_UNIT = String.raw`(km|kilomet(?:re|er)s?|miles?|mi)\b`;
const WORD_NUM: Record<string, number> = { a: 1, an: 1, one: 1, two: 2, three: 3, four: 4, five: 5, half: 0.5 };

const isMiles = (u: string) => /mi|mile|mph/i.test(u);

function esc(n: number): string {
  return fmtPlain(n).replace('.', '\\.');
}

function findWho(text: string): string {
  const m = /\b(car|cyclist|bike|train|bus|runner|jogger|boat|truck|lorry|van|plane|walker|driver|motorbike|scooter|ship|horse|tram)\b/i.exec(text);
  if (!m) return /\bdriv/i.test(text) ? 'car' : 'traveller';
  const w = m[1].toLowerCase();
  return w === 'bike' ? 'cyclist' : w === 'driver' ? 'car' : w;
}

export const speedPack: ConceptPack<SpeedParams> = {
  id: 'speed',
  title: 'Average speed',
  distinction: 'Equal distances vs equal times',
  subject: 'Maths / physics',
  blurb: 'Two parts of a journey at two speeds. Is the average speed just the average of the speeds?',
  coreQuestion: 'When does averaging the two speeds give the true average speed?',
  rule: 'Average speed is total distance ÷ total time. Averaging the two speeds only works when the time spent at each speed is equal.',
  answerKind: 'number',
  example: { mode: 'distance', a: 60, b: 60, s1: 30, s2: 60, unit: 'km', who: 'car' },
  sampleWork: {
    answer: '45 km/h',
    working: 'The car goes at 30 km/h and then at 60 km/h, so the average speed is (30 + 60) ÷ 2 = 45 km/h.',
  },
  methods,

  validate(raw) {
    if (!raw || typeof raw !== 'object') return null;
    const r = raw as Record<string, unknown>;
    const nums = ['a', 'b', 's1', 's2'].map((k) => Number(r[k]));
    if (nums.some((n) => !Number.isFinite(n) || n <= 0 || n > 100000)) return null;
    const mode = r.mode === 'time' ? 'time' : r.mode === 'distance' ? 'distance' : null;
    if (!mode) return null;
    const [a, b, s1, s2] = nums;
    if (Math.abs(s1 - s2) < EPS) return null;
    const unit = r.unit === 'mi' ? 'mi' : 'km';
    const whoRaw = typeof r.who === 'string' ? r.who.trim().toLowerCase() : '';
    const who = /^[a-z ]{2,20}$/.test(whoRaw) ? whoRaw : 'car';
    return { mode, a, b, s1, s2, unit, who };
  },

  describe,
  unitLabel: su,
  solve,

  focus: (id) => (id === 'harmonic' ? focusHarmonic : focusMean),

  contrast(p, focusId) {
    const f = focusId === 'harmonic' ? focusHarmonic : focusMean;
    const works = f.works(p);
    const equalDistances = (): SpeedParams => {
      const d = niceEqualDistance(p.s1, p.s2);
      return { ...p, mode: 'distance', a: d, b: d };
    };
    const equalTimes = (): SpeedParams => ({ ...p, mode: 'time', a: 1, b: 1 });
    if (f.id === 'harmonic') return works ? equalTimes() : equalDistances();
    return works ? equalDistances() : equalTimes();
  },

  explainCase(p, focusId) {
    const l = legs(p);
    const D = l.d1 + l.d2;
    const T = l.t1 + l.t2;
    const lines = [
      `Part 1: ${fmtPlain(l.d1)} ${du(p)} at ${fmtPlain(p.s1)} ${su(p)} takes ${hours(l.t1)}. Part 2: ${fmtPlain(l.d2)} ${du(p)} at ${fmtPlain(p.s2)} ${su(p)} takes ${hours(l.t2)}.`,
      `Real average speed = total distance ÷ total time = ${fmtPlain(D)} ÷ ${fmtPlain(T)} = ${fmt(D / T)} ${su(p)}.`,
    ];
    if (focusId === 'harmonic') {
      lines.push(
        distancesEqual(p)
          ? 'Both parts are the same distance — exactly what the formula 2 ÷ (1/v₁ + 1/v₂) assumes — so it works here.'
          : `The formula 2 ÷ (1/v₁ + 1/v₂) assumes both parts are the same distance. Here they aren’t (${fmtPlain(l.d1)} vs ${fmtPlain(l.d2)} ${du(p)}), so it gives the wrong answer.`,
      );
      return lines;
    }
    const mean = meanOfSpeeds(p);
    if (timesEqual(p)) {
      lines.push(`The ${p.who} spends the same time at each speed, so both speeds count equally. That’s why just averaging them — (${fmtPlain(p.s1)} + ${fmtPlain(p.s2)}) ÷ 2 = ${fmt(mean)} — works here.`);
    } else {
      const slowFirst = p.s1 < p.s2;
      const [slow, fast] = slowFirst ? [p.s1, p.s2] : [p.s2, p.s1];
      const [tSlow, tFast] = slowFirst ? [l.t1, l.t2] : [l.t2, l.t1];
      const longerAtSlow = tSlow > tFast;
      lines.push(
        `The ${p.who} spends longer at ${fmtPlain(longerAtSlow ? slow : fast)} ${su(p)} (${hours(longerAtSlow ? tSlow : tFast)} vs ${hours(longerAtSlow ? tFast : tSlow)}), so that speed counts more. ` +
          `Averaging (${fmtPlain(p.s1)} + ${fmtPlain(p.s2)}) ÷ 2 = ${fmt(mean)} counts both speeds equally, so it comes out too ${mean > D / T ? 'high' : 'low'}.`,
      );
    }
    return lines;
  },

  whatChanged(a, b): ChoiceQuestion {
    const label = `${conditionLabel(a)[0].toUpperCase()}${conditionLabel(a).slice(1)} became ${conditionLabel(b)}`;
    return {
      question: 'What changed between case A and case B?',
      options: [
        { id: 'speeds', label: 'The two speeds changed' },
        { id: 'condition', label },
        { id: 'unit', label: 'The units changed' },
        { id: 'none', label: 'Nothing important changed' },
      ],
      correct: 'condition',
      explain: `The speeds stay ${fmtPlain(a.s1)} and ${fmtPlain(a.s2)} ${su(a)}. The change is how the journey is split: case A has ${conditionLabel(a)}; case B has ${conditionLabel(b)}.`,
    };
  },

  preserve(p) {
    const l = legs(p);
    const avg = trueAverage(p);
    const change =
      p.mode === 'distance'
        ? `Both distances double, to ${fmtPlain(2 * p.a)} and ${fmtPlain(2 * p.b)} ${du(p)}. The speeds stay the same.`
        : `Both times double, to ${hours(2 * p.a)} and ${hours(2 * p.b)}. The speeds stay the same.`;
    return {
      change,
      question: 'Does the true average speed of case A change?',
      options: [
        { id: 'yes', label: 'Yes, it changes' },
        { id: 'no', label: 'No, it stays the same' },
        { id: 'unsure', label: 'Not sure' },
      ],
      correct: 'no',
      explain: `It stays ${fmt(avg)} ${su(p)}. Doubling both parts doubles both times (${fmt(2 * l.t1)} h and ${fmt(2 * l.t2)} h), so the share of time at each speed is unchanged. Total distance ÷ total time still works — not every change breaks a method.`,
    };
  },

  testPrediction(p) {
    const l = legs(p);
    const correct = Math.abs(l.t1 - l.t2) < EPS ? 'equal' : l.t1 > l.t2 ? 'more1' : 'more2';
    return {
      question: 'How is the time split between the two speeds?',
      options: [
        { id: 'more1', label: `More time at ${fmtPlain(p.s1)} ${su(p)}` },
        { id: 'equal', label: 'Equal time at each speed' },
        { id: 'more2', label: `More time at ${fmtPlain(p.s2)} ${su(p)}` },
      ],
      correct,
      explain: `${fmt(l.t1)} h at ${fmtPlain(p.s1)} ${su(p)} and ${fmt(l.t2)} h at ${fmtPlain(p.s2)} ${su(p)}.`,
    };
  },

  statements: [
    { id: 'def', text: 'Average speed = total distance ÷ total time', kind: 'both', why: 'This is the definition, so it holds in every case.' },
    { id: 'time', text: 'Time for a part = its distance ÷ its speed', kind: 'both', why: 'True for any part travelled at a steady speed.' },
    { id: 'mean', text: 'Add the two speeds and divide by 2', kind: 'depends', why: 'Only gives the right answer when equal time is spent at each speed.' },
    { id: 'slow', text: 'The slower part takes longer', kind: 'depends', why: 'True when the distances are equal, but not when the times are fixed to be equal.' },
  ],

  ruleQuestion: {
    question: 'When does averaging the two speeds give the true average speed?',
    options: [
      { id: 'always', label: 'Always — there are two speeds, so average them' },
      { id: 'dist', label: 'When the two distances are equal' },
      { id: 'time', label: 'When the time spent at each speed is equal' },
      { id: 'never', label: 'Never' },
    ],
    correct: 'time',
    explain: 'Each speed counts for as long as it lasts. With equal times, both speeds count equally, so their plain average is correct. With equal distances, the slower speed lasts longer and pulls the average down.',
  },

  diagnostic(p): Diagnostic {
    const eq = timesEqual(p);
    return {
      question: `Did the ${p.who} spend the same amount of time at each speed?`,
      options: [
        { id: 'yes', label: 'Yes, the same time at each speed', signal: eq ? 'sound' : 'assumption' },
        { id: 'no', label: 'No, more time at one speed', signal: eq ? 'assumption' : 'sound' },
        { id: 'unsure', label: 'I’m not sure', signal: 'unsure' },
      ],
    };
  },

  hints(p, role): Hint[] {
    const l = legs(p);
    const s = solve(p);
    const works = timesEqual(p);
    const concrete =
      p.mode === 'distance'
        ? `Work out how long each part took: ${fmtPlain(p.a)} ÷ ${fmtPlain(p.s1)} and ${fmtPlain(p.b)} ÷ ${fmtPlain(p.s2)}. Did the ${p.who} spend equal time at each speed?`
        : `Work out each distance: ${fmtPlain(p.s1)} × ${fmtPlain(p.a)} and ${fmtPlain(p.s2)} × ${fmtPlain(p.b)}. Then divide the total distance by the total time.`;
    const worked = `${s.steps.join('. ')}. Averaging the speeds gives ${fmt(meanOfSpeeds(p))} ${su(p)}, which ${
      works ? 'matches here because the times are equal' : `does not match because the times are not equal (${fmt(l.t1)} h and ${fmt(l.t2)} h)`
    }.`;
    if (role === 'transfer')
      return [
        { tier: 1, id: 'h1', label: 'Hint 1 · a prompt', text: 'Before averaging anything, check: how long does each part take?' },
        {
          tier: 2,
          id: 'h2',
          label: 'Hint 2 · a concrete test',
          text:
            p.mode === 'distance'
              ? `${fmtPlain(p.a)} ÷ ${fmtPlain(p.s1)} = ${fmt(l.t1)} h and ${fmtPlain(p.b)} ÷ ${fmtPlain(p.s2)} = ${fmt(l.t2)} h. Now find the total distance and the total time.`
              : concrete,
        },
        { tier: 3, id: 'h3', label: 'Worked explanation', text: worked },
      ];
    return [
      { tier: 1, id: 'h1', label: 'Hint 1 · a prompt', text: 'Average speed over a whole trip means total distance ÷ total time. Which of those did your method use?' },
      { tier: 2, id: 'h2', label: 'Hint 2 · a concrete test', text: concrete },
      { tier: 3, id: 'h3', label: 'Worked explanation', text: worked },
    ];
  },

  prerequisite: {
    title: 'Quick refresher: speed, distance and time',
    body: [
      'Speed = distance ÷ time. So time = distance ÷ speed, and distance = speed × time.',
      'Example: 60 km at 30 km/h takes 60 ÷ 30 = 2 hours.',
      'For a whole journey, average speed = total distance ÷ total time.',
    ],
  },

  slipSteps(p): SlipStep[] {
    const l = legs(p);
    const D = l.d1 + l.d2;
    const T = l.t1 + l.t2;
    if (p.mode === 'distance')
      return [
        { id: 't1', label: `Time for the first part (${fmtPlain(p.a)} ÷ ${fmtPlain(p.s1)})`, kind: 'number', expected: l.t1, unit: 'h' },
        { id: 't2', label: `Time for the second part (${fmtPlain(p.b)} ÷ ${fmtPlain(p.s2)})`, kind: 'number', expected: l.t2, unit: 'h' },
        { id: 'D', label: 'Total distance', kind: 'number', expected: D, unit: du(p) },
        { id: 'T', label: 'Total time', kind: 'number', expected: T, unit: 'h' },
        { id: 'avg', label: 'Total distance ÷ total time', kind: 'number', expected: D / T, unit: su(p) },
      ];
    return [
      { id: 'd1', label: `Distance in the first part (${fmtPlain(p.s1)} × ${fmtPlain(p.a)})`, kind: 'number', expected: l.d1, unit: du(p) },
      { id: 'd2', label: `Distance in the second part (${fmtPlain(p.s2)} × ${fmtPlain(p.b)})`, kind: 'number', expected: l.d2, unit: du(p) },
      { id: 'D', label: 'Total distance', kind: 'number', expected: D, unit: du(p) },
      { id: 'T', label: 'Total time', kind: 'number', expected: T, unit: 'h' },
      { id: 'avg', label: 'Total distance ÷ total time', kind: 'number', expected: D / T, unit: su(p) },
    ];
  },

  checkAnswer(p, answer): AnswerCheck {
    const parsed = parseNumericAnswer(answer);
    const ref = trueAverage(p);
    const shortcut = meanOfSpeeds(p);
    if (parsed.kind === 'empty') return { status: 'empty', read: 'No answer yet.', note: '' };
    if (parsed.kind === 'none') return { status: 'unparsed', read: `I couldn’t find a number in “${answer.trim()}”.`, note: 'Please give your final answer as a number.' };
    if (parsed.kind === 'ambiguous')
      return { status: 'ambiguous', read: `I found more than one number: ${parsed.values.map((v) => fmt(v)).join(' and ')}.`, note: 'Which one is your final answer?' };
    const v = parsed.value;
    const unitNote = p.unit === 'km' && /mph|mile/i.test(parsed.rest) ? ' (Check the unit: this question uses km/h.)' : '';
    const read = `${fmt(v)} ${su(p)}`;
    if (closeTo(v, ref)) return { status: 'correct', read, note: `${fmt(v)} ${su(p)} is right.${unitNote}` };
    if (!timesEqual(p) && closeTo(v, shortcut))
      return { status: 'shortcut', read, note: `${fmt(v)} ${su(p)} is what averaging the two speeds gives. That’s not the right answer here.${unitNote}` };
    return { status: 'wrong', read, note: `${fmt(v)} ${su(p)} isn’t the right answer.${unitNote}` };
  },

  detectMethod(p, working, answer) {
    const text = working;
    const s1 = esc(p.s1);
    const s2 = esc(p.s2);
    const found: { id: string; quote: string }[] = [];
    const tryAdd = (id: string, re: RegExp) => {
      const m = re.exec(text);
      if (m && m[0].trim().length >= 2) found.push({ id, quote: m[0].trim() });
      return !!m;
    };
    const direct =
      tryAdd('mean_of_speeds', new RegExp(String.raw`\(?\s*(?:${s1}\s*\+\s*${s2}|${s2}\s*\+\s*${s1})\s*\)?\s*(?:\/|÷|divided\s+by|over)\s*2(?![\d.])`, 'i')) ||
      tryAdd('mean_of_speeds', /\b(?:average|mean)\s+(?:of\s+)?(?:the\s+)?(?:two\s+)?speeds\b/i) ||
      tryAdd('mean_of_speeds', /\badd(?:ed|ing)?\s+(?:the\s+)?(?:two\s+)?speeds\b[^.]*?\b(?:half|halve|divide)/i) ||
      tryAdd('mean_of_speeds', /\b(?:halfway|half\s*way|in\s+the\s+middle)\s+(?:between|of)\b[^.]*/i);
    if (!direct) {
      const sum = new RegExp(String.raw`(?:${s1}\s*\+\s*${s2}|${s2}\s*\+\s*${s1})`, 'i').exec(text);
      const half = /(?:\/|÷)\s*2(?![\d.])|\bhalf\b|\bhalve/i.exec(text);
      if (sum && half) found.push({ id: 'mean_of_speeds', quote: sum[0].trim() });
    }
    tryAdd('harmonic', /\bharmonic\b[^.]*/i) ||
      tryAdd('harmonic', new RegExp(String.raw`2\s*(?:\/|÷)\s*\(\s*1\s*\/\s*${s1}\s*\+\s*1\s*\/\s*${s2}\s*\)`, 'i')) ||
      tryAdd('harmonic', new RegExp(String.raw`2\s*[x*×·]\s*${s1}\s*[x*×·]\s*${s2}`, 'i'));
    const l = legs(p);
    const D = l.d1 + l.d2;
    const T = l.t1 + l.t2;
    tryAdd('total_over_total', /\btotal\s+distance\b[^.]*?\btotal\s+time\b/i) ||
      tryAdd('total_over_total', new RegExp(String.raw`${esc(D)}\s*(?:\/|÷|divided\s+by|over)\s*${esc(T)}(?![\d.])`, 'i')) ||
      tryAdd('total_over_total', /\btotal\s+(?:distance|time)\b/i) ||
      (p.mode === 'distance' && tryAdd('total_over_total', new RegExp(String.raw`${esc(p.a)}\s*(?:\/|÷)\s*${s1}(?![\d.])`, 'i')));
    tryAdd('time_weighted', new RegExp(String.raw`${s1}\s*[x*×·]\s*${esc(l.t1)}\s*\+\s*${s2}\s*[x*×·]\s*${esc(l.t2)}`, 'i'));

    if (found.length === 0) return { methodId: 'unclear', quotes: [] };
    const parsed = parseNumericAnswer(answer);
    const value = parsed.kind === 'number' ? parsed.value : NaN;
    const pick = (id: string) => found.filter((f) => f.id === id);
    let chosen: string;
    if (Number.isFinite(value) && closeTo(value, meanOfSpeeds(p)) && pick('mean_of_speeds').length) chosen = 'mean_of_speeds';
    else if (pick('total_over_total').length) chosen = 'total_over_total';
    else if (pick('time_weighted').length) chosen = 'time_weighted';
    else if (pick('harmonic').length) chosen = 'harmonic';
    else chosen = 'mean_of_speeds';
    return { methodId: chosen, quotes: pick(chosen).map((f) => f.quote).slice(0, 2) };
  },

  transfers: [
    { mode: 'distance', a: 12, b: 12, s1: 12, s2: 6, unit: 'km', who: 'cyclist' },
    { mode: 'distance', a: 150, b: 150, s1: 50, s2: 75, unit: 'km', who: 'train' },
    { mode: 'distance', a: 30, b: 30, s1: 10, s2: 15, unit: 'km', who: 'boat' },
  ],
  followup: (t) => ({ ...t, mode: 'time', a: 1, b: 1 }),
  harder: { mode: 'distance', a: 30, b: 90, s1: 30, s2: 45, unit: 'km', who: 'car' },

  parseQuestion(text) {
    if (!/\baverage\b|\bmean\s+speed\b/i.test(text)) return null;
    const legsFound: { kind: 'distance' | 'time'; amount: number; speed: number; miles: boolean }[] = [];
    const distFirst = new RegExp(String.raw`(${NUM})\s*${DIST_UNIT}[^.;]*?\bat\s+(?:an?\s+(?:average\s+|constant\s+|steady\s+)?speed\s+of\s+)?(${NUM})\s*${SPEED_UNIT}`, 'gi');
    const speedFirstDist = new RegExp(String.raw`\bat\s+(${NUM})\s*${SPEED_UNIT}\s+for\s+(${NUM})\s*${DIST_UNIT}`, 'gi');
    const timeFirst = new RegExp(String.raw`(?:for\s+)?(${NUM}|an?|one|two|three|four|five|half\s+an?)\s*(?:hours?|hrs?|h)\b[^.;]*?\bat\s+(${NUM})\s*${SPEED_UNIT}`, 'gi');
    const speedFirstTime = new RegExp(String.raw`\bat\s+(${NUM})\s*${SPEED_UNIT}\s+for\s+(${NUM}|an?|one|two|three|four|five|half\s+an?)\s*(?:hours?|hrs?|h)\b`, 'gi');
    const num = (s: string) => (s in WORD_NUM ? WORD_NUM[s] : /^half/i.test(s) ? 0.5 : parseFloat(s));
    type Hit = { index: number; kind: 'distance' | 'time'; amount: number; speed: number; miles: boolean };
    const hits: Hit[] = [];
    for (const m of text.matchAll(distFirst)) hits.push({ index: m.index ?? 0, kind: 'distance', amount: parseFloat(m[1]), speed: parseFloat(m[3]), miles: isMiles(m[2]) });
    for (const m of text.matchAll(speedFirstDist)) hits.push({ index: m.index ?? 0, kind: 'distance', amount: parseFloat(m[3]), speed: parseFloat(m[1]), miles: isMiles(m[4]) });
    for (const m of text.matchAll(timeFirst)) hits.push({ index: m.index ?? 0, kind: 'time', amount: num(m[1].toLowerCase()), speed: parseFloat(m[2]), miles: isMiles(m[3]) });
    for (const m of text.matchAll(speedFirstTime)) hits.push({ index: m.index ?? 0, kind: 'time', amount: num(m[3].toLowerCase()), speed: parseFloat(m[1]), miles: isMiles(m[2]) });
    hits.sort((x, y) => x.index - y.index);
    for (const h of hits) if (!legsFound.some((l) => l.speed === h.speed && l.amount === h.amount && l.kind === h.kind)) legsFound.push(h);
    const who = findWho(text);
    if (legsFound.length === 0) return { params: null, partial: { who }, missing: ['the distance or time and speed for each part'] };
    const [l1, l2] = legsFound;
    if (!l2 || l1.kind !== l2.kind)
      return {
        params: null,
        partial: { who, mode: l1.kind, a: l1.amount, s1: l1.speed, unit: l1.miles ? 'mi' : 'km' },
        missing: [l2 ? 'whether both parts are given by distance or both by time' : 'the second part of the journey'],
      };
    const params = speedPack.validate({ mode: l1.kind, a: l1.amount, b: l2.amount, s1: l1.speed, s2: l2.speed, unit: l1.miles ? 'mi' : 'km', who });
    return params ? { params } : { params: null, partial: { who }, missing: ['two different speeds'] };
  },

  key: (p) => `${p.mode}:${p.a}:${p.b}:${p.s1}:${p.s2}`,
};
