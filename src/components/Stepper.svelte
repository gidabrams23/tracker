<script lang="ts">
  import { haptic, clickSound } from '../lib/feedback';

  let {
    value = $bindable(),
    step = 1,
    min = 0,
    max = 9999,
    label,
    unit = '',
    hint,
  }: {
    value: number;
    step?: number;
    min?: number;
    max?: number;
    label: string;
    /** Shown after the number, e.g. "lb". */
    unit?: string;
    /** Small text under the number, e.g. "BW+25". */
    hint?: string;
  } = $props();

  function nudge(dir: 1 | -1) {
    const next = Math.round((value + dir * step) * 100) / 100;
    value = Math.min(max, Math.max(min, next));
    haptic();
    clickSound();
  }

  function typed(e: Event & { currentTarget: HTMLInputElement }) {
    const n = Number(e.currentTarget.value);
    if (e.currentTarget.value !== '' && Number.isFinite(n)) value = Math.min(max, Math.max(min, n));
  }

  function focused(e: FocusEvent & { currentTarget: HTMLInputElement }) {
    const el = e.currentTarget;
    // Select so typing replaces the number; keep the field above the keyboard.
    requestAnimationFrame(() => el.select());
    setTimeout(() => el.scrollIntoView({ block: 'center', behavior: 'smooth' }), 300);
  }
</script>

<div class="stepper">
  <span class="label">{label}</span>
  <div class="row">
    <button class="nudge" onclick={() => nudge(-1)} aria-label="Decrease {label}">−</button>
    <label class="value">
      <input
        type="number"
        inputmode="decimal"
        {value}
        onchange={typed}
        onfocus={focused}
        aria-label={label}
        size="4"
      />
      {#if unit}<span class="unit">{unit}</span>{/if}
    </label>
    <button class="nudge" onclick={() => nudge(1)} aria-label="Increase {label}">+</button>
  </div>
  {#if hint}<span class="hint">{hint}</span>{/if}
</div>

<style>
  .stepper {
    display: flex;
    flex-direction: column;
    gap: 6px;
    width: 100%;
    min-width: 0;
  }
  .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .row {
    display: grid;
    grid-template-columns: 56px minmax(0, 1fr) 56px;
    align-items: center;
    gap: 8px;
  }
  .nudge {
    height: 56px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: var(--raised);
    color: var(--accent-soft);
    font-size: 26px;
    font-weight: 600;
  }
  .nudge:active {
    transform: translateY(2px);
  }
  .value {
    height: 56px;
    border-radius: 16px;
    background: #120e0b;
    border: 1px solid var(--line-soft);
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 0 10px;
    min-width: 0;
  }
  .value:focus-within {
    border-color: var(--accent);
  }
  input {
    width: 100%;
    min-width: 0;
    max-width: 5.5ch;
    border: none;
    background: transparent;
    color: var(--text);
    text-align: center;
    font-family: var(--display);
    font-size: 34px;
    font-weight: 800;
    font-variant-numeric: tabular-nums;
    padding: 0;
    -moz-appearance: textfield;
    appearance: textfield;
  }
  input:focus {
    outline: none;
  }
  input::-webkit-outer-spin-button,
  input::-webkit-inner-spin-button {
    -webkit-appearance: none;
    margin: 0;
  }
  .unit {
    font-size: 15px;
    font-weight: 600;
    color: var(--muted);
  }
  .hint {
    font-size: 12px;
    color: var(--muted);
    text-align: center;
  }
</style>
