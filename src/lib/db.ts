import Dexie, { type EntityTable } from 'dexie';
import type { Block } from './workouts/plan';

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

export interface WorkoutTemplate {
  id: string;
  name: string;
  /** The last arrangement used, so swaps for machine availability carry to next time. */
  blocks: Block[];
  updatedAt: number;
}

export interface WorkoutSession {
  id: string;
  day: string;
  templateId: string;
  name: string;
  blocks: Block[];
  startedAt: number;
  endedAt?: number;
}

export interface WorkoutSet {
  id: string;
  sessionId: string;
  day: string;
  blockId: string;
  /** Position of the exercise within its block (0 or 1 for a superset). */
  slot: number;
  setIndex: number;
  exerciseId: string;
  /** Pounds. For bodyweight moves this is added weight. */
  weight: number;
  /** Reps, or seconds for timed exercises. */
  reps: number;
  loggedAt: number;
}

export interface AlbumEntry {
  id: string;
  /** Day it was listened to. */
  day: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkUrl?: string;
  itunesId?: number;
  /** 0–100 */
  score: number;
  notes: string;
  createdAt: number;
}

export type RunType = 'outdoor' | 'treadmill';
export type Effort = 'easy' | 'steady' | 'hard';

export interface Run {
  id: string;
  day: string;
  miles: number;
  /** Optional, so old runs can be backfilled with just distance and date. */
  seconds?: number;
  type: RunType;
  effort?: Effort;
  notes: string;
  createdAt: number;
}

export const db = new Dexie('tracker') as Dexie & {
  pushupSets: EntityTable<PushupSet, 'id'>;
  meta: EntityTable<MetaRow, 'key'>;
  workoutTemplates: EntityTable<WorkoutTemplate, 'id'>;
  workoutSessions: EntityTable<WorkoutSession, 'id'>;
  workoutSets: EntityTable<WorkoutSet, 'id'>;
  albums: EntityTable<AlbumEntry, 'id'>;
  runs: EntityTable<Run, 'id'>;
};

// Bump the version for every schema change. Never change a primary key.
db.version(1).stores({
  pushupSets: 'id, day, loggedAt',
  meta: 'key',
});
db.version(2).stores({
  workoutTemplates: 'id',
  workoutSessions: 'id, day, startedAt, endedAt',
  workoutSets: 'id, sessionId, exerciseId, loggedAt',
});
db.version(3).stores({
  albums: 'id, day, score, createdAt',
  runs: 'id, day',
});

export const SCHEMA_VERSION = 3;
