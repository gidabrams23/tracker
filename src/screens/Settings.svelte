<script lang="ts">
  import { onMount } from 'svelte';
  import { settings, saveSettings } from '../lib/settings.svelte';
  import { exportBackup, importBackup, lastBackupAt } from '../lib/backup';
  import { WEEKDAY_NAMES } from '../lib/day';
  import type { Go } from '../lib/nav';

  let { go }: { go: Go } = $props();

  let lastBackup: number | null = $state(null);
  let persisted: boolean | null = $state(null);
  let message = $state('');
  let fileInput: HTMLInputElement;

  onMount(async () => {
    lastBackup = await lastBackupAt();
    persisted = (await navigator.storage?.persisted?.()) ?? null;
  });

  const backupAge = $derived.by(() => {
    if (!lastBackup) return 'Never backed up';
    const days = Math.floor((Date.now() - lastBackup) / 86_400_000);
    return days === 0 ? 'Backed up today' : `Last backup ${days} ${days === 1 ? 'day' : 'days'} ago`;
  });

  function clampInt(v: string, min: number, max: number): number {
    const n = Math.round(Number(v));
    return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : min;
  }

  function setGoal(i: number, v: string) {
    settings.goals[i] = clampInt(v, 0, 2000);
    void saveSettings();
  }

  function setQuick(i: number, v: string) {
    settings.quickSets[i] = clampInt(v, 1, 500);
    void saveSettings();
  }

  async function doExport() {
    try {
      const r = await exportBackup();
      if (r !== 'cancelled') {
        lastBackup = Date.now();
        message = 'Backup saved.';
      }
    } catch (e) {
      message = `Backup failed: ${(e as Error).message}`;
    }
  }

  async function doImport(e: Event) {
    const file = (e.currentTarget as HTMLInputElement).files?.[0];
    if (!file) return;
    try {
      const n = await importBackup(file);
      message = `Restored ${n} sets.`;
      location.reload();
    } catch (err) {
      message = (err as Error).message;
    } finally {
      fileInput.value = '';
    }
  }
</script>

<main class="screen">
  <header class="top">
    <button class="icon-btn" onclick={() => go('home')} aria-label="Back to home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <h1 class="title">Settings</h1>
  </header>

  <section class="card">
    <h2>Daily goal</h2>
    <p class="muted">Set a day to 0 to make it a rest day. Rest days never break your streak.</p>
    {#each WEEKDAY_NAMES as name, i (i)}
      <label class="field">
        <span>{name}</span>
        <input type="number" inputmode="numeric" min="0" value={settings.goals[i]} onchange={(e) => setGoal(i, e.currentTarget.value)} />
      </label>
    {/each}
  </section>

  <section class="card">
    <h2>Set buttons</h2>
    {#each settings.heroSets as n, i (i)}
      <label class="field">
        <span>Big button {i + 1}</span>
        <input
          type="number"
          inputmode="numeric"
          min="1"
          value={n}
          onchange={(e) => {
            settings.heroSets[i] = clampInt(e.currentTarget.value, 1, 500);
            void saveSettings();
          }}
        />
      </label>
    {/each}
    {#each settings.quickSets as n, i (i)}
      <label class="field">
        <span>Small button {i + 1}</span>
        <input type="number" inputmode="numeric" min="1" value={n} onchange={(e) => setQuick(i, e.currentTarget.value)} />
      </label>
    {/each}
    <label class="field">
      <span>Floor mode target</span>
      <input
        type="number"
        inputmode="numeric"
        min="1"
        value={settings.floorTarget}
        onchange={(e) => {
          settings.floorTarget = clampInt(e.currentTarget.value, 1, 500);
          void saveSettings();
        }}
      />
    </label>
  </section>

  <section class="card">
    <h2>Albums</h2>
    <label class="field">
      <span>Albums per week</span>
      <input
        type="number"
        inputmode="numeric"
        min="1"
        value={settings.albumsPerWeek}
        onchange={(e) => {
          settings.albumsPerWeek = clampInt(e.currentTarget.value, 1, 14);
          void saveSettings();
        }}
      />
    </label>
  </section>

  <section class="card">
    <h2>Feedback</h2>
    <label class="field">
      <span>Sounds <small>(follow the ringer switch)</small></span>
      <input type="checkbox" switch bind:checked={settings.sound} onchange={() => saveSettings()} />
    </label>
    <label class="field">
      <span>Haptics <small>(iPhone, best effort)</small></span>
      <input type="checkbox" switch bind:checked={settings.haptics} onchange={() => saveSettings()} />
    </label>
  </section>

  <section class="card">
    <h2>Backup</h2>
    <p class="muted">Your data lives only on this phone. Save a backup to Files or iCloud Drive now and then.</p>
    <p class="status">{backupAge}{persisted === false ? ' · storage not yet marked persistent' : ''}</p>
    <div class="buttons">
      <button class="primary" onclick={doExport}>Export backup</button>
      <button class="chip" onclick={() => fileInput.click()}>Restore from file</button>
    </div>
    <input bind:this={fileInput} class="visually-hidden" type="file" accept="application/json,.json" onchange={doImport} />
    {#if message}<p class="status" role="status">{message}</p>{/if}
  </section>

  <p class="muted version">Tracker v{__APP_VERSION__}</p>
</main>

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  h2 {
    margin: 0 0 6px;
    font-size: 15px;
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0 0 8px;
    line-height: 1.4;
  }
  .field {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    min-height: 48px;
    border-top: 1px solid var(--line-soft);
  }
  small {
    color: var(--muted);
    font-size: 12px;
  }
  input[type='number'] {
    width: 88px;
    height: 40px;
    border-radius: 10px;
    border: 1px solid var(--line);
    background: var(--raised);
    color: var(--text);
    text-align: center;
  }
  input[type='checkbox'] {
    accent-color: var(--accent);
    width: 44px;
    height: 26px;
  }
  .status {
    font-size: 14px;
    margin: 0 0 12px;
  }
  .buttons {
    display: flex;
    gap: 10px;
  }
  .buttons > * {
    flex: 1;
  }
  .version {
    text-align: center;
  }
</style>
