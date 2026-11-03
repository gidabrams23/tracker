import { db } from './db';

export interface Settings {
  /** Daily goal per weekday, Sunday first. 0 = rest day. */
  goals: number[];
  /** The two big buttons: your most common set sizes. */
  heroSets: number[];
  /** Smaller secondary chips. */
  quickSets: number[];
  /** Albums per week (Monday–Sunday). */
  albumsPerWeek: number;
  floorTarget: number;
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  goals: [100, 100, 100, 100, 100, 100, 100],
  heroSets: [25, 30],
  quickSets: [10, 20],
  albumsPerWeek: 3,
  floorTarget: 25,
  sound: true,
  haptics: true,
};

export const settings: Settings = $state(structuredClone(DEFAULT_SETTINGS));

export async function loadSettings(): Promise<void> {
  const row = await db.meta.get('settings');
  if (row) {
    const saved = row.value as Partial<Settings>;
    Object.assign(settings, { ...DEFAULT_SETTINGS, ...saved });
    // Older saves had three quick sets including 25; the big buttons cover that now.
    if (!saved.heroSets) settings.quickSets = DEFAULT_SETTINGS.quickSets;
  }
}

export async function saveSettings(): Promise<void> {
  await db.meta.put({ key: 'settings', value: $state.snapshot(settings) });
}

export function goalFor(weekdayIndex: number): number {
  return settings.goals[weekdayIndex] ?? 100;
}
