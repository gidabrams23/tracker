<script lang="ts">
  import { onMount } from 'svelte';
  import { registerSW } from 'virtual:pwa-register';
  import Pushups from './screens/Pushups.svelte';
  import FloorMode from './screens/FloorMode.svelte';
  import Settings from './screens/Settings.svelte';
  import Home from './screens/Home.svelte';
  import Workouts from './screens/workouts/Workouts.svelte';
  import { loadSettings } from './lib/settings.svelte';
  import { ensureTemplates } from './lib/workouts/store';
  import { dayKey } from './lib/day';
  import type { Screen } from './lib/nav';

  let screen: Screen = $state('home');
  let today = $state(dayKey());
  let ready = $state(false);
  let needRefresh = $state(false);
  let updateSW: ((reload?: boolean) => Promise<void>) | undefined;

  function go(next: Screen) {
    const swap = () => {
      screen = next;
      window.scrollTo(0, 0);
    };
    if (document.startViewTransition) document.startViewTransition(swap);
    else swap();
  }

  onMount(() => {
    Promise.all([loadSettings(), ensureTemplates()]).finally(() => (ready = true));
    void navigator.storage?.persist?.();
    updateSW = registerSW({ onNeedRefresh: () => (needRefresh = true) });

    // Roll over to a new day at midnight or when the app comes back from the background.
    const refreshDay = () => (today = dayKey());
    const timer = setInterval(refreshDay, 30_000);
    document.addEventListener('visibilitychange', refreshDay);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', refreshDay);
    };
  });
</script>

{#if ready}
  {#if screen === 'home'}
    <Home {today} {go} />
  {:else if screen === 'pushups'}
    <Pushups {today} {go} />
  {:else if screen === 'floor'}
    <FloorMode {today} {go} />
  {:else if screen === 'workouts'}
    <Workouts {today} {go} />
  {:else}
    <Settings {go} />
  {/if}
{/if}

{#if needRefresh}
  <div class="update" role="status">
    <span>New version ready</span>
    <button class="primary" onclick={() => updateSW?.(true)}>Reload</button>
  </div>
{/if}

<style>
  .update {
    position: fixed;
    left: 16px;
    right: 16px;
    bottom: calc(env(safe-area-inset-bottom) + 16px);
    max-width: 448px;
    margin: 0 auto;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 12px;
    padding: 10px 10px 10px 16px;
    border-radius: 16px;
    background: var(--raised);
    border: 1px solid var(--accent);
    font-weight: 600;
  }
  .update .primary {
    height: 44px;
    padding: 0 18px;
  }
</style>
