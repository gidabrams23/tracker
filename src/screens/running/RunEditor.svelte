<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from '../../components/Sheet.svelte';
  import Stepper from '../../components/Stepper.svelte';
  import { deleteRun, saveRun } from '../../lib/running/store';
  import { formatPace } from '../../lib/running/stats';
  import { haptic } from '../../lib/feedback';
  import type { Effort, Run, RunType } from '../../lib/db';

  let {
    run,
    today,
    lastType,
    onsaved,
    onclose,
  }: {
    run?: Run;
    today: string;
    lastType: RunType;
    onsaved: (miles: number) => void;
    onclose: () => void;
  } = $props();

  const initial = untrack(() => run);
  let miles = $state(initial?.miles ?? 3);
  let h = $state(initial?.seconds ? Math.floor(initial.seconds / 3600) : 0);
  let m = $state(initial?.seconds ? Math.floor((initial.seconds % 3600) / 60) : 0);
  let s = $state(initial?.seconds ? Math.round(initial.seconds % 60) : 0);
  let type: RunType = $state(initial?.type ?? untrack(() => lastType));
  let effort: Effort | undefined = $state(initial?.effort);
  let day = $state(initial?.day ?? untrack(() => today));
  let notes = $state(initial?.notes ?? '');

  const seconds = $derived((h || 0) * 3600 + (m || 0) * 60 + (s || 0));
  const livePace = $derived(seconds && miles > 0 ? formatPace(seconds / miles) : null);

  const PRESETS = [
    { label: '1', miles: 1 },
    { label: '2', miles: 2 },
    { label: '5K', miles: 3.11 },
    { label: '5', miles: 5 },
    { label: '10K', miles: 6.21 },
  ];

  const num = (v: string, max: number) => Math.min(max, Math.max(0, Math.floor(Number(v) || 0)));

  async function save() {
    if (miles <= 0) return;
    await saveRun({
      id: initial?.id,
      day,
      miles,
      seconds: seconds || undefined,
      type,
      effort,
      notes: notes.trim(),
    });
    haptic();
    onsaved(miles);
  }

  async function remove() {
    if (initial && confirm('Delete this run?')) {
      await deleteRun(initial.id);
      onclose();
    }
  }
</script>

<Sheet title={initial ? 'Edit run' : 'Log a run'} {onclose}>
  <Stepper bind:value={miles} step={0.1} min={0} max={200} label="Distance" unit="mi" />
  <div class="presets">
    {#each PRESETS as p (p.label)}
      <button class="chip" class:on={miles === p.miles} onclick={() => (miles = p.miles)}>{p.label}</button>
    {/each}
  </div>

  <div class="field">
    <span class="label">Time <small>(optional)</small></span>
    <div class="time">
      <label><input type="number" inputmode="numeric" min="0" value={h || ''} placeholder="0" onchange={(e) => (h = num(e.currentTarget.value, 23))} /><span>h</span></label>
      <label><input type="number" inputmode="numeric" min="0" value={m || ''} placeholder="00" onchange={(e) => (m = num(e.currentTarget.value, 59))} /><span>m</span></label>
      <label><input type="number" inputmode="numeric" min="0" value={s || ''} placeholder="00" onchange={(e) => (s = num(e.currentTarget.value, 59))} /><span>s</span></label>
    </div>
    {#if livePace}<span class="pace">{livePace} /mi</span>{/if}
  </div>

  <div class="field">
    <span class="label">Where</span>
    <div class="seg">
      <button class:on={type === 'outdoor'} onclick={() => (type = 'outdoor')}>Outdoor</button>
      <button class:on={type === 'treadmill'} onclick={() => (type = 'treadmill')}>Treadmill</button>
    </div>
  </div>

  <div class="field">
    <span class="label">Effort <small>(optional)</small></span>
    <div class="seg">
      {#each ['easy', 'steady', 'hard'] as const as e (e)}
        <button class:on={effort === e} onclick={() => (effort = effort === e ? undefined : e)}>{e[0].toUpperCase() + e.slice(1)}</button>
      {/each}
    </div>
  </div>

  <label class="field">
    <span class="label">Date</span>
    <input class="text" type="date" bind:value={day} max={today} />
  </label>

  <label class="field">
    <span class="label">Notes</span>
    <textarea class="text" rows="2" bind:value={notes} placeholder="Route, how it felt, weather…"></textarea>
  </label>

  <button class="primary" onclick={save} disabled={miles <= 0}>Save run</button>
  {#if initial}<button class="chip" onclick={remove}>Delete run</button>{/if}
</Sheet>

<style>
  .presets {
    display: flex;
    gap: 6px;
  }
  .presets .chip {
    flex: 1;
    min-width: 0;
  }
  .chip.on {
    border-color: var(--accent);
    color: var(--accent);
  }
  .field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .label {
    font-size: 12px;
    font-weight: 600;
    letter-spacing: 0.1em;
    text-transform: uppercase;
    color: var(--muted);
  }
  small {
    text-transform: none;
    letter-spacing: 0;
    font-weight: 400;
  }
  .time {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 8px;
  }
  .time label {
    display: flex;
    align-items: center;
    gap: 4px;
    height: 52px;
    padding: 0 12px;
    border-radius: 14px;
    background: #120e0b;
    border: 1px solid var(--line-soft);
  }
  .time label:focus-within {
    border-color: var(--accent);
  }
  .time input {
    width: 100%;
    min-width: 0;
    border: none;
    background: transparent;
    color: var(--text);
    font-family: var(--display);
    font-size: 24px;
    font-weight: 800;
    text-align: right;
  }
  .time input:focus {
    outline: none;
  }
  .time span {
    color: var(--muted);
    font-weight: 600;
  }
  .pace {
    font-size: 14px;
    color: var(--accent-soft);
    font-weight: 600;
  }
  .seg {
    display: flex;
    gap: 6px;
    padding: 4px;
    border-radius: 14px;
    background: #120e0b;
    border: 1px solid var(--line-soft);
  }
  .seg button {
    flex: 1;
    height: 42px;
    border-radius: 10px;
    border: none;
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }
  .seg button.on {
    background: var(--accent);
    color: var(--on-accent);
  }
  .text {
    width: 100%;
    border-radius: 14px;
    border: 1px solid var(--line-soft);
    background: #120e0b;
    color: var(--text);
    padding: 12px;
    font-size: 16px;
    font-family: var(--body);
    resize: vertical;
  }
  input.text {
    height: 48px;
  }
</style>
