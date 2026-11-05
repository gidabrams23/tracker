import { liveQuery } from 'dexie';
import { db, type WorkoutSession, type WorkoutSet } from '../db';
import { dayKey } from '../day';
import { isPersonalBest, ladderWeights, type Block, type BlockKind, type Step } from './plan';

export const BICEPS_BACK = 'biceps-back';

export function newBlock(kind: BlockKind, exerciseIds: string[], sets = 4, optional = false): Block {
  return { id: crypto.randomUUID(), kind, exerciseIds, sets, ...(optional ? { optional } : {}) };
}

const pair = (a: string, b: string) => newBlock('superset', [a, b]);

/**
 * Gid's workout days, built from his notes. Exercises are paired in the order the notes list
 * them, alternating sets within each pair. Everything can be swapped or reordered in the app.
 */
export const WORKOUT_DAYS: { id: string; name: string; blocks: () => Block[] }[] = [
  {
    id: BICEPS_BACK,
    name: 'Biceps & Back',
    blocks: () => [
      pair('db-curl', 'bent-row'),
      pair('zottman-curl', 'pull-up'),
      pair('hammer-curl', 'seated-row'),
      newBlock('single', ['hanging-leg-raise'], 3, true),
      ladderBlock('db-curl'),
    ],
  },
  {
    id: 'chest-tris',
    name: 'Chest & Tris',
    blocks: () => [
      pair('low-high-fly', 'db-overhead-extension'),
      pair('incline-bench', 'fly-machine'),
      pair('incline-seated-fly', 'bench-dips'),
      newBlock('single', ['db-press']),
    ],
  },
  {
    id: 'arms',
    name: 'Arms',
    blocks: () => [
      pair('seated-barbell-curl', 'tricep-dips'),
      pair('zottman-curl', 'db-tricep-extension'),
      pair('hammer-curl', 'tricep-pulldown'),
      ladderBlock('db-curl'),
    ],
  },
  {
    id: 'shoulders',
    name: 'Shoulders',
    blocks: () => [
      pair('front-raise', 'db-shoulder-press'),
      pair('shrugs', 'lateral-raise'),
      pair('lifts', 'iyt'),
      newBlock('single', ['cross-body-curl']),
    ],
  },
];

/** Bicep ladder from Gid's notes: start at 30, work up to 70, then back down. */
export function ladderBlock(exerciseId: string): Block {
  const ladder = { start: 30, peak: 70, step: 10 };
  return { ...newBlock('ladder', [exerciseId], ladderWeights(ladder).length), ladder };
}

/** Adds any workout day that isn't saved yet. Never touches days you've already customized. */
export async function ensureTemplates(): Promise<void> {
  for (const d of WORKOUT_DAYS) {
    if (!(await db.workoutTemplates.get(d.id))) {
      await db.workoutTemplates.put({ id: d.id, name: d.name, blocks: d.blocks(), updatedAt: Date.now() });
    }
  }
}

export const templates = liveQuery(() => db.workoutTemplates.toArray());
export const sessions = liveQuery(() => db.workoutSessions.orderBy('startedAt').reverse().toArray());
export const allWorkoutSets = liveQuery(() => db.workoutSets.orderBy('loggedAt').toArray());

export async function startSession(templateId: string): Promise<string> {
  const t = await db.workoutTemplates.get(templateId);
  if (!t) throw new Error('Unknown workout');
  const id = crypto.randomUUID();
  await db.workoutSessions.add({
    id,
    day: dayKey(),
    templateId,
    name: t.name,
    // Fresh block ids per session; keep the template's arrangement.
    blocks: t.blocks.map((b) => ({ ...b, id: crypto.randomUUID(), done: undefined })),
    startedAt: Date.now(),
  });
  return id;
}

/** Saves a session's plan and remembers the arrangement on its template for next time. */
export async function updateSessionBlocks(session: WorkoutSession, blocks: Block[]): Promise<void> {
  const clean = $snapshot(blocks);
  await db.transaction('rw', db.workoutSessions, db.workoutTemplates, async () => {
    await db.workoutSessions.update(session.id, { blocks: clean });
    await db.workoutTemplates.update(session.templateId, {
      blocks: clean.map((b) => ({ ...b, done: undefined })),
      updatedAt: Date.now(),
    });
  });
}

export async function saveTemplateBlocks(templateId: string, blocks: Block[]): Promise<void> {
  await db.workoutTemplates.update(templateId, { blocks: $snapshot(blocks), updatedAt: Date.now() });
}

export async function resetTemplate(templateId: string): Promise<void> {
  const day = WORKOUT_DAYS.find((d) => d.id === templateId);
  if (day) await saveTemplateBlocks(templateId, day.blocks());
}

export async function logWorkoutSet(
  session: WorkoutSession,
  step: Step,
  weight: number,
  reps: number,
): Promise<{ personalBest: boolean }> {
  // A best means beating every earlier workout, and only the first time this session.
  const history = await db.workoutSets.where('exerciseId').equals(step.exerciseId).toArray();
  const earlier = history.filter((s) => s.sessionId !== session.id);
  const today = history.filter((s) => s.sessionId === session.id);
  const set = { weight, reps };
  const personalBest =
    isPersonalBest(set, earlier) && (today.length === 0 || (isPersonalBest(set, today) && !today.some((s) => isPersonalBest(s, earlier))));
  await db.workoutSets.add({
    id: crypto.randomUUID(),
    sessionId: session.id,
    day: session.day,
    blockId: step.blockId,
    slot: step.slot,
    setIndex: step.setIndex,
    exerciseId: step.exerciseId,
    weight,
    reps,
    loggedAt: Date.now(),
  });
  return { personalBest };
}

export function updateWorkoutSet(id: string, weight: number, reps: number): Promise<number> {
  return db.workoutSets.update(id, { weight, reps });
}

export function deleteWorkoutSet(id: string): Promise<void> {
  return db.workoutSets.delete(id);
}

export function finishSession(id: string): Promise<number> {
  return db.workoutSessions.update(id, { endedAt: Date.now() });
}

export async function discardSession(id: string): Promise<void> {
  await db.transaction('rw', db.workoutSessions, db.workoutSets, async () => {
    await db.workoutSets.where('sessionId').equals(id).delete();
    await db.workoutSessions.delete(id);
  });
}

/** Sets of this exercise from the most recent other session that did it. */
export function lastTimeSets(all: WorkoutSet[], exerciseId: string, excludeSessionId: string): WorkoutSet[] {
  const prior = all.filter((s) => s.exerciseId === exerciseId && s.sessionId !== excludeSessionId);
  if (!prior.length) return [];
  const lastSession = prior[prior.length - 1].sessionId;
  return prior.filter((s) => s.sessionId === lastSession).sort((a, b) => a.setIndex - b.setIndex);
}

// Svelte 5 $state proxies can't be stored in IndexedDB; this strips them.
function $snapshot<T>(v: T): T {
  return JSON.parse(JSON.stringify(v)) as T;
}
