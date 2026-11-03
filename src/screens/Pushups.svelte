<script lang="ts">
  import { onMount } from 'svelte';
  import { slide } from 'svelte/transition';
  import FlipDigits from '../components/FlipDigits.svelte';
  import Ring from '../components/Ring.svelte';
  import WeekBars from '../components/WeekBars.svelte';
  import Heatmap from '../components/Heatmap.svelte';
  import DaySheet from '../components/DaySheet.svelte';
  import SetJar from '../components/SetJar.svelte';
  import { allSets, logSet, deleteSet, undoLastToday, totalsByDay } from '../lib/pushups';
  import { computeStreak } from '../lib/streak';
  import { settings, goalFor } from '../lib/settings.svelte';
  import { lastNDays, parseDay, timeLabel, weekday, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../lib/day';
  import { haptic, clickSound, setChime, goalSound, celebrate } from '../lib/feedback';
  import type { PushupSource } from '../lib/db';
  import type { Go } from '../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  // Reps tapped in the rep counter but not yet saved. Kept in localStorage so a closed app doesn't lose them.
  const PENDING_KEY = 'tracker.pendingSet';
  let pending = $state(0);
  let counterOpen = $state(false);
  let editDay: string | null = $state(null);
  let pressed: number | null = $state(null);

  function persistPending() {
    try {
      localStorage.setItem(PENDING_KEY, JSON.stringify({ day: today, reps: pending }));
    } catch {}
  }

  onMount(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(PENDING_KEY) ?? 'null') as { day: string; reps: number } | null;
      if (saved?.reps) {
        if (saved.day === today) {
          pending = saved.reps;
          counterOpen = true;
        } else {
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
  const todayChrono = $derived(sets.filter((s) => s.day === today));
  const todaySets = $derived([...todayChrono].reverse());
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
  const primary = $derived(settings.heroSets[0] ?? 25);

  const caption = $derived.by(() => {
    if (goal <= 0) return 'Rest day. Any set today is a bonus.';
    const left = goal - logged;
    if (left <= 0) return `Goal hit in ${todayChrono.length} ${todayChrono.length === 1 ? 'set' : 'sets'}. Everything now is bonus.`;
    const n = Math.ceil(left / primary);
    if (todayChrono.length === 0) return `${n} sets of ${primary} gets you there.`;
    return n === 1 ? `One more set of ${primary} and you're done.` : `${left} to go · about ${n} sets of ${primary}.`;
  });

  async function commit(reps: number, source: PushupSource) {
    const before = logged;
    const setNumber = todayChrono.length + 1;
    await logSet(reps, source);
    haptic();
    if (goal > 0 && before < goal && before + reps >= goal) {
      celebrate();
      goalSound();
    } else {
      setChime(setNumber);
    }
  }

  async function hero(n: number) {
    pressed = n;
    setTimeout(() => (pressed = null), 380);
    await commit(n, 'quick');
  }

  function tap() {
    pending++;
    persistPending();
    haptic();
    clickSound();
  }

  async function saveCounter() {
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
    <div class="count-row">
      <Ring {pct} size={84} stroke={9}>
        <span class="pct">{Math.min(100, Math.round(pct * 100))}%</span>
      </Ring>
      <div class="count">
        <FlipDigits value={count} />
        <span class="muted">{goal > 0 ? `of ${goal} today` : 'rest day'} · best {bestDay}</span>
      </div>
    </div>

    <SetJar sets={todayChrono} {goal} unit={primary} />
    <p class="caption">{caption}</p>

    <div class="heroes">
      {#each settings.heroSets as n, i (i)}
        <button class="big" class:pop={pressed === n} onclick={() => hero(n)} aria-label="Log a set of {n}">
          <span class="plus">+{n}</span>
          <span class="sub">log a set</span>
        </button>
      {/each}
    </div>
  </section>

  <div class="secondary">
    {#each settings.quickSets as n, i (i)}
      <button class="chip" onclick={() => commit(n, 'quick')}>+{n}</button>
    {/each}
    <button class="chip" onclick={() => (editDay = today)}>Other</button>
    <button class="chip" class:on={counterOpen} onclick={() => (counterOpen = !counterOpen)} aria-expanded={counterOpen}>Count</button>
    <button class="icon-btn" onclick={undo} aria-label="Undo last entry">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 14 4 9l5-5" /><path d="M4 9h11a5 5 0 0 1 0 10h-3" /></svg>
    </button>
  </div>

  {#if counterOpen}
    <section class="card counter" transition:slide={{ duration: 200 }}>
      <button class="press" onclick={tap} aria-label="Add one rep">+1</button>
      <div class="counter-text">
        <span class="pending-num">{pending}</span>
        <span class="muted">{pending === 1 ? 'rep' : 'reps'} counted</span>
      </div>
      <button class="primary save" disabled={!pending} onclick={saveCounter}>Save</button>
    </section>
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
    flex-direction: column;
    gap: 14px;
  }
  .count-row {
    display: flex;
    align-items: center;
    gap: 16px;
  }
  .count {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .pct {
    font-size: 15px;
    font-weight: 700;
  }
  .caption {
    margin: -4px 0 0;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-soft);
  }
  .heroes {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .big {
    height: 120px;
    border-radius: 24px;
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 8px 0 var(--accent-deep);
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
  .big:active {
    transform: translateY(7px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .big.pop .plus {
    animation: pop 0.38s ease-out;
  }
  @keyframes pop {
    0% {
      transform: scale(1);
    }
    40% {
      transform: scale(1.25);
    }
    100% {
      transform: scale(1);
    }
  }
  .plus {
    font-size: 54px;
    font-weight: 800;
    line-height: 1;
  }
  .sub {
    font-size: 13px;
    font-weight: 600;
    opacity: 0.8;
  }
  .secondary {
    display: flex;
    gap: 8px;
  }
  .secondary .chip {
    flex: 1;
    min-width: 0;
    padding: 0 6px;
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .counter {
    display: flex;
    align-items: center;
    gap: 14px;
  }
  .press {
    width: 88px;
    height: 88px;
    flex-shrink: 0;
    border-radius: 50%;
    border: none;
    background: var(--raised);
    color: var(--accent);
    border: 2px solid var(--accent);
    box-shadow: 0 5px 0 var(--accent-deep);
    font-family: var(--display);
    font-size: 30px;
    font-weight: 800;
  }
  .press:active {
    transform: translateY(4px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .counter-text {
    flex: 1;
    display: flex;
    flex-direction: column;
  }
  .pending-num {
    font-family: var(--display);
    font-size: 36px;
    font-weight: 800;
    line-height: 1;
  }
  .save {
    height: 44px;
    padding: 0 18px;
    font-size: 15px;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
  }
  .small {
    font-size: 13px;
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
