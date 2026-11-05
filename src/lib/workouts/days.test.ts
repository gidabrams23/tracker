import 'fake-indexeddb/auto';
import { describe, expect, it } from 'vitest';
import { WORKOUT_DAYS } from './store';
import { EXERCISES } from './exercises';

// Every exercise a workout day uses must exist in the library, or it would show as a raw id.
describe('workout days', () => {
  const known = new Set(EXERCISES.map((e) => e.id));

  it('has the four days, in picker order', () => {
    expect(WORKOUT_DAYS.map((d) => d.name)).toEqual(['Biceps & Back', 'Chest & Tris', 'Arms', 'Shoulders']);
  });

  for (const d of WORKOUT_DAYS) {
    it(`${d.name} only uses known exercises`, () => {
      const ids = d.blocks().flatMap((b) => b.exerciseIds);
      expect(ids.filter((id) => !known.has(id))).toEqual([]);
    });
  }

  it('has unique exercise ids in the library', () => {
    expect(new Set(EXERCISES.map((e) => e.id)).size).toBe(EXERCISES.length);
  });
});
