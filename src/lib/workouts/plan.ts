// Pure workout-plan logic: which set comes next, prefill, personal bests.

export type BlockKind = 'superset' | 'single' | 'ladder';

export interface Block {
  /** Stable id so logged sets survive reordering. */
  id: string;
  kind: BlockKind;
  /** One exercise per slot. A superset alternates through its slots each round. */
  exerciseIds: string[];
  /** Planned rounds (sets per exercise). For a ladder, planned rungs. */
  sets: number;
  /** Ended early or optional block skipped. */
  done?: boolean;
  /** Optional blocks (abs) can be skipped without counting as unfinished. */
  optional?: boolean;
  /** Weight ladder: climb from start to peak by step, then back down. Sets = rung count. */
  ladder?: LadderSpec;
}

export interface LadderSpec {
  start: number;
  peak: number;
  step: number;
}

/** 30→70 by 10 gives 30, 40, 50, 60, 70, 60, 50, 40, 30. */
export function ladderWeights({ start, peak, step }: LadderSpec): number[] {
  if (step <= 0 || peak < start) return [start];
  const up: number[] = [];
  for (let w = start; w <= peak; w += step) up.push(w);
  if (up[up.length - 1] !== peak) up.push(peak);
  return [...up, ...up.slice(0, -1).reverse()];
}

export interface Step {
  blockId: string;
  slot: number;
  setIndex: number;
  exerciseId: string;
}

export interface LoggedSet {
  blockId: string;
  slot: number;
  setIndex: number;
  exerciseId: string;
  weight: number;
  reps: number;
  sessionId?: string;
  loggedAt?: number;
}

/** Steps in the order they're performed: curl 1, row 1, curl 2, row 2, … */
export function blockSteps(block: Block): Step[] {
  const steps: Step[] = [];
  for (let setIndex = 0; setIndex < block.sets; setIndex++) {
    block.exerciseIds.forEach((exerciseId, slot) => steps.push({ blockId: block.id, slot, setIndex, exerciseId }));
  }
  return steps;
}

const key = (s: { blockId: string; slot: number; setIndex: number }) => `${s.blockId}:${s.slot}:${s.setIndex}`;

export function isLogged(step: Step, logged: LoggedSet[]): boolean {
  return logged.some((l) => key(l) === key(step));
}

export function blockComplete(block: Block, logged: LoggedSet[]): boolean {
  return block.done === true || blockSteps(block).every((s) => isLogged(s, logged));
}

/** The first unlogged step in plan order, skipping blocks marked done. */
export function nextStep(blocks: Block[], logged: LoggedSet[]): Step | null {
  const done = new Set(logged.map(key));
  for (const b of blocks) {
    if (b.done) continue;
    for (const s of blockSteps(b)) if (!done.has(key(s))) return s;
  }
  return null;
}

export interface Prefill {
  weight: number;
  reps: number;
}

/**
 * What to pre-fill for a step, in priority order:
 * 1. The previous set of the same exercise slot in this session ("assume the same weight").
 * 2. The same set number from the last session that did this exercise.
 * 3. The exercise's defaults.
 */
export function prefillFor(
  step: Step,
  current: LoggedSet[],
  lastSession: LoggedSet[],
  fallback: Prefill,
  block?: Block,
): Prefill {
  const result = carryForward(step, current, lastSession, fallback);
  // A ladder's weight comes from its rung; reps still carry forward.
  if (block?.ladder) {
    const weights = ladderWeights(block.ladder);
    result.weight = weights[step.setIndex] ?? weights[weights.length - 1];
  }
  return result;
}

function carryForward(step: Step, current: LoggedSet[], lastSession: LoggedSet[], fallback: Prefill): Prefill {
  const earlier = current
    .filter((l) => l.blockId === step.blockId && l.slot === step.slot && l.setIndex < step.setIndex)
    .sort((a, b) => b.setIndex - a.setIndex)[0];
  if (earlier) return { weight: earlier.weight, reps: earlier.reps };

  const prior = lastSession.filter((l) => l.exerciseId === step.exerciseId).sort((a, b) => a.setIndex - b.setIndex);
  if (prior.length) {
    const same = prior.find((l) => l.setIndex === step.setIndex) ?? prior[prior.length - 1];
    return { weight: same.weight, reps: same.reps };
  }
  return { ...fallback };
}

/** Epley estimated one-rep max. Bodyweight-only sets (weight 0) compare on reps instead. */
export function score(weight: number, reps: number): number {
  return weight > 0 ? weight * (1 + reps / 30) : reps;
}

/** True when this set beats every earlier set of the same exercise. A first-ever set is not a PR. */
export function isPersonalBest(set: { weight: number; reps: number }, history: { weight: number; reps: number }[]): boolean {
  if (history.length === 0) return false;
  const best = Math.max(...history.map((h) => score(h.weight, h.reps)));
  return score(set.weight, set.reps) > best;
}
