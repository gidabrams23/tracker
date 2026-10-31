import { db, SCHEMA_VERSION, type MetaRow, type PushupSet } from './db';
import { dayKey } from './day';

interface BackupFile {
  app: 'tracker';
  schemaVersion: number;
  exportedAt: string;
  /** Every table, keyed by name (schema 2+). */
  tables?: Record<string, unknown[]>;
  /** Schema 1 backups stored these at the top level. */
  pushupSets?: PushupSet[];
  meta?: MetaRow[];
}

export async function exportBackup(): Promise<'shared' | 'downloaded' | 'cancelled'> {
  const tables: Record<string, unknown[]> = {};
  for (const t of db.tables) tables[t.name] = await t.toArray();
  tables.meta = (tables.meta as MetaRow[]).filter((m) => m.key !== 'lastBackupAt');

  const data: BackupFile = {
    app: 'tracker',
    schemaVersion: SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    tables,
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

/** Merges a backup into the current data. Records with the same id are overwritten. Returns records restored. */
export async function importBackup(file: File): Promise<number> {
  const data = JSON.parse(await file.text()) as Partial<BackupFile>;
  if (data.app !== 'tracker') throw new Error('This file is not a Tracker backup.');
  if ((data.schemaVersion ?? 0) > SCHEMA_VERSION) {
    throw new Error('This backup is from a newer version of the app. Update the app first.');
  }
  const tables = data.tables ?? { pushupSets: data.pushupSets ?? [], meta: data.meta ?? [] };
  const known = new Set(db.tables.map((t) => t.name));
  let count = 0;
  await db.transaction('rw', db.tables, async () => {
    for (const [name, rows] of Object.entries(tables)) {
      if (!known.has(name) || !Array.isArray(rows)) continue;
      await db.table(name).bulkPut(rows);
      count += rows.length;
    }
  });
  return count;
}

export async function lastBackupAt(): Promise<number | null> {
  const row = await db.meta.get('lastBackupAt');
  return typeof row?.value === 'number' ? row.value : null;
}
