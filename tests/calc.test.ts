import { describe, expect, it } from 'vitest';
import { calculate, formatCalc } from '../shared/calc.js';

const val = (s: string) => {
  const r = calculate(s);
  return r.ok ? formatCalc(r.value) : `error: ${r.error}`;
};

describe('calculator', () => {
  it('does school arithmetic in the right order', () => {
    expect(val('30 + 60')).toBe('90');
    expect(val('(30 + 60) ÷ 2')).toBe('45');
    expect(val('120 / 3')).toBe('40');
    expect(val('2 + 3 × 4')).toBe('14');
    expect(val('2 × (3 + 4)')).toBe('14');
    expect(val('2(3 + 4)')).toBe('14');
    expect(val('−5 + 2')).toBe('-3');
    expect(val('2 ^ 3')).toBe('8');
    expect(val('√16')).toBe('4');
    expect(val('50%')).toBe('0.5');
    expect(val('0.1 + 0.2')).toBe('0.3');
    expect(val('2 / 3')).toBe('0.6666666667');
  });

  it('explains mistakes instead of crashing', () => {
    expect(val('5 / 0')).toMatch(/divide by 0/);
    expect(val('(2 + 3')).toMatch(/bracket/);
    expect(val('2 + 3)')).toMatch(/extra/);
    expect(val('2 +')).toMatch(/Finish/);
    expect(val('1.2.3')).toMatch(/dots/);
    expect(val('alert(1)')).toMatch(/symbol/);
  });
});
