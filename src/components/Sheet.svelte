<script lang="ts">
  import type { Snippet } from 'svelte';
  import { fade, fly } from 'svelte/transition';

  let { title, onclose, children }: { title: string; onclose: () => void; children: Snippet } = $props();
</script>

<div class="backdrop" transition:fade={{ duration: 150 }}>
  <button class="scrim" onclick={onclose} aria-label="Close"></button>
  <div class="sheet" role="dialog" aria-modal="true" aria-label={title} transition:fly={{ y: 300, duration: 220 }}>
    <div class="head">
      <h2>{title}</h2>
      <button class="icon-btn" onclick={onclose} aria-label="Close">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18" /></svg>
      </button>
    </div>
    <div class="body">{@render children()}</div>
  </div>
</div>

<style>
  .backdrop {
    position: fixed;
    inset: 0;
    z-index: 50;
    display: flex;
    flex-direction: column;
    justify-content: flex-end;
  }
  .scrim {
    position: absolute;
    inset: 0;
    border: none;
    background: rgba(0, 0, 0, 0.6);
  }
  .sheet {
    position: relative;
    max-width: 480px;
    width: 100%;
    margin: 0 auto;
    max-height: 85dvh;
    display: flex;
    flex-direction: column;
    background: var(--card);
    border-radius: 24px 24px 0 0;
    border-top: 1px solid var(--line);
    padding: 16px 18px calc(env(safe-area-inset-bottom) + 18px);
  }
  .head {
    display: flex;
    align-items: center;
    justify-content: space-between;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-family: var(--display);
    font-size: 22px;
    font-weight: 800;
  }
  .body {
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
</style>
