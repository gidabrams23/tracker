<script lang="ts">
  import { haptic, clickSound } from '../lib/feedback';

  let {
    value = $bindable(),
    step = 1,
    min = 0,
    max = 9999,
    label,
    format,
  }: {
    value: number;
    step?: number;
    min?: number;
    max?: number;
    label: string;
    format?: (v: number) => string;
  } = $props();

  function nudge(dir: 1 | -1) {
    const next = Math.round((value + dir * step) * 100) / 100;
    value = Math.min(max, Math.max(min, next));
    haptic();
    clickSound();
  }

  function typed(e: Event & { currentTarget: HTMLInputElement }) {
    const n = Number(e.currentTarget.value);
    if (Number.isFinite(n)) value = Math.min(max, Math.max(min, n));
  }
</script>

<div class="stepper">
  <span class="label">{label}</span>
  <div class="row">
    <button class="nudge" onclick={() => nudge(-1)} aria-label="Decrease {label}">−</button>
    <div class="value">
      <input type="number" inputmode="decimal" value={value} onchange={typed} aria-label={label} />
      {#if format}<span class="fmt">{format(value)}</span>{/if}
    </div>
    <button class="nudge" onclick={() => nudge(1)} aria-label="Increase {label}">+</button>
  </div>
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    gap: 6px;
    flex: 1;
    min-width: 0;
  }
  .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
    text-align: center;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .nudge {
    width: 44px;
    height: 52px;
    flex-shrink: 0;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: var(--raised);
    color: var(--accent-soft);
    font-size: 24px;
    font-weight: 600;
  }
  .nudge:active {
    transform: translateY(2px);
  }
  .value {
    flex: 1;
    min-width: 0;
    position: relative;
    display: flex;
    flex-direction: column;
    align-items: center;
  }
  input {
    width: 100%;
    height: 52px;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: center;
    font-family: var(--display);
    font-size: 36px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  input:focus {
    outline: 2px solid var(--accent);
    border-radius: 10px;
  }
  .fmt {
    position: absolute;
    bottom: -14px;
    font-size: 11px;
    color: var(--muted);
    white-space: nowrap;
  }
</style>
