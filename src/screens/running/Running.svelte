<script lang="ts">
  import { fly } from 'svelte/transition';
  import Bars from '../../components/Bars.svelte';
  import RunEditor from './RunEditor.svelte';
  import { runs } from '../../lib/running/store';
  import {
    bests,
    formatDuration,
    formatMiles,
    formatPace,
    milestones,
    monthlySeries,
    pace,
    totals,
    weeklySeries,
  } from '../../lib/running/stats';
  import { addDays, parseDay, shortDate, weekday, weekStart, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../../lib/day';
  import { celebrate, goalSound, setChime } from '../../lib/feedback';
  import type { Run } from '../../lib/db';
  import type { Go } from '../../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  let editing: Run | 'new' | null = $state(null);
  let toast: string | null = $state(null);

  const all = $derived($runs ?? []);
  const t = $derived(totals(all, today));
  const best = $derived(bests(all));
  const marks = $derived(milestones(all).reverse());
  const recent = $derived([...all].reverse().slice(0, 20));
  const lastType = $derived(all.length ? all[all.length - 1].type : 'outdoor');

  // Mon–Sun of this week.
  const thisWeek = $derived(
    Array.from({ length: 7 }, (_, i) => {
      const d = addDays(weekStart(today), i);
      return {
        label: WEEKDAY_SHORT[weekday(d)],
        value: d > today ? 0 : Math.round(all.filter((r) => r.day === d).reduce((a, r) => a + r.miles, 0) * 100) / 100,
        highlight: d === today,
      };
    }),
  );
  const weeks = $derived(
    weeklySeries(all, today, 12).map((w, i, arr) => ({
      label: i === arr.length - 1 ? 'now' : shortDate(w.start).replace(/^\w+ /, ''),
      value: w.miles,
      highlight: i === arr.length - 1,
    })),
  );
  const months = $derived(
    monthlySeries(all, today, 6).map((m, i, arr) => ({
      label: parseDay(`${m.month}-01`).toLocaleDateString([], { month: 'short' }),
      value: m.miles,
      highlight: i === arr.length - 1,
    })),
  );

  function saved(miles: number) {
    const before = best.longest?.miles ?? 0;
    const wasNew = editing === 'new';
    editing = null;
    if (!wasNew) return;
    const weekNow = Math.round((t.week + miles) * 100) / 100;
    if (all.length > 0 && miles > before) {
      celebrate();
      goalSound();
      toast = `New longest run · ${formatMiles(miles)} mi`;
    } else {
      setChime(t.weekRuns + 1);
      toast = `+${formatMiles(miles)} mi · ${formatMiles(weekNow)} this week`;
    }
    setTimeout(() => (toast = null), 2600);
  }
</script>

<main class="screen">
  <header class="top">
    <button class="icon-btn" onclick={() => go('home')} aria-label="Home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <div class="head-text">
      <span class="label">{WEEKDAY_NAMES[weekday(today)]}</span>
      <h1 class="title">Running</h1>
    </div>
  </header>

  <section class="card hero">
    <div class="hero-top">
      <div>
        <span class="label">This week</span>
        <div class="big"><span class="num">{formatMiles(t.week)}</span><span class="unit">mi</span></div>
        <span class="muted">{t.weekRuns} {t.weekRuns === 1 ? 'run' : 'runs'} since Monday</span>
      </div>
    </div>
    <Bars bars={thisWeek} height={64} format={formatMiles} />
    <button class="press" onclick={() => (editing = 'new')}>Log a run</button>
  </section>

  <div class="totals">
    <div class="card stat"><span class="stat-num">{formatMiles(t.month)}</span><span class="muted">mi this month</span></div>
    <div class="card stat"><span class="stat-num">{formatMiles(t.year)}</span><span class="muted">mi this year</span></div>
    <div class="card stat"><span class="stat-num">{formatMiles(t.all)}</span><span class="muted">mi all time</span></div>
  </div>

  <section class="card">
    <h2>Last 12 weeks</h2>
    <Bars bars={weeks} height={80} format={(v) => String(Math.round(v))} />
  </section>

  <section class="card">
    <h2>By month</h2>
    <Bars bars={months} height={80} format={(v) => String(Math.round(v))} />
  </section>

  {#if best.longest}
    <div class="totals two">
      <div class="card stat">
        <span class="stat-num">{formatMiles(best.longest.miles)}<small> mi</small></span>
        <span class="muted">longest · {shortDate(best.longest.day)}</span>
      </div>
      <div class="card stat">
        <span class="stat-num">{best.fastest ? formatPace(pace(best.fastest)) : '—'}<small> /mi</small></span>
        <span class="muted">{best.fastest ? `fastest · ${shortDate(best.fastest.day)}` : 'fastest pace (add times)'}</span>
      </div>
    </div>
  {/if}

  {#if marks.length}
    <section class="card">
      <h2>Milestones</h2>
      <div class="marks">
        {#each marks as mk (mk.miles)}
          <div class="mark"><span class="mark-mi">{mk.miles} mi</span><span class="muted">{shortDate(mk.day)}</span></div>
        {/each}
      </div>
    </section>
  {/if}

  <section class="card">
    <h2>Runs</h2>
    {#each recent as r (r.id)}
      <button class="run" onclick={() => (editing = r)}>
        <span class="run-mi">{formatMiles(r.miles)}<small> mi</small></span>
        <span class="run-meta">
          <span>{parseDay(r.day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
          <span class="muted">
            {r.type === 'treadmill' ? 'Treadmill' : 'Outdoor'}{r.seconds ? ` · ${formatDuration(r.seconds)} · ${formatPace(pace(r))}/mi` : ''}{r.effort ? ` · ${r.effort}` : ''}
          </span>
          {#if r.notes}<span class="muted note">{r.notes}</span>{/if}
        </span>
      </button>
    {:else}
      <p class="muted">No runs yet. Old runs can be added with just distance and date.</p>
    {/each}
  </section>
</main>

{#if editing}
  <RunEditor run={editing === 'new' ? undefined : editing} {today} {lastType} onsaved={saved} onclose={() => (editing = null)} />
{/if}

{#if toast}
  <div class="toast" role="status" transition:fly={{ y: -30, duration: 200 }}>{toast}</div>
{/if}

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head-text {
    display: flex;
    flex-direction: column;
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .big {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .num {
    font-family: var(--display);
    font-size: 64px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    font-size: 20px;
    font-weight: 700;
    color: var(--muted);
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
  .press {
    height: 64px;
    border-radius: 18px;
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 0 var(--accent-deep);
    font-family: var(--display);
    font-size: 22px;
    font-weight: 800;
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease;
  }
  .press:active {
    transform: translateY(5px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .totals {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .totals.two {
    grid-template-columns: repeat(2, minmax(0, 1fr));
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
  }
  .stat-num {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 800;
  }
  .stat-num small {
    font-size: 14px;
    color: var(--muted);
  }
  h2 {
    margin: 0 0 12px;
    font-size: 15px;
    font-weight: 600;
  }
  .marks {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }
  .mark {
    display: flex;
    flex-direction: column;
    padding: 8px 12px;
    border-radius: 12px;
    background: #2b1a0d;
    border: 1px solid var(--accent-past);
  }
  .mark-mi {
    font-weight: 800;
    color: var(--accent-soft);
  }
  .run {
    width: 100%;
    display: flex;
    gap: 14px;
    align-items: flex-start;
    padding: 12px 0;
    border: none;
    border-top: 1px solid var(--line-soft);
    background: transparent;
    text-align: left;
  }
  .run-mi {
    min-width: 72px;
    font-family: var(--display);
    font-size: 24px;
    font-weight: 800;
  }
  .run-mi small {
    font-size: 13px;
    color: var(--muted);
  }
  .run-meta {
    display: flex;
    flex-direction: column;
    gap: 2px;
    min-width: 0;
  }
  .note {
    font-style: italic;
  }
  .toast {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 12px);
    left: 16px;
    right: 16px;
    max-width: 448px;
    margin: 0 auto;
    z-index: 60;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--display);
    font-size: 18px;
    font-weight: 800;
    text-align: center;
  }
</style>
