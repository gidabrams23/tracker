import { describe, expect, it } from 'vitest';
import { thisWeekCount, tier, weekStreak } from './score';

const TODAY = '2026-11-04'; // Wednesday; week starts 2026-11-02
const a = (day: string) => ({ day });

describe('tier', () => {
  it('maps scores to labels at the boundaries', () => {
    expect(tier(100).label).toBe('All-timer');
    expect(tier(90).label).toBe('Classic');
    expect(tier(89).label).toBe('Great');
    expect(tier(0).label).toBe('Miss');
  });
});

describe('weekly goal', () => {
  it('counts only this Monday–Sunday week', () => {
    expect(thisWeekCount([a('2026-11-01'), a('2026-11-02'), a('2026-11-04')], TODAY)).toBe(2);
  });

  it('counts consecutive past weeks that hit the goal', () => {
    const albums = [
      ...['2026-10-26', '2026-10-28', '2026-10-30'].map(a), // last week: 3
      ...['2026-10-19', '2026-10-20', '2026-10-25'].map(a), // week before: 3
      ...['2026-10-12', '2026-10-13'].map(a), // only 2
    ];
    expect(weekStreak(albums, TODAY, 3)).toBe(2);
  });

  it('adds the current week once it is hit, without breaking while in progress', () => {
    const lastWeek = ['2026-10-26', '2026-10-28', '2026-10-30'].map(a);
    expect(weekStreak([...lastWeek, a('2026-11-02')], TODAY, 3)).toBe(1);
    expect(weekStreak([...lastWeek, ...['2026-11-02', '2026-11-03', '2026-11-04'].map(a)], TODAY, 3)).toBe(2);
  });
});
