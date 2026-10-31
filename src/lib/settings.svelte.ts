import { db } from './db';

export interface Settings {
  /** Daily goal per weekday, Sunday first. 0 = rest day. */
  goals: number[];
  quickSets: number[];
  floorTarget: number;
  sound: boolean;
  haptics: boolean;
}

export const DEFAULT_SETTINGS: Settings = {
  goals: [100, 100, 100, 100, 100, 100, 100],
  quickSets: [10, 20, 25],
  floorTarget: 25,
  sound: true,
  haptics: true,
};

export const settings: Settings = $state(structuredClone(DEFAULT_SETTINGS));

export async function loadSettings(): Promise<void> {
  const row = await db.meta.get('settings');
  if (row) Object.assign(settings, { ...DEFAULT_SETTINGS, ...(row.value as Partial<Settings>) });
}

export async function saveSettings(): Promise<void> {
  await db.meta.put({ key: 'settings', value: $state.snapshot(settings) });
}

export function goalFor(weekdayIndex: number): number {
  return settings.goals[weekdayIndex] ?? 100;
}
