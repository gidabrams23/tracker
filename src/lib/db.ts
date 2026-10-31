import Dexie, { type EntityTable } from 'dexie';

export type PushupSource = 'tap' | 'quick' | 'floor';

export interface PushupSet {
  id: string;
  day: string;
  reps: number;
  loggedAt: number;
  source: PushupSource;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export const db = new Dexie('tracker') as Dexie & {
  pushupSets: EntityTable<PushupSet, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
};

// Bump the version for every schema change. Never change a primary key.
db.version(1).stores({
  pushupSets: 'id, day, loggedAt',
  meta: 'key',
});

export const SCHEMA_VERSION = 1;
