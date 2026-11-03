import { describe, expect, it } from 'vitest';
import { bests, formatDuration, formatPace, milestones, monthlySeries, pace, totals, weeklySeries } from './stats';
import { weekStart } from '../day';

// 2026-11-04 is a Wednesday; its week starts Monday 2026-11-02.
const TODAY = '2026-11-04';
const run = (id: string, day: string, miles: number, seconds?: number) => ({ id, day, miles, seconds });

describe('weekStart', () => {
  it('uses Monday', () => {
    expect(weekStart('2026-11-04')).toBe('2026-11-02');
    expect(weekStart('2026-11-08')).toBe('2026-11-02'); // Sunday belongs to the same week
    expect(weekStart('2026-11-02')).toBe('2026-11-02');
  });
});

describe('totals', () => {
  const runs = [
    run('a', '2026-11-01', 5), // last week (Sunday)
    run('b', '2026-11-02', 3.1),
    run('c', '2026-11-04', 4.25),
    run('d', '2026-10-15', 6),
    run('e', '2025-12-31', 2),
  ];
  it('sums week, month, year and all time', () => {
    expect(totals(runs, TODAY)).toEqual({ week: 7.35, month: 12.35, year: 18.35, all: 20.35, weekRuns: 2 });
  });
});

describe('series', () => {
  it('buckets weeks oldest first, ending this week', () => {
    const w = weeklySeries([run('a', '2026-11-01', 5), run('b', '2026-11-03', 2)], TODAY, 2);
    expect(w).toEqual([
      { start: '2026-10-26', miles: 5 },
      { start: '2026-11-02', miles: 2 },
    ]);
  });
  it('buckets months across a year boundary', () => {
    const m = monthlySeries([run('a', '2025-12-10', 4)], '2026-01-05', 2);
    expect(m).toEqual([
      { month: '2025-12', miles: 4 },
      { month: '2026-01', miles: 0 },
    ]);
  });
});

describe('pace and formatting', () => {
  it('computes seconds per mile', () => {
    expect(pace(run('a', TODAY, 4, 32 * 60))).toBe(480);
    expect(pace(run('a', TODAY, 4))).toBeNull();
    expect(formatPace(485)).toBe('8:05');
    expect(formatDuration(3730)).toBe('1:02:10');
    expect(formatDuration(2530)).toBe('42:10');
  });
});

describe('bests', () => {
  it('finds longest and fastest (1 mi+)', () => {
    const runs = [run('a', TODAY, 7, 3600), run('b', TODAY, 3, 1350), run('c', TODAY, 0.5, 120)];
    const b = bests(runs);
    expect(b.longest?.id).toBe('a');
    expect(b.fastest?.id).toBe('b');
  });
});

describe('milestones', () => {
  it('records the first day each whole mile was reached', () => {
    const runs = [run('a', '2026-07-24', 4), run('b', '2026-08-01', 3), run('c', '2026-08-11', 5.2), run('d', '2026-08-29', 7)];
    expect(milestones(runs)).toEqual([
      { miles: 1, day: '2026-07-24' },
      { miles: 2, day: '2026-07-24' },
      { miles: 3, day: '2026-07-24' },
      { miles: 4, day: '2026-07-24' },
      { miles: 5, day: '2026-08-11' },
      { miles: 6, day: '2026-08-29' },
      { miles: 7, day: '2026-08-29' },
    ]);
  });
});
