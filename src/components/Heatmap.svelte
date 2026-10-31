<script lang="ts">
  import { addDays, weekday } from '../lib/day';

  let {
    totals,
    today,
    goalFor,
    weeks = 12,
  }: { totals: Map<string, number>; today: string; goalFor: (day: string) => number; weeks?: number } = $props();

  // Columns are weeks (Sunday at top), ending with the current week.
  const cells = $derived.by(() => {
    const start = addDays(today, -(weekday(today) + 7 * (weeks - 1)));
    return Array.from({ length: weeks * 7 }, (_, i) => {
      const day = addDays(start, i);
      if (day > today) return { day, level: -1 };
      const total = totals.get(day) ?? 0;
      const goal = goalFor(day);
      const ratio = goal > 0 ? total / goal : total > 0 ? 1 : 0;
      const level = total === 0 ? 0 : ratio >= 1 ? 3 : ratio >= 0.5 ? 2 : 1;
      return { day, level, total };
    });
  });
</script>

<div class="grid" style="grid-template-columns:repeat({weeks}, minmax(0, 1fr))" role="img" aria-label="Push-ups over the last {weeks} weeks">
  {#each cells as c (c.day)}
    <div class="cell l{c.level}" title={c.level >= 0 ? `${c.day}: ${c.total}` : ''}></div>
  {/each}
</div>

<style>
  .grid {
    display: grid;
    grid-template-rows: repeat(7, auto);
    grid-auto-flow: column;
    gap: 4px;
  }
  .cell {
    aspect-ratio: 1;
    border-radius: 4px;
  }
  .l-1 {
    background: transparent;
  }
  .l0 {
    background: #2a221b;
  }
  .l1 {
    background: #5a3317;
  }
  .l2 {
    background: var(--accent-past);
  }
  .l3 {
    background: var(--accent);
  }
</style>
