import { db, SCHEMA_VERSION, type MetaRow, type PushupSet } from './db';
import { dayKey } from './day';

interface BackupFile {
  app: 'tracker';
  schemaVersion: number;
  exportedAt: string;
  pushupSets: PushupSet[];
  meta: MetaRow[];
}

export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const data: BackupFile = {
    app: 'tracker',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    pushupSets: await db.pushupSets.toArray(),
    meta: (await db.meta.toArray()).filter((m) => m.key !== 'lastBackupAt'),
  };
  const name = `tracker-backup-${dayKey()}.json`;
  const file = new File([JSON.stringify(data, null, 2)], name, { type: 'application/json' });

  let result: 'shared' | 'downloaded' | 'cancelled';
  if (navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title: name });
      result = 'shared';
    } catch (e) {
      if ((e as DOMException).name === 'AbortError') return 'cancelled';
      throw e;
    }
  } else {
    const url = URL.createObjectURL(file);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    result = 'downloaded';
  }
  await db.meta.put({ key: 'lastBackupAt', value: Date.now() });
  return result;
}

/** Merges a backup into the current data. Records with the same id are overwritten. */
export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (data.app !== 'tracker' || !Array.isArray(data.pushupSets)) {
    throw new Error('This file is not a Tracker backup.');
  }
  if ((data.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error('This backup is from a newer version of the app. Update the app first.');
  }
  await db.transaction('rw', db.pushupSets, db.meta, async () => {
    await db.pushupSets.bulkPut(data.pushupSets!);
    if (Array.isArray(data.meta)) await db.meta.bulkPut(data.meta);
  });
  return data.pushupSets.length;
}

export async function lastBackupAt(): Promise<number | null> {
  const row = await db.meta.get('lastBackupAt');
  return typeof row?.value === 'number' ? row.value : null;
}
