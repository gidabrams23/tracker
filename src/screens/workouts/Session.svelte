<script lang="ts">
  import { onMount, tick } from 'svelte';
  import { fly, scale } from 'svelte/transition';
  import Stepper from '../../components/Stepper.svelte';
  import Sheet from '../../components/Sheet.svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import { exercise, setLabel, weightLabel, type Group } from '../../lib/workouts/exercises';
  import { blockComplete, blockSteps, isLogged, nextStep, prefillFor, type Block, type Step } from '../../lib/workouts/plan';
  import {
    deleteWorkoutSet,
    lastTimeSets,
    logWorkoutSet,
    newBlock,
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

  // Nothing here is forced: you can focus any block and tap any empty cell.
  // Without a choice, it suggests the next set in plan order.
  let focusId: string | null = $state(null);
  let picked: Step | null = $state(null);

  const mine = $derived(allSets.filter((s) => s.sessionId === session.id));
  const suggested = $derived(nextStep(session.blocks, mine));
  const blockIndex = $derived.by(() => {
    const byFocus = focusId ? session.blocks.findIndex((b) => b.id === focusId) : -1;
    if (byFocus >= 0) return byFocus;
    const bySuggested = suggested ? session.blocks.findIndex((b) => b.id === suggested.blockId) : -1;
    return bySuggested >= 0 ? bySuggested : session.blocks.length - 1;
  });
  const block: Block | undefined = $derived(session.blocks[blockIndex]);
  const target: Step | null = $derived.by(() => {
    if (!block) return null;
    if (picked && picked.blockId === block.id && !isLogged(picked, mine)) {
      return { ...picked, exerciseId: block.exerciseIds[picked.slot] ?? picked.exerciseId };
    }
    return nextStep([{ ...block, done: false }], mine);
  });
  const ex = $derived(target ? exercise(target.exerciseId) : undefined);
  const lastTime = $derived(target ? lastTimeSets(allSets, target.exerciseId, session.id) : []);
  const allDone = $derived(suggested === null);

  let weight = $state(0);
  let reps = $state(0);
  let toast: { text: string; big: boolean } | null = $state(null);
  let editing: WorkoutSet | null = $state(null);
  let editWeight = $state(0);
  let editReps = $state(0);
  let picker: { mode: 'swap'; slot: number } | { mode: 'pair' } | { mode: 'add' } | null = $state(null);
  let busy = false;
  let entryEl: HTMLElement | undefined = $state();

  // Pre-fill when the target cell or its exercise changes: previous set, else last workout, else defaults.
  let prefilledFor = '';
  $effect(() => {
    if (!target || !ex) return;
    const k = `${target.blockId}:${target.slot}:${target.setIndex}:${target.exerciseId}`;
    if (k === prefilledFor) return;
    prefilledFor = k;
    const pf = prefillFor(target, mine, lastTime, { weight: ex.defaultWeight, reps: ex.defaultReps }, block);
    weight = pf.weight;
    reps = pf.reps;
  });

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
    if (!target || !block || busy) return;
    busy = true;
    try {
      // Capture before awaiting: the next cell's prefill overwrites weight/reps.
      const current = target;
      const w = weight;
      const r = reps;
      const { personalBest } = await logWorkoutSet(session, current, w, r);
      haptic();
      const finished = blockSteps(block).every(
        (s) => isLogged(s, mine) || (s.slot === current.slot && s.setIndex === current.setIndex),
      );
      picked = null;
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
      // A finished block hands focus back to the suggestion.
      if (finished) focusId = null;
    } finally {
      busy = false;
    }
  }

  async function changeBlocks(change: (blocks: Block[]) => void) {
    const blocks: Block[] = session.blocks.map((b) => ({ ...b, exerciseIds: [...b.exerciseIds] }));
    change(blocks);
    await updateSessionBlocks(session, blocks);
    haptic();
  }

  const addSet = () => changeBlocks((bs) => (bs[blockIndex].sets += 1));
  const endBlock = async () => {
    await changeBlocks((bs) => (bs[blockIndex].done = true));
    focusId = null;
    picked = null;
  };

  function focusBlock(b: Block) {
    focusId = b.id;
    picked = null;
    haptic();
  }

  async function pickCell(slot: number, setIndex: number) {
    if (!block) return;
    picked = { blockId: block.id, slot, setIndex, exerciseId: block.exerciseIds[slot] };
    haptic();
    await tick();
    entryEl?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  async function onPick(id: string) {
    const p = picker;
    picker = null;
    if (!p || !block) return;
    if (p.mode === 'swap') {
      // Swaps the exercise for the rest of this block; logged sets keep what you actually did.
      await changeBlocks((bs) => (bs[blockIndex].exerciseIds[p.slot] = id));
    } else if (p.mode === 'pair') {
      await changeBlocks((bs) => {
        bs[blockIndex].exerciseIds.push(id);
        if (bs[blockIndex].kind === 'single') bs[blockIndex].kind = 'superset';
      });
    } else {
      const nb = newBlock('single', [id], 4);
      await changeBlocks((bs) => bs.splice(blockIndex + 1, 0, nb));
      focusId = nb.id;
      picked = null;
    }
  }

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

  const grid = $derived.by(() => {
    const b = block;
    if (!b) return [];
    return Array.from({ length: b.sets }, (_, setIndex) =>
      b.exerciseIds.map((exerciseId, slot) => {
        const logged = mine.find((s) => s.blockId === b.id && s.slot === slot && s.setIndex === setIndex);
        const isTarget = !!target && target.slot === slot && target.setIndex === setIndex;
        return { setIndex, slot, exerciseId, logged, isTarget };
      }),
    );
  });

  const totalSteps = $derived(session.blocks.reduce((a, b) => a + (b.done ? 0 : blockSteps(b).length), 0));
  const shortName = (id: string) => exercise(id).name.replace('Dumbbell ', 'DB ');
  // Swap opens on the same muscle group; pairing opens on the opposite one (curl ⇄ row).
  const pickerGroup: Group = $derived.by(() => {
    if (!picker || !block) return 'biceps';
    if (picker.mode === 'swap') return exercise(block.exerciseIds[picker.slot]).group;
    if (picker.mode === 'pair') return exercise(block.exerciseIds[0]).group === 'biceps' ? 'back' : 'biceps';
    return 'biceps';
  });
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

  <nav class="blocks" aria-label="Blocks">
    {#each session.blocks as b, i (b.id)}
      {@const complete = blockComplete(b, mine)}
      <button class="block-tab" class:active={i === blockIndex} class:complete onclick={() => focusBlock(b)}>
        <span class="tab-no">{complete ? '✓' : i + 1}</span>
        <span class="tab-name">{b.exerciseIds.map(shortName).join(' + ')}</span>
      </button>
    {/each}
  </nav>

  {#if block}
    <section class="card now">
      <div class="block-head">
        <span class="kicker">{KIND_LABEL[block.kind]}{block.optional ? ' · optional' : ''}{block.done ? ' · ended' : ''}</span>
        <span class="muted small">Tap any set to log it</span>
      </div>

      <div class="grid" style="grid-template-columns: 30px repeat({block.exerciseIds.length}, minmax(0, 1fr))">
        <span></span>
        {#each block.exerciseIds as id, slot (slot)}
          <button class="col-head" onclick={() => (picker = { mode: 'swap', slot })} aria-label="Swap {exercise(id).name}">
            <span class="col-name">{exercise(id).name}</span>
            <span class="swap">Swap</span>
          </button>
        {/each}
        {#each grid as row (row[0].setIndex)}
          <span class="set-no">{row[0].setIndex + 1}</span>
          {#each row as cell (cell.slot)}
            {#if cell.logged}
              <button class="cell logged" onclick={() => openEdit(cell.logged!)} in:scale={{ start: 0.85, duration: 180 }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12l5 5L20 7" /></svg>
                {setLabel(exercise(cell.logged.exerciseId), cell.logged.weight, cell.logged.reps)}
              </button>
            {:else}
              <button
                class="cell"
                class:target={cell.isTarget}
                onclick={() => pickCell(cell.slot, cell.setIndex)}
                aria-label="Log {exercise(cell.exerciseId).name} set {cell.setIndex + 1}"
              >
                {cell.isTarget ? 'now' : ''}
              </button>
            {/if}
          {/each}
        {/each}
      </div>

      <div class="block-actions">
        <button class="chip" onclick={addSet}>+ Set</button>
        <button class="chip" onclick={() => (picker = { mode: 'pair' })}>+ Pair</button>
        <button class="chip" onclick={endBlock}>{block.optional ? 'Skip' : 'End'}</button>
      </div>
    </section>

    {#if target && ex}
      <section class="card entry" bind:this={entryEl}>
        <div class="entry-head">
          <div class="entry-title">
            <h2>{ex.name}</h2>
            <span class="muted">
              {block.kind === 'ladder' ? 'Rung' : 'Set'} {target.setIndex + 1} of {block.sets}{ex.note ? ` · ${ex.note}` : ''}
            </span>
          </div>
          {#if lastLoggedAt}
            <span class="since" title="Time since your last set">{fmt(now - lastLoggedAt)}</span>
          {/if}
        </div>
        {#if lastTime.length}
          <p class="last">Last time: {lastTime.map((s) => setLabel(ex, s.weight, s.reps)).join(' · ')}</p>
        {/if}

        <Stepper
          bind:value={weight}
          step={ex.increment}
          label={ex.equipment === 'bodyweight' ? 'Added weight' : 'Weight'}
          unit="lb"
          hint={ex.equipment === 'bodyweight' ? weightLabel(ex, weight) : undefined}
        />
        <Stepper bind:value={reps} step={ex.unit === 'sec' ? 5 : 1} min={1} label={ex.unit === 'sec' ? 'Seconds' : 'Reps'} />

        <button class="press" onclick={done}>Done · {setLabel(ex, weight, reps)}</button>
      </section>
    {/if}
  {/if}

  {#if allDone}
    <section class="card finished" in:fly={{ y: 20 }}>
      <h2>Everything's logged</h2>
      <p class="muted">{mine.length} sets in {fmt(now - session.startedAt)}. Add more or finish.</p>
    </section>
  {/if}

  <button class="chip add" onclick={() => (picker = { mode: 'add' })}>+ Add an exercise</button>
  <button class={allDone ? 'primary' : 'chip finish'} onclick={onfinish}>Finish workout</button>
</main>

{#if toast}
  <div class="toast" class:big={toast.big} role="status" transition:fly={{ y: -30, duration: 200 }}>{toast.text}</div>
{/if}

{#if picker}
  <ExercisePicker
    current={picker.mode === 'swap' && block ? block.exerciseIds[picker.slot] : undefined}
    group={pickerGroup}
    onpick={onPick}
    onclose={() => (picker = null)}
  />
{/if}

{#if editing}
  {@const e = exercise(editing.exerciseId)}
  <Sheet title="{e.name} · set {editing.setIndex + 1}" onclose={() => (editing = null)}>
    <Stepper bind:value={editWeight} step={e.increment} label={e.equipment === 'bodyweight' ? 'Added weight' : 'Weight'} unit="lb" />
    <Stepper bind:value={editReps} step={e.unit === 'sec' ? 5 : 1} min={1} label={e.unit === 'sec' ? 'Seconds' : 'Reps'} />
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
  .blocks {
    display: flex;
    gap: 8px;
    overflow-x: auto;
    margin: 0 -18px;
    padding: 2px 18px 4px;
    scrollbar-width: none;
  }
  .blocks::-webkit-scrollbar {
    display: none;
  }
  .block-tab {
    flex-shrink: 0;
    max-width: 200px;
    display: flex;
    align-items: center;
    gap: 8px;
    height: 44px;
    padding: 0 12px 0 6px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--card);
    color: var(--muted);
    font-size: 13px;
    font-weight: 600;
  }
  .block-tab.active {
    border-color: var(--accent);
    color: var(--text);
  }
  .tab-no {
    width: 30px;
    height: 30px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    background: var(--raised);
    font-weight: 700;
    flex-shrink: 0;
  }
  .block-tab.complete .tab-no {
    background: var(--accent);
    color: var(--on-accent);
  }
  .tab-name {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .block-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 10px;
  }
  .kicker {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-soft);
  }
  .grid {
    display: grid;
    gap: 6px;
    align-items: center;
  }
  .col-head {
    min-width: 0;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 6px 8px;
    border-radius: 10px;
    border: 1px solid var(--line-soft);
    background: var(--raised);
    text-align: left;
  }
  .col-name {
    font-family: var(--display);
    font-size: 15px;
    font-weight: 800;
    line-height: 1.15;
  }
  .swap {
    font-size: 12px;
    color: var(--accent);
    font-weight: 600;
  }
  .set-no {
    font-size: 13px;
    color: var(--muted);
    font-weight: 600;
    text-align: center;
  }
  .cell {
    height: 42px;
    min-width: 0;
    border-radius: 10px;
    border: 1px dashed var(--line);
    background: transparent;
    color: var(--muted);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 5px;
    font-size: 15px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
    white-space: nowrap;
    overflow: hidden;
  }
  .cell.logged {
    border: 1px solid var(--accent-past);
    background: #2b1a0d;
    color: var(--accent-soft);
  }
  .cell.target {
    border: 2px solid var(--accent);
    color: var(--accent);
    font-size: 12px;
    text-transform: uppercase;
    letter-spacing: 0.1em;
  }
  .block-actions {
    display: flex;
    gap: 8px;
    margin-top: 12px;
  }
  .block-actions .chip {
    flex: 1;
  }
  .entry {
    display: flex;
    flex-direction: column;
    gap: 14px;
    scroll-margin-top: 16px;
  }
  .entry-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }
  .entry-title {
    min-width: 0;
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
  .small {
    font-size: 12px;
  }
  .since {
    flex-shrink: 0;
    padding: 6px 10px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--line);
    font-size: 14px;
    font-weight: 600;
    font-variant-numeric: tabular-nums;
  }
  .last {
    margin: -6px 0 0;
    font-size: 14px;
    color: var(--accent-soft);
  }
  .press {
    height: 72px;
    margin-top: 4px;
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
  .add {
    border-style: dashed;
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
