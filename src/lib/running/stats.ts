import { addDays, monthKey, weekStart } from '../day';

export interface RunLike {
  id: string;
  day: string;
  miles: number;
  seconds?: number;
}

const round2 = (n: number) => Math.round(n * 100) / 100;
const sum = (runs: RunLike[]) => round2(runs.reduce((a, r) => a + r.miles, 0));

/** Seconds per mile, or null when there's no time. */
export function pace(r: RunLike): number | null {
  return r.seconds && r.miles > 0 ? r.seconds / r.miles : null;
}

/** "8:05" */
export function formatPace(secPerMile: number | null): string {
  if (secPerMile === null || !Number.isFinite(secPerMile)) return '—';
  const s = Math.round(secPerMile);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** "42:10" or "1:02:10" */
export function formatDuration(seconds?: number): string {
  if (!seconds) return '—';
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = String(Math.round(seconds % 60)).padStart(2, '0');
  return h ? `${h}:${String(m).padStart(2, '0')}:${s}` : `${m}:${s}`;
}

export function formatMiles(miles: number): string {
  return miles % 1 === 0 ? String(miles) : miles.toFixed(miles * 10 === Math.round(miles * 10) ? 1 : 2);
}

export interface Totals {
  week: number;
  month: number;
  year: number;
  all: number;
  weekRuns: number;
}

/** Weeks run Monday–Sunday. */
export function totals(runs: RunLike[], today: string): Totals {
  const wk = weekStart(today);
  const mo = monthKey(today);
  const yr = today.slice(0, 4);
  const thisWeek = runs.filter((r) => r.day >= wk && r.day <= today);
  return {
    week: sum(thisWeek),
    month: sum(runs.filter((r) => monthKey(r.day) === mo)),
    year: sum(runs.filter((r) => r.day.startsWith(yr))),
    all: sum(runs),
    weekRuns: thisWeek.length,
  };
}

/** Miles per week for the last n weeks, oldest first. */
export function weeklySeries(runs: RunLike[], today: string, n = 12): { start: string; miles: number }[] {
  const current = weekStart(today);
  return Array.from({ length: n }, (_, i) => {
    const start = addDays(current, -7 * (n - 1 - i));
    const end = addDays(start, 6);
    return { start, miles: sum(runs.filter((r) => r.day >= start && r.day <= end)) };
  });
}

/** Miles per month for the last n months, oldest first. */
export function monthlySeries(runs: RunLike[], today: string, n = 6): { month: string; miles: number }[] {
  const [y, m] = today.split('-').map(Number);
  return Array.from({ length: n }, (_, i) => {
    const d = new Date(y, m - 1 - (n - 1 - i), 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    return { month: key, miles: sum(runs.filter((r) => monthKey(r.day) === key)) };
  });
}

export function bests<R extends RunLike>(runs: R[]): { longest: R | null; fastest: R | null } {
  let longest: R | null = null;
  let fastest: R | null = null;
  for (const r of runs) {
    if (!longest || r.miles > longest.miles) longest = r;
    const p = pace(r);
    // Only runs of a mile or more count for pace, so a sprint doesn't dominate.
    if (p !== null && r.miles >= 1 && (!fastest || p < pace(fastest)!)) fastest = r;
  }
  return { longest, fastest };
}

/** The first date each whole-mile distance was reached, like "5 miles: 8/11". */
export function milestones(runs: RunLike[]): { miles: number; day: string }[] {
  const out: { miles: number; day: string }[] = [];
  let reached = 0;
  for (const r of [...runs].sort((a, b) => a.day.localeCompare(b.day))) {
    while (Math.floor(r.miles) > reached) {
      reached++;
      out.push({ miles: reached, day: r.day });
    }
  }
  return out;
}
