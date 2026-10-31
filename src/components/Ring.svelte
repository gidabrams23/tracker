<script lang="ts">
  import type { Snippet } from 'svelte';

  let {
    pct,
    size = 196,
    stroke = 10,
    children,
  }: { pct: number; size?: number; stroke?: number; children?: Snippet } = $props();

  const r = $derived(size / 2 - stroke / 2 - 2);
  const c = $derived(2 * Math.PI * r);
  const offset = $derived(c * (1 - Math.min(Math.max(pct, 0), 1)));
</script>

<div class="ring" style="width:{size}px;height:{size}px">
  <svg width={size} height={size} viewBox="0 0 {size} {size}" aria-hidden="true">
    <circle cx={size / 2} cy={size / 2} {r} fill="none" stroke="var(--ring-track)" stroke-width={stroke} />
    <circle
      class="progress"
      cx={size / 2}
      cy={size / 2}
      {r}
      fill="none"
      stroke="var(--accent)"
      stroke-width={stroke}
      stroke-linecap="round"
      stroke-dasharray={c}
      stroke-dashoffset={offset}
      transform="rotate(-90 {size / 2} {size / 2})"
    />
  </svg>
  <div class="center">{@render children?.()}</div>
</div>

<style>
  .ring {
    position: relative;
    flex-shrink: 0;
  }
  svg {
    position: absolute;
    inset: 0;
  }
  .progress {
    transition: stroke-dashoffset 0.35s cubic-bezier(0.2, 0.8, 0.2, 1);
  }
  .center {
    position: absolute;
    inset: 0;
    display: grid;
    place-items: center;
  }
</style>
