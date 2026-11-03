<script lang="ts">
  import { untrack } from 'svelte';
  import ExercisePicker from './ExercisePicker.svelte';
  import { exercise, type Group } from '../../lib/workouts/exercises';
  import { ladderBlock, newBlock } from '../../lib/workouts/store';
  import { ladderWeights, type Block, type BlockKind, type LadderSpec } from '../../lib/workouts/plan';
  import { haptic } from '../../lib/feedback';

  let {
    title,
    blocks,
    locked = new Set<string>(),
    onsave,
    onclose,
    onreset,
  }: {
    title: string;
    blocks: Block[];
    locked?: Set<string>;
    onsave: (blocks: Block[]) => void;
    onclose: () => void;
    onreset?: () => void;
  } = $props();

  // Edits a copy; nothing is saved until "Save order".
  let draft: Block[] = $state(untrack(() => JSON.parse(JSON.stringify(blocks))));
  let picking: { block: number; slot: number } | null = $state(null);

  const KIND_LABEL: Record<BlockKind, string> = { superset: 'Superset', single: 'Straight sets', ladder: 'Ladder' };

  function move(i: number, dir: -1 | 1) {
    const j = i + dir;
    if (j < 0 || j >= draft.length) return;
    [draft[i], draft[j]] = [draft[j], draft[i]];
    haptic();
  }

  function remove(i: number) {
    draft.splice(i, 1);
    haptic();
  }

  function setCount(i: number, dir: -1 | 1) {
    draft[i].sets = Math.max(1, Math.min(12, draft[i].sets + dir));
  }

  function add(kind: BlockKind, group?: Group) {
    if (kind === 'superset') draft.push(newBlock('superset', ['db-curl', 'lat-pulldown']));
    else if (kind === 'ladder') draft.push(ladderBlock('db-curl'));
    else draft.push(newBlock('single', [group === 'abs' ? 'cable-crunch' : 'face-pull'], 3, group === 'abs'));
    haptic();
  }

  function tuneLadder(i: number, field: keyof LadderSpec, dir: -1 | 1) {
    const l = draft[i].ladder;
    if (!l) return;
    l[field] = Math.max(field === 'step' ? 5 : 0, l[field] + dir * 5);
    if (l.peak < l.start) l.peak = l.start;
    draft[i].sets = ladderWeights(l).length;
  }

  function pick(id: string) {
    if (!picking) return;
    draft[picking.block].exerciseIds[picking.slot] = id;
    picking = null;
  }
</script>

<main class="screen">
  <header class="top">
    <button class="icon-btn" onclick={onclose} aria-label="Cancel">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <div class="head-text">
      <span class="label">Edit order</span>
      <h1 class="title">{title}</h1>
    </div>
  </header>

  <p class="muted">Swap exercises when a machine is taken, reorder blocks with the arrows. Your arrangement is remembered for next time.</p>

  {#each draft as b, i (b.id)}
    {@const isLocked = locked.has(b.id)}
    <section class="card block">
      <div class="block-head">
        <span class="kind">{i + 1} · {KIND_LABEL[b.kind]}{b.optional ? ' · optional' : ''}{isLocked ? ' · started' : ''}</span>
        <div class="tools">
          <button class="mini" onclick={() => move(i, -1)} disabled={i === 0} aria-label="Move up">↑</button>
          <button class="mini" onclick={() => move(i, 1)} disabled={i === draft.length - 1} aria-label="Move down">↓</button>
          <button class="mini" onclick={() => remove(i)} disabled={isLocked} aria-label="Remove block">✕</button>
        </div>
      </div>

      {#each b.exerciseIds as id, slot (slot)}
        {#if slot > 0}<span class="swap-sign" aria-hidden="true">⇄ alternate with</span>{/if}
        <button class="exercise" onclick={() => (picking = { block: i, slot })}>
          <span>{exercise(id).name}</span>
          <span class="change">Swap</span>
        </button>
      {/each}

      {#if b.ladder}
        <p class="muted">{ladderWeights(b.ladder).join(' → ')} lb · {b.sets} rungs</p>
        {#each [['start', 'Start'], ['peak', 'Peak'], ['step', 'Step']] as [field, label] (field)}
          <div class="sets">
            <span class="muted">{label}</span>
            <div class="tools">
              <button class="mini" onclick={() => tuneLadder(i, field as keyof LadderSpec, -1)} aria-label="Lower {label}">−</button>
              <span class="count">{b.ladder[field as keyof LadderSpec]}</span>
              <button class="mini" onclick={() => tuneLadder(i, field as keyof LadderSpec, 1)} aria-label="Raise {label}">+</button>
            </div>
          </div>
        {/each}
      {:else}
        <div class="sets">
          <span class="muted">{b.kind === 'ladder' ? 'Rungs' : 'Sets each'}</span>
          <div class="tools">
            <button class="mini" onclick={() => setCount(i, -1)} aria-label="Fewer sets">−</button>
            <span class="count">{b.sets}</span>
            <button class="mini" onclick={() => setCount(i, 1)} aria-label="More sets">+</button>
          </div>
        </div>
      {/if}
    </section>
  {/each}

  <div class="adds">
    <button class="chip" onclick={() => add('superset')}>+ Superset</button>
    <button class="chip" onclick={() => add('single')}>+ Single</button>
    <button class="chip" onclick={() => add('single', 'abs')}>+ Abs</button>
    <button class="chip" onclick={() => add('ladder')}>+ Ladder</button>
  </div>

  <button class="primary" onclick={() => onsave(draft)}>Save order</button>
  {#if onreset}
    <button class="link" onclick={onreset}>Reset to my default routine</button>
  {/if}
</main>

{#if picking}
  {@const id = draft[picking.block].exerciseIds[picking.slot]}
  <ExercisePicker current={id} group={exercise(id).group} onpick={pick} onclose={() => (picking = null)} />
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
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
    line-height: 1.4;
  }
  .block {
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .block-head,
  .sets {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .kind {
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
    color: var(--accent-soft);
  }
  .tools {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .mini {
    width: 36px;
    height: 36px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--raised);
    color: var(--text);
    font-size: 16px;
  }
  .mini:disabled {
    opacity: 0.35;
  }
  .exercise {
    display: flex;
    justify-content: space-between;
    align-items: center;
    min-height: 50px;
    padding: 0 14px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--raised);
    font-size: 16px;
    font-weight: 600;
    text-align: left;
  }
  .exercise:disabled {
    opacity: 0.8;
  }
  .change {
    font-size: 13px;
    color: var(--accent);
  }
  .swap-sign {
    font-size: 12px;
    color: var(--muted);
    padding-left: 14px;
  }
  .count {
    min-width: 24px;
    text-align: center;
    font-weight: 700;
  }
  .adds {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 8px;
  }
  .link {
    border: none;
    background: transparent;
    color: var(--muted);
    text-decoration: underline;
    padding: 8px;
  }
</style>
