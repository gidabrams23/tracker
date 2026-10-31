<script lang="ts" module>
  export interface Bar {
    day: string;
    label: string;
    total: number;
    goal: number;
    isToday: boolean;
  }
</script>

<script lang="ts">
  let { bars, onselect }: { bars: Bar[]; onselect?: (day: string) => void } = $props();

  const max = $derived(Math.max(1, ...bars.map((b) => Math.max(b.total, b.goal))));
</script>

<div class="bars">
  {#each bars as b, i (i)}
    <button class="col" onclick={() => onselect?.(b.day)} aria-label="{b.label}: {b.total} push-ups. Edit this day">
      <span class="value">{b.total || ''}</span>
      <div
        class="bar"
        class:today={b.isToday}
        class:met={!b.isToday && b.goal > 0 && b.total >= b.goal}
        style="height:{Math.max(6, Math.round((b.total / max) * 70))}px"
      ></div>
      <span class="day">{b.label}</span>
    </button>
  {/each}
</div>

<style>
  .bars {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
    align-items: end;
    height: 112px;
  }
  .col {
    padding: 0;
    border: none;
    background: transparent;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 6px;
    height: 100%;
  }
  .bar {
    width: 100%;
    border-radius: 6px;
    background: var(--line);
    transition: height 0.3s ease;
  }
  .bar.met {
    background: var(--accent-past);
  }
  .bar.today {
    background: var(--accent);
  }
  .value {
    font-size: 11px;
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .day {
    font-size: 11px;
    color: var(--muted);
  }
</style>
