import { addDays } from './day';

export interface StreakResult {
  /** Days the goal was met in the current run (frozen and grace days don't add to it). */
  current: number;
  best: number;
  /** Freezes banked: one earned per 7 met days, max 2. A missed day spends one automatically. */
  freezes: number;
  /** Yesterday was missed with no freeze left: missing today too ends the streak. */
  atRisk: boolean;
}

export const MAX_FREEZES = 2;
export const DAYS_PER_FREEZE = 7;

/**
 * Streak rules (PRD section 6, "Streaks without guilt"):
 * - A day with goal <= 0 is a rest day: it neither counts nor breaks anything.
 * - A missed day spends a banked freeze if there is one.
 * - With no freeze, the first missed day is a grace day ("never miss twice").
 *   A second consecutive uncovered miss resets the streak.
 * - Today only counts once the goal is met; it can't break the streak until it's over.
 */
export function computeStreak(
  totals: Map<string, number>,
  goalFor: (day: string) => number,
  today: string,
): StreakResult {
  const days = [...totals.keys()].filter((d) => d <= today).sort();
  if (days.length === 0) return { current: 0, best: 0, freezes: 0, atRisk: false };

  let current = 0;
  let best = 0;
  let freezes = 0;
  let metSinceFreeze = 0;
  let graceUsed = false;

  const meet = () => {
    current++;
    best = Math.max(best, current);
    metSinceFreeze++;
    if (metSinceFreeze === DAYS_PER_FREEZE) {
      freezes = Math.min(MAX_FREEZES, freezes + 1);
      metSinceFreeze = 0;
    }
    graceUsed = false;
  };

  for (let day = days[0]; day < today; day = addDays(day, 1)) {
    const goal = goalFor(day);
    if (goal <= 0) continue;
    if ((totals.get(day) ?? 0) >= goal) {
      meet();
      continue;
    }
    metSinceFreeze = 0;
    if (freezes > 0) {
      freezes--;
    } else if (!graceUsed) {
      graceUsed = true;
    } else {
      current = 0;
    }
  }

  const todayGoal = goalFor(today);
  const todayMet = todayGoal > 0 && (totals.get(today) ?? 0) >= todayGoal;
  if (todayMet) meet();

  return { current, best, freezes, atRisk: graceUsed && !todayMet && current > 0 };
}
