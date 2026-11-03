<script lang="ts">
  let {
    bars,
    height = 96,
    showValues = true,
    format = (v: number) => String(v),
  }: {
    bars: { label: string; value: number; highlight?: boolean }[];
    height?: number;
    showValues?: boolean;
    format?: (v: number) => string;
  } = $props();

  const max = $derived(Math.max(0.0001, ...bars.map((b) => b.value)));
</script>

<div class="bars" style="grid-template-columns: repeat({bars.length}, minmax(0, 1fr)); height: {height + 34}px">
  {#each bars as b, i (i)}
    <div class="col">
      {#if showValues}<span class="value">{b.value ? format(b.value) : ''}</span>{/if}
      <div class="bar" class:hi={b.highlight} class:zero={!b.value} style="height:{Math.max(4, Math.round((b.value / max) * height))}px"></div>
      <span class="label">{b.label}</span>
    </div>
  {/each}
</div>

<style>
  .bars {
    display: grid;
    gap: 6px;
    align-items: end;
  }
  .col {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-end;
    gap: 5px;
    height: 100%;
    min-width: 0;
  }
  .bar {
    width: 100%;
    border-radius: 5px;
    background: var(--accent-past);
    transition: height 0.4s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .bar.hi {
    background: var(--accent);
  }
  .bar.zero {
    background: var(--line);
  }
  .value,
  .label {
    font-size: 10px;
    color: var(--muted);
    white-space: nowrap;
    font-variant-numeric: tabular-nums;
  }
</style>
