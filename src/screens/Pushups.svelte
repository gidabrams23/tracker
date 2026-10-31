<script lang="ts">
  import { onMount } from 'svelte';
  import FlipDigits from '../components/FlipDigits.svelte';
  import Ring from '../components/Ring.svelte';
  import WeekBars from '../components/WeekBars.svelte';
  import Heatmap from '../components/Heatmap.svelte';
  import DaySheet from '../components/DaySheet.svelte';
  import { allSets, logSet, deleteSet, undoLastToday, totalsByDay } from '../lib/pushups';
  import { computeStreak } from '../lib/streak';
  import { settings, goalFor } from '../lib/settings.svelte';
  import { lastNDays, parseDay, timeLabel, weekday, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../lib/day';
  import { haptic, clickSound, saveSound, goalSound, celebrate } from '../lib/feedback';
  import type { PushupSource } from '../lib/db';
  import type { Go } from '../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  // Reps tapped but not yet saved as a set. Kept in localStorage so a closed app doesn't lose them.
  const PENDING_KEY = 'tracker.pendingSet';
  let pending = $state(0);
  let editDay: string | null = $state(null);

  function persistPending() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ day: today, reps: pending }));
    } catch {}
  }

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { day: string; reps: number } | null;
      if (saved?.reps) {
        if (saved.day === today) pending = saved.reps;
        else {
          // Left over from an earlier day: save it to that day rather than lose it.
          const end = parseDay(saved.day);
          end.setHours(23, 59);
          void logSet(saved.reps, 'tap', end);
          localStorage.removeItem(PENDING_KEY);
        }
      }
    } catch {}
  });

  const dayGoal = (d: string) => goalFor(weekday(d));

  const sets = $derived($allSets ?? []);
  const totals = $derived(totalsByDay(sets));
  const goal = $derived(dayGoal(today));
  const logged = $derived(totals.get(today) ?? 0);
  const count = $derived(logged + pending);
  const pct = $derived(goal > 0 ? count / goal : 1);
  const todaySets = $derived(sets.filter((s) => s.day === today).reverse());
  const streak = $derived(computeStreak(totals, dayGoal, today));
  const bars = $derived(
    lastNDays(7, today).map((d) => ({
      day: d,
      label: WEEKDAY_SHORT[weekday(d)],
      total: d === today ? count : (totals.get(d) ?? 0),
      goal: dayGoal(d),
      isToday: d === today,
    })),
  );
  const weekTotal = $derived(bars.reduce((a, b) => a + b.total, 0));
  const bestDay = $derived(Math.max(count, ...totals.values()));
  const avg7 = $derived(Math.round(weekTotal / 7));

  const status = $derived.by(() => {
    if (goal <= 0) return 'rest day';
    if (count >= goal) return count > goal ? `goal + ${count - goal}` : 'goal hit';
    return `${goal - count} to go`;
  });

  function tap() {
    pending++;
    persistPending();
    haptic();
    clickSound();
  }

  async function commit(reps: number, source: PushupSource) {
    const before = logged;
    await logSet(reps, source);
    haptic();
    if (goal > 0 && before < goal && before + reps >= goal) {
      celebrate();
      goalSound();
    } else {
      saveSound();
    }
  }

  async function saveSet() {
    if (!pending) return;
    const reps = pending;
    pending = 0;
    persistPending();
    await commit(reps, 'tap');
  }

  async function undo() {
    haptic();
    if (pending) {
      pending = 0;
      persistPending();
    } else {
      await undoLastToday(today);
    }
  }
</script>

<main class="screen">
  <header class="top">
    <div class="back">
      <button class="icon-btn" onclick={() => go('home')} aria-label="Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <span class="label">{WEEKDAY_NAMES[weekday(today)]}</span>
    </div>
    <div class="actions">
      <button class="icon-btn" onclick={() => go('floor')} aria-label="Floor mode">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="5" y="2" width="14" height="20" rx="3" /><path d="M9 18h6" /></svg>
      </button>
      <button class="icon-btn" onclick={() => go('settings')} aria-label="Settings">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12M20 18h0" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
      </button>
    </div>
  </header>

  <div class="title-row">
    <h1 class="title">Push-ups</h1>
    <div class="streak" class:risk={streak.atRisk}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2c1 4 5 6 5 11a5 5 0 0 1-10 0c0-3 2-4 2-7 2 1 3 3 3 5" /></svg>
      {#if streak.atRisk}
        <span>Streak at risk today</span>
      {:else}
        <span>{streak.current} {streak.current === 1 ? 'day' : 'days'}{streak.freezes ? ` · ${streak.freezes} ${streak.freezes === 1 ? 'freeze' : 'freezes'}` : ''}</span>
      {/if}
    </div>
  </div>

  <section class="card hero">
    <Ring {pct} size={172}>
      <button class="press" onclick={tap} aria-label="Add one rep to the current set">
        <span class="plus">+1</span>
        <span class="hint">tap per rep</span>
      </button>
    </Ring>
    <div class="stats">
      <FlipDigits value={count} />
      <span class="muted">{goal > 0 ? `of ${goal} · ${status}` : status}</span>
      <span class="muted small">Best day {bestDay} · Avg {avg7}</span>
    </div>
  </section>

  <div class="pending" class:active={pending > 0}>
    <span>{pending > 0 ? `Current set: ${pending} ${pending === 1 ? 'rep' : 'reps'}` : 'Tap +1 for each rep, then save'}</span>
    <button class="primary save" disabled={!pending} onclick={saveSet}>Save set</button>
  </div>

  <div class="quick">
    <span class="muted small">Quick set</span>
    {#each settings.quickSets as n, i (i)}
      <button class="chip" onclick={() => commit(n, 'quick')}>{n}</button>
    {/each}
    <button class="icon-btn" onclick={undo} aria-label="Undo last entry">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
    </button>
  </div>

  {#if goal > 0 && count >= goal}
    <div class="banner">Goal hit. Reps from here count as bonus.</div>
  {/if}

  <section class="card">
    <div class="card-head">
      <h2>This week</h2>
      <span class="muted small">{weekTotal} total · tap a day to edit</span>
    </div>
    <WeekBars {bars} onselect={(d) => (editDay = d)} />
  </section>

  <section class="card list">
    <div class="card-head">
      <h2>Today's sets</h2>
      <span class="muted small">{todaySets.length} {todaySets.length === 1 ? 'set' : 'sets'}</span>
    </div>
    {#each todaySets as s (s.id)}
      <div class="row">
        <span class="muted">{timeLabel(s.loggedAt)}{s.source === 'floor' ? ' · floor' : ''}</span>
        <span class="reps">{s.reps}</span>
        <button class="del" onclick={() => deleteSet(s.id)} aria-label="Delete set of {s.reps}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    {:else}
      <p class="muted empty">Nothing logged yet today.</p>
    {/each}
  </section>

  <section class="card">
    <div class="card-head">
      <h2>Last 12 weeks</h2>
      <span class="muted small">Best streak {streak.best}</span>
    </div>
    <Heatmap {totals} {today} goalFor={dayGoal} />
  </section>
</main>

{#if editDay}
  <DaySheet day={editDay} {today} sets={sets.filter((s) => s.day === editDay)} onclose={() => (editDay = null)} />
{/if}

<style>
  .top,
  .title-row,
  .card-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
  }
  .actions,
  .back {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .streak {
    display: flex;
    align-items: center;
    gap: 6px;
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--line);
    font-size: 13px;
    font-weight: 600;
    white-space: nowrap;
  }
  .streak.risk {
    border-color: var(--accent);
    color: var(--accent-soft);
  }
  .hero {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .press {
    width: 138px;
    height: 138px;
    margin-top: -6px;
    border-radius: 50%;
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 7px 0 var(--accent-deep);
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 2px;
    font-family: var(--display);
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease;
  }
  .press:active {
    transform: translateY(6px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .plus {
    font-size: 48px;
    font-weight: 800;
    line-height: 1;
  }
  .hint {
    font-size: 13px;
    font-weight: 600;
  }
  .stats {
    display: flex;
    flex-direction: column;
    gap: 8px;
    min-width: 0;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
  }
  .small {
    font-size: 13px;
  }
  .pending {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    padding: 10px 10px 10px 16px;
    border-radius: 16px;
    background: var(--raised);
    border: 1px solid var(--line);
    font-size: 15px;
    font-weight: 500;
  }
  .pending.active {
    border-color: var(--accent);
  }
  .save {
    flex-shrink: 0;
    white-space: nowrap;
    height: 44px;
    padding: 0 18px;
    font-size: 15px;
  }
  .quick {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .quick .chip {
    flex: 1;
  }
  .banner {
    padding: 10px 14px;
    border-radius: 12px;
    background: #2b1a0d;
    border: 1px solid var(--accent);
    color: var(--accent-soft);
    font-size: 14px;
    font-weight: 600;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .card-head {
    margin-bottom: 12px;
  }
  .list {
    padding-bottom: 6px;
  }
  .list .card-head {
    margin-bottom: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--line-soft);
  }
  .row .muted {
    flex: 1;
    font-size: 15px;
  }
  .reps {
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .del {
    width: 36px;
    height: 36px;
    border: none;
    background: transparent;
    color: var(--muted);
    display: grid;
    place-items: center;
  }
  .empty {
    margin: 8px 0 10px;
  }
</style>
