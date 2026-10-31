<script lang="ts">
  import Ring from '../components/Ring.svelte';
  import { allSets, totalsByDay } from '../lib/pushups';
  import { computeStreak } from '../lib/streak';
  import { goalFor } from '../lib/settings.svelte';
  import { parseDay, weekday, WEEKDAY_NAMES } from '../lib/day';
  import { sessions, allWorkoutSets } from '../lib/workouts/store';
  import type { Go } from '../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  const dayGoal = (d: string) => goalFor(weekday(d));
  const totals = $derived(totalsByDay($allSets ?? []));
  const pushups = $derived(totals.get(today) ?? 0);
  const goal = $derived(dayGoal(today));
  const streak = $derived(computeStreak(totals, dayGoal, today));

  const active = $derived(($sessions ?? []).find((s) => !s.endedAt));
  const lastDone = $derived(($sessions ?? []).find((s) => s.endedAt));
  const activeSets = $derived(active ? ($allWorkoutSets ?? []).filter((s) => s.sessionId === active.id).length : 0);

  const workoutStatus = $derived.by(() => {
    if (active) return `In progress · ${activeSets} sets`;
    if (!lastDone) return 'Not started yet';
    const days = Math.round((parseDay(today).getTime() - parseDay(lastDone.day).getTime()) / 86_400_000);
    return days === 0 ? `Done today · ${lastDone.name}` : `${lastDone.name} · ${days}d ago`;
  });

  const dateLabel = $derived(parseDay(today).toLocaleDateString([], { month: 'long', day: 'numeric' }));
</script>

<main class="screen">
  <header class="top">
    <div>
      <span class="label">{WEEKDAY_NAMES[weekday(today)]} · {dateLabel}</span>
      <h1 class="title">Tracker</h1>
    </div>
    <button class="icon-btn" onclick={() => go('settings')} aria-label="Settings">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
    </button>
  </header>

  <button class="tile wide" onclick={() => go('pushups')}>
    <Ring pct={goal > 0 ? pushups / goal : 1} size={92} stroke={9}>
      <span class="ring-num">{pushups}</span>
    </Ring>
    <div class="tile-text">
      <span class="tile-title">Push-ups</span>
      <span class="tile-sub">{goal > 0 ? (pushups >= goal ? 'Goal hit today' : `${goal - pushups} to go`) : 'Rest day'}</span>
      <span class="tile-sub">{streak.atRisk ? 'Streak at risk' : `${streak.current}-day streak`}</span>
    </div>
    <span class="chev" aria-hidden="true">›</span>
  </button>

  <div class="grid">
    <button class="tile" class:live={!!active} onclick={() => go('workouts')}>
      <span class="icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>
      </span>
      <span class="tile-title">Workouts</span>
      <span class="tile-sub">{workoutStatus}</span>
    </button>

    <div class="tile soon" aria-disabled="true">
      <span class="icon" aria-hidden="true">
        <svg width="30" height="30" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3" /><path d="M12 3a9 9 0 0 1 9 9" /></svg>
      </span>
      <span class="tile-title">Album a day</span>
      <span class="tile-sub">Coming in Phase 3</span>
    </div>
  </div>
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 4px;
  }
  .tile {
    border: 1px solid var(--line-soft);
    background: var(--card);
    border-radius: 22px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 6px;
    text-align: left;
    transition: transform 0.1s ease;
  }
  .tile:active {
    transform: scale(0.98);
  }
  .wide {
    flex-direction: row;
    align-items: center;
    gap: 16px;
  }
  .tile-text {
    display: flex;
    flex-direction: column;
    gap: 4px;
    flex: 1;
  }
  .tile-title {
    font-family: var(--display);
    font-size: 22px;
    font-weight: 800;
  }
  .tile-sub {
    font-size: 14px;
    color: var(--muted);
  }
  .ring-num {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 800;
  }
  .chev {
    font-size: 30px;
    color: var(--muted);
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .grid .tile {
    min-height: 168px;
    justify-content: flex-end;
  }
  .icon {
    width: 52px;
    height: 52px;
    border-radius: 16px;
    background: var(--accent);
    color: var(--on-accent);
    display: grid;
    place-items: center;
    margin-bottom: auto;
    box-shadow: 0 4px 0 var(--accent-deep);
  }
  .live {
    border-color: var(--accent);
  }
  .soon {
    opacity: 0.55;
  }
  .soon .icon {
    background: var(--line);
    color: var(--muted);
    box-shadow: none;
  }
</style>
