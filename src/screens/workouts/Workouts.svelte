<script lang="ts">
  import Session from './Session.svelte';
  import PlanEditor from './PlanEditor.svelte';
  import { exercise } from '../../lib/workouts/exercises';
  import { blockSteps, type Block } from '../../lib/workouts/plan';
  import {
    BICEPS_BACK,
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
  import { parseDay, weekday, WEEKDAY_NAMES } from '../../lib/day';
  import { celebrate, goalSound, haptic } from '../../lib/feedback';
  import type { WorkoutSet } from '../../lib/db';
  import type { Go } from '../../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  type View = 'overview' | 'session' | 'plan' | 'summary';
  let view: View = $state('overview');
  let summaryId: string | null = $state(null);

  const template = $derived(($templates ?? []).find((t) => t.id === BICEPS_BACK));
  const active = $derived(($sessions ?? []).find((s) => !s.endedAt));
  const past = $derived(($sessions ?? []).filter((s) => s.endedAt));
  const sets = $derived($allWorkoutSets ?? []);

  // Jump straight back into a workout that's in progress.
  let resumed = false;
  $effect(() => {
    if (!resumed && $sessions) {
      resumed = true;
      if (active) view = 'session';
    }
  });

  const KIND_LABEL = { superset: 'Superset', single: 'Straight sets', ladder: 'Ladder' } as const;

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

  async function start() {
    await startSession(BICEPS_BACK);
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
      view = 'overview';
    }
  }

  async function savePlan(blocks: Block[]) {
    if (active) await updateSessionBlocks(active, blocks);
    else if (template) await saveTemplateBlocks(template.id, blocks);
    view = active ? 'session' : 'overview';
  }

  const plannedSets = (blocks: Block[]) => blocks.reduce((a, b) => a + blockSteps(b).length, 0);
  const summary = $derived(($sessions ?? []).find((s) => s.id === summaryId));
</script>

{#if view === 'session' && active}
  <Session session={active} allSets={sets} onback={() => (view = 'overview')} onplan={() => (view = 'plan')} onfinish={finish} />
{:else if view === 'plan' && (active || template)}
  <PlanEditor
    title={(active ?? template)!.name}
    blocks={(active ?? template)!.blocks}
    locked={new Set(active ? sets.filter((s) => s.sessionId === active.id).map((s) => s.blockId) : [])}
    onsave={savePlan}
    onclose={() => (view = active ? 'session' : 'overview')}
    onreset={active ? undefined : async () => {
      await resetTemplate(BICEPS_BACK);
      view = 'overview';
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
    <button class="primary" onclick={() => (view = 'overview')}>Done</button>
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

    {#if template}
      <section class="card day">
        <div class="day-head">
          <div>
            <h2>{template.name}</h2>
            <span class="muted">
              {template.blocks.length} blocks · {plannedSets(template.blocks)} sets{past.find((p) => p.templateId === template.id)
                ? ` · last ${parseDay(past.find((p) => p.templateId === template.id)!.day).toLocaleDateString([], { month: 'short', day: 'numeric' })}`
                : ''}
            </span>
          </div>
          <button class="icon-btn" onclick={() => (view = 'plan')} aria-label="Edit order and exercises">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
          </button>
        </div>

        <ol class="blocks">
          {#each (active ?? template).blocks as b (b.id)}
            <li>
              <span class="kind">{KIND_LABEL[b.kind]}{b.optional ? ' · optional' : ''}</span>
              <span>{b.exerciseIds.map((id) => exercise(id).name).join(' ⇄ ')}</span>
            </li>
          {/each}
        </ol>

        {#if active}
          <button class="press" onclick={() => (view = 'session')}>Resume · {stats(active.id).count} sets in</button>
          <button class="link" onclick={discard}>Discard this workout</button>
        {:else}
          <button class="press" onclick={start}>Start workout</button>
        {/if}
      </section>
    {/if}

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
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
  }
  .day {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .day-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
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
