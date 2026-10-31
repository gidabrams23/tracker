<script lang="ts">
  import Sheet from './Sheet.svelte';
  import Stepper from './Stepper.svelte';
  import { deleteSet, logSet } from '../lib/pushups';
  import { parseDay, timeLabel, WEEKDAY_NAMES, weekday } from '../lib/day';
  import { haptic, saveSound } from '../lib/feedback';
  import type { PushupSet } from '../lib/db';

  let { day, today, sets, onclose }: { day: string; today: string; sets: PushupSet[]; onclose: () => void } = $props();

  let reps = $state(20);

  const total = $derived(sets.reduce((a, s) => a + s.reps, 0));
  const title = $derived(
    day === today ? 'Today' : `${WEEKDAY_NAMES[weekday(day)]}, ${parseDay(day).toLocaleDateString([], { month: 'short', day: 'numeric' })}`,
  );

  async function add() {
    // Past days get a midday timestamp so they sort sensibly; today uses now.
    const at = day === today ? new Date() : parseDay(day);
    if (day !== today) at.setHours(12, 0, 0, 0);
    await logSet(reps, 'quick', at);
    haptic();
    saveSound();
  }
</script>

<Sheet {title} {onclose}>
  <p class="total"><strong>{total}</strong> push-ups logged</p>

  <div class="add">
    <Stepper bind:value={reps} step={5} min={1} label="Reps" />
    <button class="primary" onclick={add}>Add {reps}</button>
  </div>

  <div class="list">
    {#each sets as s (s.id)}
      <div class="row">
        <span class="muted">{timeLabel(s.loggedAt)}</span>
        <span class="reps">{s.reps}</span>
        <button class="del" onclick={() => deleteSet(s.id)} aria-label="Delete set of {s.reps}">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
        </button>
      </div>
    {:else}
      <p class="muted">No sets on this day yet.</p>
    {/each}
  </div>
</Sheet>

<style>
  .total {
    margin: 0;
    color: var(--muted);
  }
  .total strong {
    color: var(--text);
    font-family: var(--display);
    font-size: 28px;
  }
  .add {
    display: flex;
    align-items: flex-end;
    gap: 12px;
  }
  .add .primary {
    flex-shrink: 0;
    padding: 0 20px;
    white-space: nowrap;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 0;
    border-top: 1px solid var(--line-soft);
  }
  .muted {
    flex: 1;
    color: var(--muted);
    margin: 0;
  }
  .reps {
    font-weight: 600;
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
</style>
