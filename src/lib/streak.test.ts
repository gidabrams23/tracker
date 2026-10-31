import { describe, expect, it } from 'vitest';
import { computeStreak } from './streak';
import { addDays } from './day';

const START = '2026-10-01';
const goal100 = () => 100;

/** Build totals from a pattern string: 'x' = met, '.' = missed (logged 0), starting at START. */
function pattern(p: string): { totals: Map<string, number>; today: string } {
  const totals = new Map<string, number>();
  [...p].forEach((c, i) => totals.set(addDays(START, i), c === 'x' ? 100 : 0));
  return { totals, today: addDays(START, p.length - 1) };
}

describe('computeStreak', () => {
  it('is empty with no data', () => {
    expect(computeStreak(new Map(), goal100, START)).toEqual({ current: 0, best: 0, freezes: 0, atRisk: false });
  });

  it('counts consecutive met days including today', () => {
    const { totals, today } = pattern('xxx');
    expect(computeStreak(totals, goal100, today).current).toBe(3);
  });

  it('does not break on an unfinished today', () => {
    const { totals, today } = pattern('xx.');
    const r = computeStreak(totals, goal100, today);
    expect(r.current).toBe(2);
    expect(r.atRisk).toBe(false);
  });

  it('allows one grace miss, then flags at-risk', () => {
    const { totals, today } = pattern('xxx..');
    const r = computeStreak(totals, goal100, today);
    expect(r.current).toBe(3);
    expect(r.atRisk).toBe(true);
  });

  it('resets after two uncovered misses in a row', () => {
    const { totals, today } = pattern('xxx..x');
    expect(computeStreak(totals, goal100, today).current).toBe(1);
  });

  it('earns a freeze every 7 met days and spends it on a miss', () => {
    const { totals, today } = pattern('xxxxxxx..x');
    const r = computeStreak(totals, goal100, today);
    // day 8 spends the freeze, day 9 is grace, day 10 met
    expect(r.current).toBe(8);
    expect(r.freezes).toBe(0);
  });

  it('caps banked freezes at 2', () => {
    const { totals, today } = pattern('x'.repeat(30));
    expect(computeStreak(totals, goal100, today).freezes).toBe(2);
  });

  it('treats goal 0 days as rest days', () => {
    const { totals, today } = pattern('xx..xx');
    const rest = new Set([addDays(START, 2), addDays(START, 3)]);
    const r = computeStreak(totals, (d) => (rest.has(d) ? 0 : 100), today);
    expect(r.current).toBe(4);
  });

  it('tracks best streak after a reset', () => {
    const { totals, today } = pattern('xxxx...x');
    const r = computeStreak(totals, goal100, today);
    expect(r.best).toBe(4);
    expect(r.current).toBe(1);
  });
});
