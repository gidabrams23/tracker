import 'fake-indexeddb/auto';
import Dexie from 'dexie';
import { describe, expect, it } from 'vitest';

// Guards the most important promise of the app: upgrading never loses push-up history.
describe('schema upgrade v1 → latest', () => {
  it('keeps existing push-up sets and settings', async () => {
    const v1 = new Dexie('tracker');
    v1.version(1).stores({ pushupSets: 'id, day, loggedAt', meta: 'key' });
    await v1.table('pushupSets').add({ id: 'a', day: '2026-10-30', reps: 120, loggedAt: 1, source: 'quick' });
    await v1.table('meta').put({ key: 'settings', value: { goals: [100, 100, 100, 100, 100, 100, 100] } });
    v1.close();

    const { db } = await import('./db');
    await db.open();
    expect(db.verno).toBe(3);
    expect(await db.pushupSets.count()).toBe(1);
    expect((await db.pushupSets.get('a'))?.reps).toBe(120);
    expect(await db.meta.get('settings')).toBeTruthy();
    expect(await db.workoutSets.count()).toBe(0);
    expect(await db.albums.count()).toBe(0);
    expect(await db.runs.count()).toBe(0);
  });
});
