import { liveQuery } from 'dexie';
import { db, type PushupSet, type PushupSource } from './db';
import { dayKey } from './day';

export const allSets = liveQuery(() => db.pushupSets.orderBy('loggedAt').toArray());

export async function logSet(reps: number, source: PushupSource, at: Date = new Date()): Promise<void> {
  if (!Number.isFinite(reps) || reps <= 0) return;
  await db.pushupSets.add({
    id: crypto.randomUUID(),
    day: dayKey(at),
    reps: Math.round(reps),
    loggedAt: at.getTime(),
    source,
  });
}

export function deleteSet(id: string): Promise<void> {
  return db.pushupSets.delete(id);
}

/** Removes the most recent set logged today. */
export async function undoLastToday(today: string): Promise<void> {
  const last = await db.pushupSets.where('day').equals(today).reverse().sortBy('loggedAt');
  if (last.length) await db.pushupSets.delete(last[0].id);
}

export function totalsByDay(sets: PushupSet[]): Map<string, number> {
  const totals = new Map<string, number>();
  for (const s of sets) totals.set(s.day, (totals.get(s.day) ?? 0) + s.reps);
  return totals;
}
