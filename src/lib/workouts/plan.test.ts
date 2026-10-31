import { describe, expect, it } from 'vitest';
import { blockSteps, isPersonalBest, ladderWeights, nextStep, prefillFor, type Block, type LoggedSet } from './plan';

const superset: Block = { id: 'b1', kind: 'superset', exerciseIds: ['curl', 'row'], sets: 4 };
const ladder: Block = { id: 'b2', kind: 'ladder', exerciseIds: ['curl'], sets: 3 };

const log = (blockId: string, slot: number, setIndex: number, exerciseId: string, weight = 25, reps = 10): LoggedSet => ({
  blockId,
  slot,
  setIndex,
  exerciseId,
  weight,
  reps,
});

describe('blockSteps', () => {
  it('alternates superset exercises each round', () => {
    const order = blockSteps(superset).map((s) => `${s.exerciseId}${s.setIndex + 1}`);
    expect(order).toEqual(['curl1', 'row1', 'curl2', 'row2', 'curl3', 'row3', 'curl4', 'row4']);
  });
});

describe('nextStep', () => {
  it('starts at the first exercise', () => {
    expect(nextStep([superset, ladder], [])).toMatchObject({ exerciseId: 'curl', setIndex: 0 });
  });

  it('moves to the paired exercise after the first set', () => {
    expect(nextStep([superset], [log('b1', 0, 0, 'curl')])).toMatchObject({ exerciseId: 'row', setIndex: 0 });
  });

  it('moves to the next block when one is finished', () => {
    const logged = blockSteps(superset).map((s) => log(s.blockId, s.slot, s.setIndex, s.exerciseId));
    expect(nextStep([superset, ladder], logged)).toMatchObject({ blockId: 'b2', setIndex: 0 });
  });

  it('skips blocks marked done', () => {
    expect(nextStep([{ ...superset, done: true }, ladder], [])).toMatchObject({ blockId: 'b2' });
  });

  it('is null when everything is logged', () => {
    expect(nextStep([{ ...ladder, sets: 1 }], [log('b2', 0, 0, 'curl')])).toBeNull();
  });
});

describe('prefillFor', () => {
  const fallback = { weight: 20, reps: 8 };

  it('carries the previous set of this exercise forward', () => {
    const step = { blockId: 'b1', slot: 0, setIndex: 2, exerciseId: 'curl' };
    const current = [log('b1', 0, 0, 'curl', 25, 10), log('b1', 1, 0, 'row', 95, 10), log('b1', 0, 1, 'curl', 30, 8)];
    expect(prefillFor(step, current, [], fallback)).toEqual({ weight: 30, reps: 8 });
  });

  it('uses the same set from last session for a first set', () => {
    const step = { blockId: 'b1', slot: 0, setIndex: 0, exerciseId: 'curl' };
    const last = [log('old', 0, 0, 'curl', 30, 10), log('old', 0, 1, 'curl', 35, 8)];
    expect(prefillFor(step, [], last, fallback)).toEqual({ weight: 30, reps: 10 });
  });

  it('falls back to defaults for a new exercise', () => {
    const step = { blockId: 'b1', slot: 0, setIndex: 0, exerciseId: 'curl' };
    expect(prefillFor(step, [], [], fallback)).toEqual(fallback);
  });
});

describe('ladder', () => {
  it('climbs to the peak and back down', () => {
    expect(ladderWeights({ start: 30, peak: 70, step: 10 })).toEqual([30, 40, 50, 60, 70, 60, 50, 40, 30]);
  });
  it('includes an uneven peak', () => {
    expect(ladderWeights({ start: 30, peak: 65, step: 10 })).toEqual([30, 40, 50, 60, 65, 60, 50, 40, 30]);
  });
  it('prefills the rung weight but carries reps forward', () => {
    const block: Block = { id: 'L', kind: 'ladder', exerciseIds: ['curl'], sets: 9, ladder: { start: 30, peak: 70, step: 10 } };
    const step = { blockId: 'L', slot: 0, setIndex: 2, exerciseId: 'curl' };
    const current = [log('L', 0, 0, 'curl', 30, 12), log('L', 0, 1, 'curl', 40, 10)];
    expect(prefillFor(step, current, [], { weight: 0, reps: 8 }, block)).toEqual({ weight: 50, reps: 10 });
  });
});

describe('isPersonalBest', () => {
  it('is false for a first-ever set', () => {
    expect(isPersonalBest({ weight: 30, reps: 10 }, [])).toBe(false);
  });
  it('detects heavier or more reps', () => {
    expect(isPersonalBest({ weight: 35, reps: 8 }, [{ weight: 30, reps: 8 }])).toBe(true);
    expect(isPersonalBest({ weight: 30, reps: 7 }, [{ weight: 30, reps: 8 }])).toBe(false);
  });
  it('compares bodyweight sets on reps', () => {
    expect(isPersonalBest({ weight: 0, reps: 11 }, [{ weight: 0, reps: 10 }])).toBe(true);
  });
});
