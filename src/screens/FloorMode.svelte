<script lang="ts">
  import { onMount } from 'svelte';
  import { allSets, logSet, totalsByDay } from '../lib/pushups';
  import { settings } from '../lib/settings.svelte';
  import { keepAwake } from '../lib/wakelock';
  import { haptic, clickSound, saveSound, goalSound } from '../lib/feedback';
  import type { Go } from '../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  // A chest touch can register twice; ignore touches closer together than this.
  const DEBOUNCE_MS = 350;

  let reps = $state(0);
  let lastTouch = 0;
  let toast = $state('');

  const target = $derived(settings.floorTarget);
  const fill = $derived(Math.min(reps / target, 1));
  const total = $derived(totalsByDay($allSets ?? []).get(today) ?? 0);
  const setNo = $derived(($allSets ?? []).filter((s) => s.day === today).length + 1);

  const hint = $derived(
    reps === 0
      ? 'Set the phone on the floor under your chest. Touch the screen at the bottom of each rep.'
      : reps >= target
        ? 'Target hit. Keep going or save the set.'
        : `${target - reps} to go`,
  );

  onMount(() => keepAwake());

  function rep(e: PointerEvent) {
    e.preventDefault();
    const now = performance.now();
    if (now - lastTouch < DEBOUNCE_MS) return;
    lastTouch = now;
    reps++;
    haptic();
    if (reps === target) goalSound();
    else clickSound();
  }

  async function save() {
    if (!reps) return;
    const n = reps;
    reps = 0;
    await logSet(n, 'floor');
    saveSound();
    toast = `Saved ${n}`;
    setTimeout(() => (toast = ''), 1800);
  }
</script>

<main class="floor">
  <header>
    <button class="icon-btn" onclick={() => go('pushups')} aria-label="Back to push-ups">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <div class="head-text">
      <span class="label">Floor mode</span>
      <span class="set">Set {setNo} · target {target}</span>
    </div>
    <span class="today">Today {total}</span>
  </header>

  <button class="pad" onpointerdown={rep} aria-label="Count one rep">
    <div class="fill" style="height:{fill * 100}%"></div>
    <div class="content">
      <span class="num">{reps}</span>
      <span class="hint">{toast || hint}</span>
    </div>
  </button>

  <footer>
    <button class="ghost" onclick={() => (reps = 0)} disabled={!reps}>Reset</button>
    <button class="primary" onclick={save} disabled={!reps}>Save set</button>
  </footer>
</main>

<style>
  .floor {
    height: 100dvh;
    max-width: 480px;
    margin: 0 auto;
    display: flex;
    flex-direction: column;
    padding: calc(env(safe-area-inset-top) + 12px) 14px calc(env(safe-area-inset-bottom) + 16px);
    gap: 14px;
    background: #120d09;
  }
  header {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head-text {
    display: flex;
    flex-direction: column;
    flex: 1;
  }
  .set {
    font-size: 20px;
    font-weight: 700;
  }
  .today {
    color: var(--muted);
    font-size: 15px;
  }
  .pad {
    position: relative;
    flex: 1;
    border-radius: 28px;
    border: 1px solid var(--line);
    background: #1e1610;
    overflow: hidden;
    padding: 0;
    touch-action: none;
  }
  .fill {
    position: absolute;
    left: 0;
    right: 0;
    bottom: 0;
    background: #c9500a;
    transition: height 0.15s ease;
  }
  .content {
    position: absolute;
    inset: 0;
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    gap: 10px;
  }
  .num {
    font-family: var(--display);
    font-size: 168px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
  }
  .hint {
    max-width: 260px;
    text-align: center;
    font-size: 17px;
    font-weight: 600;
    line-height: 1.35;
  }
  footer {
    display: flex;
    gap: 12px;
  }
  .ghost {
    flex: 1;
    height: 56px;
    border-radius: 16px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--accent-soft);
    font-size: 17px;
    font-weight: 600;
  }
  .ghost:disabled {
    color: var(--muted);
    opacity: 0.6;
  }
  footer .primary {
    flex: 2;
    height: 56px;
    border-radius: 16px;
  }
</style>
