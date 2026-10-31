<script lang="ts">
  import { onMount } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import Stepper from '../../components/Stepper.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import { exercise, setLabel, weightLabel } from '../../lib/workouts/exercises';
  import { blockComplete, blockSteps, isLogged, nextStep, prefillFor, type Block } from '../../lib/workouts/plan';
  import {
    deleteWorkoutSet,
    lastTimeSets,
    logWorkoutSet,
    updateSessionBlocks,
    updateWorkoutSet,
  } from '../../lib/workouts/store';
  import { haptic, saveSound, goalSound, celebrate } from '../../lib/feedback';
  import { keepAwake } from '../../lib/wakelock';
  import type { WorkoutSession, WorkoutSet } from '../../lib/db';

  let {
    session,
    allSets,
    onback,
    onplan,
    onfinish,
  }: {
    session: WorkoutSession;
    allSets: WorkoutSet[];
    onback: () => void;
    onplan: () => void;
    onfinish: () => void;
  } = $props();

  const KIND_LABEL = { superset: 'Superset', single: 'Straight sets', ladder: 'Ladder' } as const;

  const mine = $derived(allSets.filter((s) => s.sessionId === session.id));
  const step = $derived(nextStep(session.blocks, mine));
  const blockIndex = $derived(step ? session.blocks.findIndex((b) => b.id === step.blockId) : -1);
  const block: Block | undefined = $derived(step ? session.blocks[blockIndex] : undefined);
  const ex = $derived(step ? exercise(step.exerciseId) : undefined);
  const lastTime = $derived(step ? lastTimeSets(allSets, step.exerciseId, session.id) : []);
  const upNext = $derived(session.blocks.slice(blockIndex + 1).find((b) => !blockComplete(b, mine)));
  const allDone = $derived(step === null);

  let weight = $state(0);
  let reps = $state(0);
  let toast: { text: string; big: boolean } | null = $state(null);
  let editing: WorkoutSet | null = $state(null);
  let editWeight = $state(0);
  let editReps = $state(0);
  let busy = false;

  // Pre-fill whenever the current step changes: same as the previous set, else last session, else defaults.
  let prefilledFor = '';
  $effect(() => {
    if (!step || !ex) return;
    const k = `${step.blockId}:${step.slot}:${step.setIndex}`;
    if (k === prefilledFor) return;
    prefilledFor = k;
    const pf = prefillFor(step, mine, lastTime, { weight: ex.defaultWeight, reps: ex.defaultReps }, block);
    weight = pf.weight;
    reps = pf.reps;
  });

  // Clock for elapsed time and "since last set".
  let now = $state(Date.now());
  onMount(() => {
    const t = setInterval(() => (now = Date.now()), 1000);
    const release = keepAwake();
    return () => {
      clearInterval(t);
      release();
    };
  });

  const lastLoggedAt = $derived(mine.reduce((m, s) => Math.max(m, s.loggedAt), 0));
  const fmt = (ms: number) => {
    const s = Math.max(0, Math.floor(ms / 1000));
    const h = Math.floor(s / 3600);
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, '0');
    return h ? `${h}:${String(m).padStart(2, '0')}:${sec}` : `${m}:${sec}`;
  };

  function showToast(text: string, big = false) {
    toast = { text, big };
    setTimeout(() => (toast = null), big ? 2600 : 1600);
  }

  async function done() {
    if (!step || !block || busy) return;
    busy = true;
    try {
      // Capture before awaiting: the next step's prefill overwrites weight/reps.
      const current = step;
      const w = weight;
      const r = reps;
      const { personalBest } = await logWorkoutSet(session, current, w, r);
      haptic();
      const finished = blockSteps(block).every(
        (s) => isLogged(s, mine) || (s.slot === current.slot && s.setIndex === current.setIndex),
      );
      if (personalBest) {
        celebrate();
        goalSound();
        showToast(`New best · ${exercise(current.exerciseId).name} ${setLabel(exercise(current.exerciseId), w, r)}`, true);
      } else if (finished) {
        goalSound();
        showToast(`${KIND_LABEL[block.kind]} done`, true);
      } else {
        saveSound();
      }
    } finally {
      busy = false;
    }
  }

  async function changeBlock(change: (b: Block) => void) {
    if (!block) return;
    const blocks = session.blocks.map((b) => ({ ...b, exerciseIds: [...b.exerciseIds] }));
    change(blocks[blockIndex]);
    await updateSessionBlocks(session, blocks);
    haptic();
  }

  const addSet = () => changeBlock((b) => (b.sets += 1));
  const endBlock = () => changeBlock((b) => (b.done = true));

  function openEdit(s: WorkoutSet) {
    editing = s;
    editWeight = s.weight;
    editReps = s.reps;
  }

  async function saveEdit() {
    if (!editing) return;
    await updateWorkoutSet(editing.id, editWeight, editReps);
    editing = null;
  }

  async function removeEdit() {
    if (!editing) return;
    await deleteWorkoutSet(editing.id);
    editing = null;
  }

  // Grid of the current block: one row per set, one column per exercise.
  const grid = $derived.by(() => {
    if (!block) return [];
    return Array.from({ length: block.sets }, (_, setIndex) =>
      block.exerciseIds.map((exerciseId, slot) => {
        const logged = mine.find((s) => s.blockId === block.id && s.slot === slot && s.setIndex === setIndex);
        const isCurrent = !!step && step.slot === slot && step.setIndex === setIndex;
        return { setIndex, slot, exerciseId, logged, isCurrent };
      }),
    );
  });

  const totalSteps = $derived(session.blocks.reduce((a, b) => a + (b.done ? 0 : blockSteps(b).length), 0));
</script>

<main class="screen">
  <header class="top">
    <button class="icon-btn" onclick={onback} aria-label="Back to workouts">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <div class="head-text">
      <span class="label">{fmt(now - session.startedAt)} · {mine.length}/{totalSteps} sets</span>
      <h1 class="title">{session.name}</h1>
    </div>
    <button class="icon-btn" onclick={onplan} aria-label="Edit order and exercises">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" /></svg>
    </button>
  </header>

  <div class="progress" aria-hidden="true">
    {#each session.blocks as b, i (b.id)}
      <div class="seg" class:complete={blockComplete(b, mine)} class:current={i === blockIndex}></div>
    {/each}
  </div>

  {#if block && step && ex}
    <section class="card now">
      <span class="kicker">
        {KIND_LABEL[block.kind]} {blockIndex + 1} of {session.blocks.length}{block.optional ? ' · optional' : ''}
      </span>
      <div class="pair">
        {#each block.exerciseIds as id, slot (slot)}
          {#if slot > 0}<span class="alt" aria-label="alternating with">⇄</span>{/if}
          <span class="pair-name" class:active={slot === step.slot}>{exercise(id).name}</span>
        {/each}
      </div>

      <div class="grid" style="grid-template-columns: 44px repeat({block.exerciseIds.length}, minmax(0, 1fr))">
        {#each grid as row (row[0].setIndex)}
          <span class="set-no">{block.kind === 'ladder' ? 'R' : 'S'}{row[0].setIndex + 1}</span>
          {#each row as cell (cell.slot)}
            {#if cell.logged}
              <button class="cell logged" onclick={() => openEdit(cell.logged!)} in:scale={{ start: 0.85, duration: 180 }}>
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                {setLabel(exercise(cell.exerciseId), cell.logged.weight, cell.logged.reps)}
              </button>
            {:else if cell.isCurrent}
              <div class="cell current">now</div>
            {:else}
              <div class="cell"></div>
            {/if}
          {/each}
        {/each}
      </div>
    </section>

    <section class="card entry">
      <div class="entry-head">
        <div>
          <h2>{ex.name}</h2>
          <span class="muted">
            {block.kind === 'ladder' ? 'Rung' : 'Set'} {step.setIndex + 1} of {block.sets}{ex.note ? ` · ${ex.note}` : ''}
          </span>
        </div>
        {#if lastLoggedAt}
          <span class="since" title="Time since your last set">{fmt(now - lastLoggedAt)}</span>
        {/if}
      </div>
      {#if lastTime.length}
        <p class="last">Last time: {lastTime.map((s) => setLabel(ex, s.weight, s.reps)).join(' · ')}</p>
      {/if}

      <div class="steppers">
        <Stepper
          bind:value={weight}
          step={ex.increment}
          label={ex.equipment === 'bodyweight' ? 'Added lb' : 'Weight lb'}
          format={ex.equipment === 'bodyweight' ? (v) => weightLabel(ex, v) : undefined}
        />
        <Stepper bind:value={reps} step={ex.unit === 'sec' ? 5 : 1} min={1} label={ex.unit === 'sec' ? 'Seconds' : 'Reps'} />
      </div>

      <button class="press" onclick={done}>
        Done · {setLabel(ex, weight, reps)}
      </button>

      <div class="block-actions">
        <button class="chip" onclick={addSet}>+ {block.kind === 'ladder' ? 'Rung' : 'Set'}</button>
        <button class="chip" onclick={endBlock}>
          {block.optional ? 'Skip' : block.kind === 'ladder' ? 'End ladder' : 'End block'}
        </button>
      </div>
    </section>

    {#if upNext}
      <p class="next">Up next: {upNext.exerciseIds.map((id) => exercise(id).name).join(' ⇄ ')}</p>
    {/if}
  {/if}

  {#if allDone}
    <section class="card finished" in:fly={{ y: 20 }}>
      <h2>All blocks done</h2>
      <p class="muted">{mine.length} sets in {fmt(now - session.startedAt)}.</p>
    </section>
  {/if}

  <button class={allDone ? 'primary' : 'chip finish'} onclick={onfinish}>Finish workout</button>
</main>

{#if toast}
  <div class="toast" class:big={toast.big} role="status" transition:fly={{ y: -30, duration: 200 }}>{toast.text}</div>
{/if}

{#if editing}
  {@const e = exercise(editing.exerciseId)}
  <Sheet title="{e.name} · set {editing.setIndex + 1}" onclose={() => (editing = null)}>
    <div class="steppers">
      <Stepper bind:value={editWeight} step={e.increment} label={e.equipment === 'bodyweight' ? 'Added lb' : 'Weight lb'} />
      <Stepper bind:value={editReps} step={e.unit === 'sec' ? 5 : 1} min={1} label={e.unit === 'sec' ? 'Seconds' : 'Reps'} />
    </div>
    <button class="primary" onclick={saveEdit}>Save</button>
    <button class="chip" onclick={removeEdit}>Delete set</button>
  </Sheet>
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
    flex: 1;
    min-width: 0;
  }
  .progress {
    display: flex;
    gap: 6px;
  }
  .seg {
    flex: 1;
    height: 6px;
    border-radius: 3px;
    background: var(--line);
    transition: background 0.3s ease;
  }
  .seg.current {
    background: var(--accent-past);
  }
  .seg.complete {
    background: var(--accent);
  }
  .kicker {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-soft);
  }
  .pair {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 6px 10px;
    margin: 6px 0 14px;
  }
  .pair-name {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 800;
    color: var(--muted);
  }
  .pair-name.active {
    color: var(--text);
  }
  .alt {
    color: var(--accent);
    font-size: 18px;
  }
  .grid {
    display: grid;
    gap: 6px;
    align-items: center;
  }
  .set-no {
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
  }
  .cell {
    height: 38px;
    border-radius: 10px;
    border: 1px dashed var(--line);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .cell.logged {
    border: 1px solid var(--accent-past);
    background: #2b1a0d;
    color: var(--accent-soft);
  }
  .cell.current {
    border: 2px solid var(--accent);
    color: var(--accent);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .entry-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-size: 24px;
    font-weight: 800;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
  }
  .since {
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--line);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .last {
    margin: 0;
    font-size: 14px;
    color: var(--accent-soft);
  }
  .steppers {
    display: flex;
    gap: 12px;
    padding-bottom: 8px;
  }
  .press {
    height: 72px;
    border-radius: 20px;
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 7px 0 var(--accent-deep);
    font-family: var(--display);
    font-size: 24px;
    font-weight: 800;
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease;
  }
  .press:active {
    transform: translateY(6px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .block-actions {
    display: flex;
    gap: 8px;
  }
  .block-actions .chip {
    flex: 1;
  }
  .next {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
    text-align: center;
  }
  .finish {
    color: var(--muted);
  }
  .finished h2 {
    margin-bottom: 4px;
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
    background: var(--raised);
    border: 1px solid var(--accent);
    font-weight: 700;
    text-align: center;
  }
  .toast.big {
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--display);
    font-size: 18px;
  }
</style>
