// Polynomials in one variable, stored as coefficient arrays: [c0, c1, c2, ...] = c0 + c1·x + c2·x² ...
// Coefficients are plain numbers; comparisons use a small tolerance.

export type Poly = number[];

const EPS = 1e-9;

export function trim(p: Poly): Poly {
  const out = p.slice();
  while (out.length > 1 && Math.abs(out[out.length - 1]) < EPS) out.pop();
  if (out.length === 0) return [0];
  return out.map((c) => (Math.abs(c) < EPS ? 0 : c));
}

export const constant = (c: number): Poly => [c];
export const variable = (): Poly => [0, 1];

export function degree(p: Poly): number {
  const t = trim(p);
  return t.length === 1 && t[0] === 0 ? -Infinity : t.length - 1;
}

export function isZero(p: Poly): boolean {
  return trim(p).every((c) => Math.abs(c) < EPS);
}

export function add(a: Poly, b: Poly): Poly {
  const n = Math.max(a.length, b.length);
  const out: Poly = [];
  for (let i = 0; i < n; i++) out.push((a[i] ?? 0) + (b[i] ?? 0));
  return trim(out);
}

export function scale(a: Poly, k: number): Poly {
  return trim(a.map((c) => c * k));
}

export function sub(a: Poly, b: Poly): Poly {
  return add(a, scale(b, -1));
}

export function mul(a: Poly, b: Poly): Poly {
  const out: Poly = new Array(a.length + b.length - 1).fill(0);
  for (let i = 0; i < a.length; i++) for (let j = 0; j < b.length; j++) out[i + j] += a[i] * b[j];
  return trim(out);
}

export function pow(a: Poly, n: number): Poly {
  let out: Poly = [1];
  for (let i = 0; i < n; i++) out = mul(out, a);
  return out;
}

export function evaluate(p: Poly, x: number): number {
  let y = 0;
  for (let i = p.length - 1; i >= 0; i--) y = y * x + p[i];
  return y;
}

/** Polynomial long division: a = q·b + r. */
export function divmod(a: Poly, b: Poly): { q: Poly; r: Poly } {
  let r = trim(a);
  const d = trim(b);
  const db = degree(d);
  if (db === -Infinity) throw new Error('Division by zero polynomial');
  const q: Poly = new Array(Math.max(1, r.length - d.length + 1)).fill(0);
  while (!isZero(r) && degree(r) >= db) {
    const shift = degree(r) - db;
    const k = r[r.length - 1] / d[d.length - 1];
    q[shift] = k;
    const term: Poly = new Array(shift + 1).fill(0);
    term[shift] = k;
    r = sub(r, mul(term, d));
  }
  return { q: trim(q), r: trim(r) };
}

/** Monic greatest common divisor (degree 0 means no common factor). */
export function gcd(a: Poly, b: Poly): Poly {
  let x = trim(a);
  let y = trim(b);
  while (!isZero(y)) {
    const { r } = divmod(x, y);
    // Clean tiny floating residue so Euclid terminates sensibly.
    const maxC = Math.max(...r.map(Math.abs), 0);
    const cleaned = maxC < 1e-7 ? [0] : r;
    x = y;
    y = trim(cleaned);
  }
  const lead = x[x.length - 1];
  return lead === 0 ? [1] : scale(x, 1 / lead);
}

function intDivisors(n: number): number[] {
  n = Math.abs(Math.round(n));
  const out: number[] = [];
  for (let i = 1; i <= Math.min(n, 100000); i++) if (n % i === 0) out.push(i);
  return out;
}

/**
 * Real rational roots of a polynomial with integer coefficients (rational root theorem).
 * Enough for the checked concept packs, which only use integer roots.
 */
export function rationalRoots(p: Poly): number[] {
  let t = trim(p);
  if (degree(t) <= 0) return [];
  const roots: number[] = [];
  // Factor out x^k: root 0.
  if (Math.abs(t[0]) < EPS) {
    roots.push(0);
    while (t.length > 1 && Math.abs(t[0]) < EPS) t = t.slice(1);
  }
  if (degree(t) <= 0) return roots;
  if (!t.every((c) => Math.abs(c - Math.round(c)) < 1e-9)) {
    // Non-integer coefficients: fall back to a fine scan for simple roots.
    for (let x = -50; x <= 50; x += 0.5) if (Math.abs(evaluate(t, x)) < 1e-9 && !roots.includes(x)) roots.push(x);
    return roots.sort((a, b) => a - b);
  }
  const ps = intDivisors(t[0]);
  const qs = intDivisors(t[t.length - 1]);
  for (const pp of ps)
    for (const qq of qs)
      for (const s of [1, -1]) {
        const x = (s * pp) / qq;
        if (Math.abs(evaluate(t, x)) < 1e-9 && !roots.some((r) => Math.abs(r - x) < 1e-9)) roots.push(x);
      }
  return roots.sort((a, b) => a - b);
}

/** Readable text for a polynomial in the given variable, e.g. [0,5,1] → "x^2 + 5x". */
export function polyText(p: Poly, v = 'x'): string {
  const t = trim(p);
  const parts: string[] = [];
  for (let i = t.length - 1; i >= 0; i--) {
    const c = t[i];
    if (Math.abs(c) < EPS) continue;
    const abs = Math.abs(c);
    const num = Number.isInteger(abs) ? String(abs) : String(Math.round(abs * 1000) / 1000);
    const coef = i === 0 ? num : abs === 1 ? '' : num;
    const term = i === 0 ? coef : i === 1 ? `${coef}${v}` : `${coef}${v}^${i}`;
    if (parts.length === 0) parts.push(c < 0 ? `-${term}` : term);
    else parts.push(c < 0 ? `- ${term}` : `+ ${term}`);
  }
  return parts.length ? parts.join(' ') : '0';
}
