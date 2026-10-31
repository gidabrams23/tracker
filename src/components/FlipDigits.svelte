<script lang="ts">
  import { fly } from 'svelte/transition';

  let { value, minDigits = 3 }: { value: number; minDigits?: number } = $props();

  const digits = $derived(String(Math.max(0, value)).padStart(minDigits, '0').split(''));
</script>

<div class="digits" aria-label="{value} push-ups" role="img">
  {#each digits as d, i (i)}
    <div class="tile" aria-hidden="true">
      {#key d}
        <span in:fly={{ y: -18, duration: 180 }}>{d}</span>
      {/key}
      <div class="seam"></div>
    </div>
  {/each}
</div>

<style>
  .digits {
    display: flex;
    gap: 4px;
  }
  .tile {
    position: relative;
    width: 38px;
    height: 54px;
    border-radius: 8px;
    background: #2a221b;
    border: 1px solid var(--line);
    display: grid;
    place-items: center;
    overflow: hidden;
    font-family: var(--display);
    font-size: 38px;
    font-weight: 800;
    color: #fff3e8;
    font-variant-numeric: tabular-nums;
  }
  .tile span {
    grid-area: 1 / 1;
  }
  .seam {
    position: absolute;
    left: 0;
    right: 0;
    top: 50%;
    height: 1px;
    background: #0e0b08;
  }
</style>
