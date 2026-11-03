import { addDays, weekStart } from '../day';

export interface Tier {
  min: number;
  label: string;
}

// Highest first.
export const TIERS: Tier[] = [
  { min: 95, label: 'All-timer' },
  { min: 90, label: 'Classic' },
  { min: 80, label: 'Great' },
  { min: 70, label: 'Good' },
  { min: 60, label: 'Solid' },
  { min: 50, label: 'Mixed' },
  { min: 0, label: 'Miss' },
];

export function tier(score: number): Tier {
  return TIERS.find((t) => score >= t.min) ?? TIERS[TIERS.length - 1];
}

export interface Dated {
  day: string;
}

/** Albums logged in the Monday–Sunday week containing today. */
export function thisWeekCount(albums: Dated[], today: string): number {
  const start = weekStart(today);
  return albums.filter((a) => a.day >= start && a.day <= today).length;
}

/**
 * Consecutive weeks hitting the goal, counting back from last week.
 * The current week adds one once it's hit, but never breaks the streak while in progress.
 */
export function weekStreak(albums: Dated[], today: string, goal: number): number {
  const counts = new Map<string, number>();
  for (const a of albums) counts.set(weekStart(a.day), (counts.get(weekStart(a.day)) ?? 0) + 1);
  const current = weekStart(today);
  let streak = (counts.get(current) ?? 0) >= goal ? 1 : 0;
  for (let wk = addDays(current, -7); (counts.get(wk) ?? 0) >= goal; wk = addDays(wk, -7)) streak++;
  return streak;
}
