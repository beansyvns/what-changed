// A small, safe arithmetic evaluator for the on-screen calculator (no eval).
// Supports + − × ÷ ^, brackets, decimals, unary minus, √ and %.

export type CalcResult = { ok: true; value: number } | { ok: false; error: string };

type Tok = { t: 'num'; v: number } | { t: 'op'; v: string };

function tokenize(src: string): Tok[] | string {
  const s = src.replace(/×/g, '*').replace(/÷/g, '/').replace(/−/g, '-').replace(/\s+/g, '');
  const out: Tok[] = [];
  let i = 0;
  while (i < s.length) {
    const c = s[i];
    if (/[0-9.]/.test(c)) {
      let j = i;
      while (j < s.length && /[0-9.]/.test(s[j])) j++;
      const raw = s.slice(i, j);
      if ((raw.match(/\./g) ?? []).length > 1 || raw === '.') return 'That number has too many dots.';
      out.push({ t: 'num', v: Number(raw) });
      i = j;
    } else if ('+-*/^()%√'.includes(c)) {
      out.push({ t: 'op', v: c });
      i++;
    } else if (s.startsWith('sqrt', i)) {
      out.push({ t: 'op', v: '√' });
      i += 4;
    } else return `I don’t know the symbol “${c}”.`;
  }
  return out;
}

export function calculate(src: string): CalcResult {
  if (!src.trim()) return { ok: false, error: '' };
  if (src.length > 200) return { ok: false, error: 'That’s too long.' };
  const toks = tokenize(src);
  if (typeof toks === 'string') return { ok: false, error: toks };
  let pos = 0;
  const peek = () => toks[pos];
  const isOp = (v: string) => peek()?.t === 'op' && peek()!.v === v;

  const fail = (error: string): never => {
    throw new Error(error);
  };

  function expr(): number {
    let v = term();
    while (isOp('+') || isOp('-')) {
      const op = (toks[pos++] as { v: string }).v;
      const r = term();
      v = op === '+' ? v + r : v - r;
    }
    return v;
  }
  function term(): number {
    let v = power();
    while (isOp('*') || isOp('/')) {
      const op = (toks[pos++] as { v: string }).v;
      const r = power();
      if (op === '/' && r === 0) fail('You can’t divide by 0.');
      v = op === '*' ? v * r : v / r;
    }
    return v;
  }
  function power(): number {
    const base = unary();
    if (isOp('^')) {
      pos++;
      return base ** power();
    }
    return base;
  }
  function unary(): number {
    if (isOp('-')) {
      pos++;
      return -unary();
    }
    if (isOp('+')) {
      pos++;
      return unary();
    }
    if (isOp('√')) {
      pos++;
      const v = unary();
      if (v < 0) fail('You can’t take the square root of a negative number here.');
      return Math.sqrt(v);
    }
    return postfix(primary());
  }
  function postfix(v: number): number {
    while (isOp('%')) {
      pos++;
      v = v / 100;
    }
    return v;
  }
  function primary(): number {
    const tk = peek();
    if (!tk) return fail('Finish the calculation first.');
    if (tk.t === 'num') {
      pos++;
      // "2(3)" means 2 × 3.
      if (isOp('(')) return tk.v * primary();
      return tk.v;
    }
    if (tk.v === '(') {
      pos++;
      const v = expr();
      if (!isOp(')')) fail('A bracket is missing a “)”.');
      pos++;
      if (isOp('(')) return v * primary();
      return v;
    }
    return fail('Check the order of the symbols.');
  }

  try {
    const value = expr();
    if (pos < toks.length) return { ok: false, error: isOp(')') ? 'There’s an extra “)”.' : 'Check the order of the symbols.' };
    if (!Number.isFinite(value)) return { ok: false, error: 'That number is too big.' };
    return { ok: true, value };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/** Show a result without float noise: 0.1 + 0.2 → 0.3, 2/3 → 0.6666666667. */
export function formatCalc(n: number): string {
  if (Number.isInteger(n)) return String(n);
  return String(Number(n.toPrecision(10)));
}
