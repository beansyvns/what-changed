// A small, safe expression reader for one-variable rational expressions.
// No eval: a hand-written recursive-descent parser builds a tree, which is
// converted to an exact numerator/denominator pair of polynomials.
//
// Convention: implicit multiplication binds tighter than "/" so that
// "8x/2x" reads as (8x)/(2x), the way students usually mean it. The UI always
// shows how an input was read so the student can add brackets if needed.

import { normalizeSymbols } from '../text.js';
import * as P from './poly.js';

export type Node =
  | { t: 'num'; v: number }
  | { t: 'var' }
  | { t: 'neg'; a: Node }
  | { t: 'add'; a: Node; b: Node }
  | { t: 'sub'; a: Node; b: Node }
  | { t: 'mul'; a: Node; b: Node }
  | { t: 'div'; a: Node; b: Node }
  | { t: 'pow'; a: Node; n: number };

export type ParseResult = { ok: true; node: Node } | { ok: false; error: string };

type Tok = { k: 'num'; v: number } | { k: 'var' } | { k: 'op'; v: string };

const MAX_LEN = 120;

function tokenize(src: string, v: string): Tok[] | string {
  const s = normalizeSymbols(src).replace(/[[{]/g, '(').replace(/[\]}]/g, ')');
  const toks: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (c === ' ') {
      i++;
      continue;
    }
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const text = s.slice(i, j);
      if (!/^\d+(\.\d+)?$|^\.\d+$/.test(text)) return `“${text}” isn’t a number I can read.`;
      toks.push({ k: 'num', v: parseFloat(text) });
      i = j;
      continue;
    }
    if (/[a-zA-Z]/.test(c)) {
      if (c.toLowerCase() !== v) return `Only the letter ${v} can be used here (found “${c}”).`;
      toks.push({ k: 'var' });
      i++;
      continue;
    }
    if ('+-*/^()'.includes(c)) {
      toks.push({ k: 'op', v: c });
      i++;
      continue;
    }
    return `The symbol “${c}” isn’t supported here.`;
  }
  return toks;
}

export function parseExpr(input: string, v = 'x'): ParseResult {
  if (input.length > MAX_LEN) return { ok: false, error: 'That expression is too long for this checker.' };
  const tokOrErr = tokenize(input, v);
  if (typeof tokOrErr === 'string') return { ok: false, error: tokOrErr };
  const toks: Tok[] = tokOrErr;
  if (toks.length === 0) return { ok: false, error: 'Nothing to read yet.' };
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (t: Tok | undefined, o: string) => !!t && t.k === 'op' && t.v === o;
  const startsAtom = (t: Tok | undefined) => !!t && (t.k === 'num' || t.k === 'var' || isOp(t, '('));

  function expr(): Node {
    let left = term();
    while (isOp(peek(), '+') || isOp(peek(), '-')) {
      const op = (toks[pos++] as { v: string }).v;
      const right = term();
      left = { t: op === '+' ? 'add' : 'sub', a: left, b: right };
    }
    return left;
  }

  function term(): Node {
    let left = implicitProduct();
    while (isOp(peek(), '*') || isOp(peek(), '/')) {
      const op = (toks[pos++] as { v: string }).v;
      const right = implicitProduct();
      left = { t: op === '*' ? 'mul' : 'div', a: left, b: right };
    }
    return left;
  }

  function implicitProduct(): Node {
    let left = unary();
    while (startsAtom(peek())) {
      const prev = toks[pos - 1];
      if (prev && prev.k === 'var' && peek()!.k === 'num') throw new Error('Write powers with ^, for example x^2 (not x2).');
      if (prev && prev.k === 'num' && peek()!.k === 'num') throw new Error('Two numbers are next to each other — is an operator missing?');
      left = { t: 'mul', a: left, b: power() };
    }
    return left;
  }

  function unary(): Node {
    if (isOp(peek(), '-')) {
      pos++;
      return { t: 'neg', a: unary() };
    }
    if (isOp(peek(), '+')) {
      pos++;
      return unary();
    }
    return power();
  }

  function power(): Node {
    const base = atom();
    if (isOp(peek(), '^')) {
      pos++;
      let paren = false;
      if (isOp(peek(), '(')) {
        paren = true;
        pos++;
      }
      const t = peek();
      if (!t || t.k !== 'num' || !Number.isInteger(t.v) || t.v > 8)
        throw new Error('Powers must be whole numbers from 0 to 8, like x^2.');
      pos++;
      if (paren) {
        if (!isOp(peek(), ')')) throw new Error('A bracket is not closed.');
        pos++;
      }
      return { t: 'pow', a: base, n: t.v };
    }
    return base;
  }

  function atom(): Node {
    const t = peek();
    if (!t) throw new Error('The expression ends too early.');
    if (t.k === 'num') {
      pos++;
      return { t: 'num', v: t.v };
    }
    if (t.k === 'var') {
      pos++;
      return { t: 'var' };
    }
    if (isOp(t, '(')) {
      pos++;
      const inner = expr();
      if (!isOp(peek(), ')')) throw new Error('A bracket is not closed.');
      pos++;
      return inner;
    }
    throw new Error(`Unexpected “${t.k === 'op' ? t.v : '?'}”.`);
  }

  try {
    const node = expr();
    if (pos < toks.length) {
      const t = toks[pos];
      return { ok: false, error: isOp(t, ')') ? 'There is an extra closing bracket.' : 'I couldn’t read the whole expression.' };
    }
    return { ok: true, node };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

// ---------- Display ----------

function isAtomic(n: Node): boolean {
  return n.t === 'num' || n.t === 'var' || (n.t === 'pow' && n.a.t === 'var');
}

function numText(v: number): string {
  return Number.isInteger(v) ? String(v) : String(Math.round(v * 1000) / 1000);
}

/** Text that shows exactly how an input was grouped, e.g. "x + (8/x) + 2". */
export function toText(n: Node, v = 'x'): string {
  switch (n.t) {
    case 'num':
      return numText(n.v);
    case 'var':
      return v;
    case 'neg': {
      const inner = toText(n.a, v);
      return n.a.t === 'add' || n.a.t === 'sub' ? `-(${inner})` : `-${inner}`;
    }
    case 'add':
    case 'sub': {
      const wrapSide = (c: Node, right: boolean) => {
        const t = toText(c, v);
        if (c.t === 'div') return `(${t})`;
        if (right && n.t === 'sub' && (c.t === 'add' || c.t === 'sub')) return `(${t})`;
        return t;
      };
      return `${wrapSide(n.a, false)} ${n.t === 'add' ? '+' : '-'} ${wrapSide(n.b, true)}`;
    }
    case 'mul': {
      const l = n.a.t === 'add' || n.a.t === 'sub' || n.a.t === 'div' ? `(${toText(n.a, v)})` : toText(n.a, v);
      const rNeedsWrap = n.b.t === 'add' || n.b.t === 'sub' || n.b.t === 'div' || n.b.t === 'neg' || n.b.t === 'mul';
      const r = rNeedsWrap ? `(${toText(n.b, v)})` : toText(n.b, v);
      const juxtapose =
        r.startsWith('(') || ((n.a.t === 'num' || n.a.t === 'var' || n.a.t === 'mul') && (n.b.t === 'var' || (n.b.t === 'pow' && n.b.a.t === 'var')));
      return juxtapose ? `${l}${r}` : `${l} × ${r}`;
    }
    case 'div': {
      const l = isAtomic(n.a) ? toText(n.a, v) : `(${toText(n.a, v)})`;
      const r = isAtomic(n.b) ? toText(n.b, v) : `(${toText(n.b, v)})`;
      return `${l}/${r}`;
    }
    case 'pow': {
      const base = isAtomic(n.a) && n.a.t !== 'pow' ? toText(n.a, v) : `(${toText(n.a, v)})`;
      return `${base}^${n.n}`;
    }
  }
}

// ---------- Evaluation ----------

/** Evaluate at a value; null means undefined (division by zero somewhere). */
export function evalAt(n: Node, x: number): number | null {
  switch (n.t) {
    case 'num':
      return n.v;
    case 'var':
      return x;
    case 'neg': {
      const a = evalAt(n.a, x);
      return a === null ? null : -a;
    }
    case 'pow': {
      const a = evalAt(n.a, x);
      return a === null ? null : a ** n.n;
    }
    default: {
      const a = evalAt(n.a, x);
      const b = evalAt(n.b, x);
      if (a === null || b === null) return null;
      if (n.t === 'add') return a + b;
      if (n.t === 'sub') return a - b;
      if (n.t === 'mul') return a * b;
      if (Math.abs(b) < 1e-12) return null;
      return a / b;
    }
  }
}

// ---------- Exact rational form ----------

export interface Rational {
  num: P.Poly;
  den: P.Poly;
  /** x-values excluded anywhere in the expression as written (zeros of every divisor). */
  excluded: number[];
}

function mergeRoots(...lists: number[][]): number[] {
  const out: number[] = [];
  for (const l of lists) for (const r of l) if (!out.some((o) => Math.abs(o - r) < 1e-9)) out.push(r);
  return out.sort((a, b) => a - b);
}

export function toRational(n: Node): Rational {
  switch (n.t) {
    case 'num':
      return { num: [n.v], den: [1], excluded: [] };
    case 'var':
      return { num: [0, 1], den: [1], excluded: [] };
    case 'neg': {
      const a = toRational(n.a);
      return { num: P.scale(a.num, -1), den: a.den, excluded: a.excluded };
    }
    case 'pow': {
      const a = toRational(n.a);
      return { num: P.pow(a.num, n.n), den: P.pow(a.den, n.n), excluded: a.excluded };
    }
    default: {
      const a = toRational(n.a);
      const b = toRational(n.b);
      const excluded = mergeRoots(a.excluded, b.excluded);
      if (n.t === 'add' || n.t === 'sub') {
        const right = P.mul(b.num, a.den);
        const left = P.mul(a.num, b.den);
        return { num: n.t === 'add' ? P.add(left, right) : P.sub(left, right), den: P.mul(a.den, b.den), excluded };
      }
      if (n.t === 'mul') return { num: P.mul(a.num, b.num), den: P.mul(a.den, b.den), excluded };
      if (P.isZero(b.num)) throw new Error('This divides by zero for every value.');
      return {
        num: P.mul(a.num, b.den),
        den: P.mul(a.den, b.num),
        excluded: mergeRoots(excluded, P.rationalRoots(b.num)),
      };
    }
  }
}

/** Same function of x on their shared domain (exact polynomial cross-multiplication). */
export function equivalent(r1: Rational, r2: Rational): boolean {
  const diff = P.sub(P.mul(r1.num, r2.den), P.mul(r2.num, r1.den));
  const scaleRef = Math.max(1, ...P.mul(r1.num, r2.den).map(Math.abs), ...P.mul(r2.num, r1.den).map(Math.abs));
  return diff.every((c) => Math.abs(c) <= 1e-9 * scaleRef);
}

/** True when numerator and denominator (as typed) share no common factor. */
export function isSimplified(r: Rational): boolean {
  if (P.degree(r.den) <= 0) return true;
  return P.degree(P.gcd(r.num, r.den)) <= 0;
}

/** Divide out the common factor. */
export function reduce(r: Rational): Rational {
  const g = P.gcd(r.num, r.den);
  if (P.degree(g) <= 0) return r;
  let num = P.divmod(r.num, g).q;
  let den = P.divmod(r.den, g).q;
  const lead = den[den.length - 1];
  if (lead !== 0 && lead !== 1) {
    // Keep integer-looking coefficients where possible: normalise so the constant fraction stays readable.
    if (P.degree(den) === 0) {
      num = P.scale(num, 1 / lead);
      den = [1];
    }
  }
  return { num, den, excluded: r.excluded };
}

export function rationalText(r: Rational, v = 'x'): string {
  const n = P.polyText(r.num, v);
  const d = P.trim(r.den);
  if (P.degree(d) <= 0) {
    if (Math.abs(d[0] - 1) < 1e-12) return n;
    return `${P.degree(r.num) <= 0 ? n : `(${n})`}/${P.polyText(d, v)}`;
  }
  const wrap = (s: string, p: P.Poly) => (p.filter((c) => Math.abs(c) > 1e-12).length > 1 ? `(${s})` : s);
  return `${wrap(n, r.num)}/${wrap(P.polyText(d, v), d)}`;
}

// ---------- Answer text helpers ----------

/** "It can't be simplified", "already in simplest form", ... */
export function isCannotSimplifyPhrase(s: string): boolean {
  const t = s.toLowerCase().replace(/[’']/g, "'");
  return (
    /\b(can ?not|can't|cant|cannot|does ?n't|doesn't|doesnt|won't|wont|not possible to|unable to|no way to)\s*(be\s*)?(further\s*)?(simplif|cancel|reduc)/.test(t) ||
    /\b(already|fully)\s*(in\s*)?(its\s*)?(simplest|simplified|lowest)/.test(t) ||
    /\bno (common )?factors?\b/.test(t) ||
    /\b(not|isn't|is not) simplifiable\b/.test(t)
  );
}

const EXCL_SPLIT = /[,;]?\s*(?:where|for|with|and|but)?\s*[a-z]\s*(?:≠|!=|=\/=|<>|is not|isn't|cannot be|can't be|can not be|must not be|not equal to|≠)/i;

/** Split "(x+5)/(x+3), x ≠ 0, -3" into expression and restriction text. */
export function splitAnswerAndExclusions(s: string): { expr: string; exclusions: string | null } {
  const m = EXCL_SPLIT.exec(s);
  if (!m) return { expr: s.trim(), exclusions: null };
  return { expr: s.slice(0, m.index).trim().replace(/[,;]$/, ''), exclusions: s.slice(m.index).trim() };
}

export type ExclusionParse = { kind: 'none-given' } | { kind: 'values'; values: number[] } | { kind: 'error'; error: string };

/** Read the x-values a student says are not allowed. */
export function parseExclusions(text: string | null | undefined): ExclusionParse {
  const raw = (text ?? '').trim();
  if (!raw) return { kind: 'none-given' };
  const t = normalizeSymbols(raw).toLowerCase();
  if (/^(none|no|nothing|n\/a|no restrictions?|all (real )?numbers|any value)\.?$/.test(t)) return { kind: 'values', values: [] };
  const cleaned = t.replace(/[a-z]\s*\^\s*\d+/g, ' ');
  const toks = cleaned.match(/-?\s*\d+(?:\.\d+)?(?:\s*\/\s*\d+)?/g);
  if (!toks) return { kind: 'error', error: 'I couldn’t find any numbers in the restriction.' };
  const values = toks.map((tok) => {
    const s = tok.replace(/\s+/g, '');
    if (s.includes('/')) {
      const [a, b] = s.split('/').map(Number);
      return a / b;
    }
    return Number(s);
  });
  return { kind: 'values', values: mergeRoots(values.filter((x) => Number.isFinite(x))) };
}

export function sameSet(a: number[], b: number[]): boolean {
  return a.length === b.length && a.every((x) => b.some((y) => Math.abs(x - y) < 1e-9));
}

export function exclusionsText(values: number[], v = 'x'): string {
  if (values.length === 0) return 'no excluded values';
  return values.map((x) => `${v} ≠ ${Number.isInteger(x) ? x : Math.round(x * 1000) / 1000}`).join(', ').replace(/-/g, '−');
}
