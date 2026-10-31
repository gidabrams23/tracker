<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from '../../components/Sheet.svelte';
  import { EXERCISES, GROUP_LABEL, type Group } from '../../lib/workouts/exercises';

  let {
    current,
    group: initialGroup,
    onpick,
    onclose,
  }: { current?: string; group: Group; onpick: (id: string) => void; onclose: () => void } = $props();

  let group: Group = $state(untrack(() => initialGroup));
  const list = $derived(EXERCISES.filter((e) => e.group === group));
</script>

<Sheet title="Choose exercise" {onclose}>
  <div class="tabs" role="tablist">
    {#each Object.entries(GROUP_LABEL) as [g, label] (g)}
      <button role="tab" aria-selected={group === g} class:on={group === g} onclick={() => (group = g as Group)}>{label}</button>
    {/each}
  </div>
  <div class="list">
    {#each list as e (e.id)}
      <button class="item" class:current={e.id === current} onclick={() => onpick(e.id)}>
        <span class="name">{e.name}{#if e.why}<span class="tag">Try</span>{/if}</span>
        <span class="meta">{e.why ?? e.equipment}</span>
      </button>
    {/each}
  </div>
</Sheet>

<style>
  .tabs {
    display: flex;
    gap: 8px;
  }
  .tabs button {
    flex: 1;
    height: 40px;
    border-radius: 12px;
    border: 1px solid var(--line);
    background: transparent;
    color: var(--muted);
    font-weight: 600;
  }
  .tabs .on {
    background: var(--accent);
    border-color: var(--accent);
    color: var(--on-accent);
  }
  .list {
    display: flex;
    flex-direction: column;
  }
  .item {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    padding: 12px 4px;
    border: none;
    border-top: 1px solid var(--line-soft);
    background: transparent;
    text-align: left;
  }
  .item.current .name {
    color: var(--accent);
  }
  .name {
    font-size: 16px;
    font-weight: 600;
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .tag {
    font-size: 11px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 6px;
    background: #2b1a0d;
    color: var(--accent-soft);
    border: 1px solid var(--accent-past);
  }
  .meta {
    font-size: 13px;
    color: var(--muted);
    text-transform: capitalize;
  }
</style>
