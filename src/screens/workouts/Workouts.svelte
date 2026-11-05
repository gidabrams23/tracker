<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Session from './Session.svelte';
  import PlanEditor from './PlanEditor.svelte';
  import { exercise } from '../../lib/workouts/exercises';
  import { blockSteps, type Block } from '../../lib/workouts/plan';
  import {
    WORKOUT_DAYS,
    allWorkoutSets,
    discardSession,
    finishSession,
    resetTemplate,
    saveTemplateBlocks,
    sessions,
    startSession,
    templates,
    updateSessionBlocks,
  } from '../../lib/workouts/store';
  import { parseDay, shortDate, weekday, WEEKDAY_NAMES } from '../../lib/day';
  import { celebrate, goalSound, haptic } from '../../lib/feedback';
  import type { WorkoutSet, WorkoutTemplate } from '../../lib/db';
  import type { Go } from '../../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  // pick → day → session; plan and summary hang off those.
  type View = 'pick' | 'day' | 'session' | 'plan' | 'summary';
  let view: View = $state('pick');
  let selectedId: string | null = $state(null);
  let summaryId: string | null = $state(null);

  const allTemplates = $derived($templates ?? []);
  // Picker order follows WORKOUT_DAYS; any other saved day goes after.
  const days = $derived([
    ...WORKOUT_DAYS.map((d) => allTemplates.find((t) => t.id === d.id)).filter((t): t is WorkoutTemplate => !!t),
    ...allTemplates.filter((t) => !WORKOUT_DAYS.some((d) => d.id === t.id)),
  ]);
  const template = $derived(allTemplates.find((t) => t.id === selectedId));
  const active = $derived(($sessions ?? []).find((s) => !s.endedAt));
  const past = $derived(($sessions ?? []).filter((s) => s.endedAt));
  const sets = $derived($allWorkoutSets ?? []);

  // Jump straight back into a workout that's in progress.
  let resumed = false;
  $effect(() => {
    if (!resumed && $sessions) {
      resumed = true;
      if (active) {
        selectedId = active.templateId;
        view = 'session';
      }
    }
  });

  const KIND_LABEL = { superset: 'Superset', single: 'Straight sets', ladder: 'Ladder' } as const;
  const BADGE: Record<string, string> = { 'biceps-back': 'B+B', 'chest-tris': 'C+T', arms: 'ARM', shoulders: 'SH' };
  const TINT: Record<string, string> = { 'biceps-back': '#ff6a13', 'chest-tris': '#ffa53d', arms: '#ff7e5f', shoulders: '#ffc46b' };

  function stats(sessionId: string) {
    const s = sets.filter((x) => x.sessionId === sessionId);
    const volume = s.reduce((a, x) => a + x.weight * (exercise(x.exerciseId).unit === 'reps' ? x.reps : 0), 0);
    return { count: s.length, volume, list: s };
  }

  function bests(list: WorkoutSet[]) {
    // Heaviest set per exercise in this session.
    const by = new Map<string, WorkoutSet>();
    for (const s of list) {
      const cur = by.get(s.exerciseId);
      if (!cur || s.weight > cur.weight || (s.weight === cur.weight && s.reps > cur.reps)) by.set(s.exerciseId, s);
    }
    return [...by.values()];
  }

  const mins = (a: number, b: number) => Math.max(1, Math.round((b - a) / 60000));
  const plannedSets = (blocks: Block[]) => blocks.reduce((a, b) => a + blockSteps(b).length, 0);
  const lastDone = (id: string) => past.find((p) => p.templateId === id);
  const exerciseCount = (blocks: Block[]) => blocks.reduce((a, b) => a + b.exerciseIds.length, 0);

  function pick(id: string) {
    haptic();
    selectedId = id;
    view = 'day';
  }

  async function start() {
    if (!template || active) return;
    await startSession(template.id);
    haptic();
    view = 'session';
  }

  async function finish() {
    if (!active) return;
    const id = active.id;
    await finishSession(id);
    celebrate();
    goalSound();
    summaryId = id;
    view = 'summary';
  }

  async function discard() {
    if (active && confirm('Discard this workout and its sets?')) {
      await discardSession(active.id);
      view = 'pick';
    }
  }

  async function savePlan(blocks: Block[]) {
    if (active) await updateSessionBlocks(active, blocks);
    else if (template) await saveTemplateBlocks(template.id, blocks);
    view = active ? 'session' : 'day';
  }

  const summary = $derived(($sessions ?? []).find((s) => s.id === summaryId));
  const planSource = $derived(active ?? template);
</script>

{#if view === 'session' && active}
  <Session session={active} allSets={sets} onback={() => (view = 'pick')} onplan={() => (view = 'plan')} onfinish={finish} />
{:else if view === 'plan' && planSource}
  <PlanEditor
    title={planSource.name}
    blocks={planSource.blocks}
    locked={new Set(active ? sets.filter((s) => s.sessionId === active.id).map((s) => s.blockId) : [])}
    onsave={savePlan}
    onclose={() => (view = active ? 'session' : 'day')}
    onreset={active || !template
      ? undefined
      : async () => {
          await resetTemplate(template.id);
          view = 'day';
        }}
  />
{:else if view === 'summary' && summary}
  {@const st = stats(summary.id)}
  <main class="screen">
    <span class="label">{parseDay(summary.day).toLocaleDateString([], { weekday: 'long', month: 'short', day: 'numeric' })}</span>
    <h1 class="title">{summary.name}</h1>
    <div class="stat-row">
      <div class="card stat"><span class="big">{mins(summary.startedAt, summary.endedAt ?? Date.now())}</span><span class="muted">minutes</span></div>
      <div class="card stat"><span class="big">{st.count}</span><span class="muted">sets</span></div>
      <div class="card stat"><span class="big">{st.volume.toLocaleString()}</span><span class="muted">lb moved</span></div>
    </div>
    <section class="card">
      <h2>Top sets</h2>
      {#each bests(st.list) as s (s.id)}
        <div class="row"><span>{exercise(s.exerciseId).name}</span><span class="strong">{s.weight} × {s.reps}</span></div>
      {/each}
    </section>
    <button class="primary" onclick={() => (view = 'pick')}>Done</button>
  </main>
{:else if view === 'day' && template}
  {@const last = lastDone(template.id)}
  <main class="screen">
    <header class="top">
      <button class="icon-btn" onclick={() => (view = 'pick')} aria-label="Back to workout days">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="head-text">
        <span class="label">{last ? `Last done ${shortDate(last.day)}` : 'Not done yet'}</span>
        <h1 class="title">{template.name}</h1>
      </div>
    </header>

    <section class="card day">
      <div class="day-head">
        <span class="muted">{template.blocks.length} blocks · {plannedSets(template.blocks)} sets</span>
        <button class="chip edit" onclick={() => (view = 'plan')}>Edit order</button>
      </div>

      <ol class="blocks">
        {#each template.blocks as b (b.id)}
          <li>
            <span class="kind">{KIND_LABEL[b.kind]}{b.optional ? ' · optional' : ''}</span>
            <span>{b.exerciseIds.map((id) => exercise(id).name).join(' ⇄ ')}</span>
          </li>
        {/each}
      </ol>

      {#if active}
        <p class="muted">Finish your {active.name} workout before starting another.</p>
        <button class="press" onclick={() => (view = 'session')}>Resume {active.name}</button>
      {:else}
        <button class="press" onclick={start}>Start {template.name}</button>
      {/if}
    </section>
    <p class="muted center">Machine taken? Start anyway. You can swap any exercise mid-workout.</p>
  </main>
{:else}
  <main class="screen">
    <header class="top">
      <button class="icon-btn" onclick={() => go('home')} aria-label="Home">
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
      </button>
      <div class="head-text">
        <span class="label">{WEEKDAY_NAMES[weekday(today)]}</span>
        <h1 class="title">Workouts</h1>
      </div>
    </header>

    {#if active}
      <section class="card resume">
        <div>
          <span class="label">In progress</span>
          <h2>{active.name}</h2>
          <span class="muted">{stats(active.id).count} sets logged</span>
        </div>
        <button class="press" onclick={() => ((selectedId = active.templateId), (view = 'session'))}>Resume</button>
        <button class="link" onclick={discard}>Discard this workout</button>
      </section>
    {/if}

    <h2 class="ask">What are you training today?</h2>
    <div class="days">
      {#each days as t, i (t.id)}
        {@const last = lastDone(t.id)}
        <button
          class="day-tile"
          class:live={active?.templateId === t.id}
          style="--tint:{TINT[t.id] ?? '#ff6a13'}"
          onclick={() => pick(t.id)}
          in:fly={{ y: 24, duration: 400, delay: i * 50, easing: backOut }}
          aria-label="{t.name}: {exerciseCount(t.blocks)} exercises{last ? `, last done ${shortDate(last.day)}` : ''}"
        >
          <span class="badge">{BADGE[t.id] ?? t.name.slice(0, 2).toUpperCase()}</span>
          <span class="day-name">{t.name}</span>
          <span class="muted small">{exerciseCount(t.blocks)} exercises · {plannedSets(t.blocks)} sets</span>
          <span class="muted small">{last ? `Last ${shortDate(last.day)}` : 'Not done yet'}</span>
        </button>
      {/each}
    </div>

    <section class="card">
      <h2>History</h2>
      {#each past.slice(0, 12) as s (s.id)}
        {@const st = stats(s.id)}
        <button class="row hist" onclick={() => ((summaryId = s.id), (view = 'summary'))}>
          <span>{parseDay(s.day).toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })} · {s.name}</span>
          <span class="muted">{st.count} sets · {mins(s.startedAt, s.endedAt ?? s.startedAt)}m</span>
        </button>
      {:else}
        <p class="muted">Your finished workouts will show up here.</p>
      {/each}
    </section>
  </main>
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
  h2 {
    margin: 0 0 4px;
    font-family: var(--display);
    font-size: 22px;
    font-weight: 800;
  }
  .ask {
    margin: 4px 0 0;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
  }
  .small {
    font-size: 13px;
  }
  .center {
    text-align: center;
  }
  .days {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 12px;
  }
  .day-tile {
    min-height: 168px;
    padding: 16px;
    border-radius: 24px;
    border: 1px solid var(--line-soft);
    background: var(--card);
    box-shadow: 0 6px 0 #0d0a08;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  .day-tile:active {
    transform: translateY(5px);
    box-shadow: 0 1px 0 #0d0a08;
  }
  .day-tile.live {
    border-color: var(--accent);
  }
  .badge {
    width: 56px;
    height: 56px;
    border-radius: 18px;
    display: grid;
    place-items: center;
    margin-bottom: auto;
    background: var(--tint);
    color: var(--on-accent);
    box-shadow: 0 4px 0 #8a4a1f;
    font-family: var(--display);
    font-size: 16px;
    font-weight: 800;
    letter-spacing: 0.02em;
  }
  .day-name {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 800;
    line-height: 1.1;
  }
  .resume {
    display: flex;
    flex-direction: column;
    gap: 12px;
    border: 1px solid var(--accent);
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .edit {
    padding: 0 14px;
  }
  .blocks {
    margin: 0;
    padding-left: 22px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .blocks li {
    display: flex;
    flex-direction: column;
    gap: 2px;
    font-size: 15px;
    font-weight: 600;
  }
  .blocks li::marker {
    color: var(--accent);
    font-weight: 700;
  }
  .kind {
    font-size: 11px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--muted);
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
  .link {
    border: none;
    background: transparent;
    color: var(--muted);
    text-decoration: underline;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 0;
    border-top: 1px solid var(--line-soft);
    font-size: 15px;
  }
  .hist {
    width: 100%;
    border-left: none;
    border-right: none;
    border-bottom: none;
    background: transparent;
    text-align: left;
    flex-direction: column;
    gap: 2px;
  }
  .strong {
    font-weight: 700;
  }
  .stat-row {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .big {
    font-family: var(--display);
    font-size: 28px;
    font-weight: 800;
  }
</style>
