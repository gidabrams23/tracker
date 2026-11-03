<script lang="ts">
  import { backOut } from 'svelte/easing';
  import { fly } from 'svelte/transition';

  // Atomic Habits' paper-clip jar: every set drops a token in; ghosts show what's left.
  let { sets, goal, unit }: { sets: { id: string; reps: number }[]; goal: number; unit: number } = $props();

  const MAX_GHOSTS = 8;

  const tokens = $derived.by(() => {
    let running = 0;
    return sets.map((s) => {
      const bonus = goal > 0 && running >= goal;
      running += s.reps;
      return { ...s, bonus };
    });
  });
  const total = $derived(sets.reduce((a, s) => a + s.reps, 0));
  const ghosts = $derived(goal > 0 && unit > 0 ? Math.min(MAX_GHOSTS, Math.ceil(Math.max(0, goal - total) / unit)) : 0);
</script>

<div class="jar" aria-label="{sets.length} sets today{ghosts ? `, about ${ghosts} more to reach the goal` : ''}">
  {#each tokens as t (t.id)}
    <div class="token" class:bonus={t.bonus} in:fly={{ y: -70, duration: 520, easing: backOut }}>{t.reps}</div>
  {/each}
  {#each Array(ghosts) as _, i (i)}
    <div class="token ghost" aria-hidden="true"></div>
  {/each}
  {#if sets.length === 0 && ghosts === 0}
    <span class="empty">Log a set to start the jar</span>
  {/if}
</div>

<style>
  .jar {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
    padding: 12px;
    min-height: 68px;
    border-radius: 18px;
    background: #120e0b;
    border: 1px solid var(--line-soft);
  }
  .token {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow:
      inset 0 -4px 0 rgba(0, 0, 0, 0.22),
      0 2px 0 var(--accent-deep);
    font-family: var(--display);
    font-size: 16px;
    font-weight: 800;
  }
  .token.bonus {
    background: #ffc46b;
  }
  .ghost {
    background: transparent;
    border: 2px dashed var(--line);
    box-shadow: none;
  }
  .empty {
    align-self: center;
    color: var(--muted);
    font-size: 14px;
  }
</style>
