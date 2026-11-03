import { liveQuery } from 'dexie';
import { db, type Run } from '../db';

export const runs = liveQuery(() => db.runs.orderBy('day').toArray());

export async function saveRun(run: Omit<Run, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
  const existing = run.id ? await db.runs.get(run.id) : undefined;
  await db.runs.put({
    ...run,
    miles: Math.round(run.miles * 100) / 100,
    id: run.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export function deleteRun(id: string): Promise<void> {
  return db.runs.delete(id);
}
