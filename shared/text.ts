// Small text and number helpers shared by the browser and the server.

/** Format a number for display: integers as-is, others rounded to 2 dp with "≈" when rounding happened. */
export function fmt(n: number, maxDp = 2): string {
  if (!Number.isFinite(n)) return '—';
  const r = Math.round(n);
  if (Math.abs(n - r) < 1e-9) return String(r);
  const f = 10 ** maxDp;
  const rounded = Math.round(n * f) / f;
  const text = String(rounded);
  return Math.abs(rounded - n) > 1e-9 ? `≈ ${text}` : text;
}

/** Same as fmt but without the "≈" marker (for use inside formulas). */
export function fmtPlain(n: number, maxDp = 2): string {
  return fmt(n, maxDp).replace('≈ ', '');
}

export function money(n: number): string {
  const r = Math.round(n * 100) / 100;
  return Number.isInteger(r) ? `$${r}` : `$${r.toFixed(2)}`;
}

/** Unify unicode maths symbols so typed answers compare predictably. */
export function normalizeSymbols(s: string): string {
  return s
    .replace(/[−‒–—]/g, '-')
    .replace(/[×✕·⋅∙]/g, '*')
    .replace(/÷/g, '/')
    .replace(/²/g, '^2')
    .replace(/³/g, '^3')
    .replace(/[   ]/g, ' ');
}

export type ParsedNumber =
  | { kind: 'empty' }
  | { kind: 'none' }
  | { kind: 'ambiguous'; values: number[] }
  | { kind: 'number'; value: number; rest: string };

const NUM = /-?\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?/g;

function tokenValue(tok: string): number {
  if (tok.includes('/')) {
    const [a, b] = tok.split('/').map((t) => parseFloat(t.trim()));
    return b === 0 ? NaN : a / b;
  }
  return parseFloat(tok);
}

/**
 * Read a single numerical final answer from free text.
 * "40 km/h" → 40, "120/3 = 40" → 40 (takes what follows the last "="),
 * "$23" → 23, "40 or 45" → ambiguous.
 */
export function parseNumericAnswer(input: string): ParsedNumber {
  let s = normalizeSymbols(input).trim();
  if (!s) return { kind: 'empty' };
  s = s.replace(/(\d),(\d{3})\b/g, '$1$2').replace(/[$£€]/g, '');
  if (s.includes('=')) s = s.slice(s.lastIndexOf('=') + 1);
  const tokens = s.match(NUM) ?? [];
  if (tokens.length === 0) return { kind: 'none' };
  const values = tokens.map(tokenValue).filter((v) => Number.isFinite(v));
  if (values.length === 0) return { kind: 'none' };
  const distinct = values.filter((v, i) => values.findIndex((w) => Math.abs(w - v) < 1e-9) === i);
  if (distinct.length > 1) return { kind: 'ambiguous', values: distinct };
  const rest = s.replace(NUM, ' ').replace(/\s+/g, ' ').trim();
  return { kind: 'number', value: distinct[0], rest };
}

/** True if a typed value is close enough to the reference (allows rounding to 1–2 dp). */
export function closeTo(value: number, ref: number): boolean {
  if (Math.abs(value - ref) < 1e-6 * Math.max(1, Math.abs(ref))) return true;
  if (Number.isInteger(ref)) return false;
  return Math.abs(value - ref) <= 0.051;
}

/** Normalise text for evidence-quote matching: case, whitespace and symbol variants. */
export function normalizeForQuote(s: string): string {
  return normalizeSymbols(s).toLowerCase().replace(/\s+/g, ' ').trim();
}

/** An evidence quote is valid only if it really appears in the student's text. */
export function isQuoteOf(quote: string, source: string): boolean {
  const q = normalizeForQuote(quote).replace(/^["'“”‘’]+|["'“”‘’]+$/g, '');
  if (q.length < 2) return false;
  return normalizeForQuote(source).includes(q);
}

export function cap(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function gcdInt(a: number, b: number): number {
  a = Math.abs(Math.round(a));
  b = Math.abs(Math.round(b));
  while (b) [a, b] = [b, a % b];
  return a;
}

export function lcmInt(a: number, b: number): number {
  return Math.abs(Math.round(a * b)) / gcdInt(a, b);
}

/** Simplest fraction text for p/q, e.g. 8/2 → "4", 5/3 → "5/3". */
export function fractionText(p: number, q: number): string {
  if (Number.isInteger(p) && Number.isInteger(q) && q !== 0) {
    const g = gcdInt(p, q) || 1;
    let n = p / g;
    let d = q / g;
    if (d < 0) {
      n = -n;
      d = -d;
    }
    return d === 1 ? String(n) : `${n}/${d}`;
  }
  return fmt(p / q);
}
