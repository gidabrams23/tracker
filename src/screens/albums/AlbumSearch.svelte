<script lang="ts">
  import { onMount } from 'svelte';
  import Sheet from '../../components/Sheet.svelte';
  import { searchAlbums, type AlbumResult } from '../../lib/albums/itunes';

  let { onpick, onmanual, onclose }: { onpick: (a: AlbumResult) => void; onmanual: () => void; onclose: () => void } = $props();

  let term = $state('');
  let results: AlbumResult[] = $state([]);
  let status: 'idle' | 'loading' | 'error' | 'empty' = $state('idle');
  let input: HTMLInputElement;
  let timer: ReturnType<typeof setTimeout> | undefined;
  let controller: AbortController | undefined;

  onMount(() => input.focus());

  // Debounced: the API allows roughly 20 searches a minute.
  function onInput() {
    clearTimeout(timer);
    timer = setTimeout(run, 400);
  }

  async function run() {
    controller?.abort();
    if (term.trim().length < 2) {
      results = [];
      status = 'idle';
      return;
    }
    controller = new AbortController();
    status = 'loading';
    try {
      results = await searchAlbums(term, controller.signal);
      status = results.length ? 'idle' : 'empty';
    } catch (e) {
      if ((e as DOMException).name !== 'AbortError') status = 'error';
    }
  }
</script>

<Sheet title="Log an album" {onclose}>
  <input
    bind:this={input}
    class="search"
    type="search"
    placeholder="Album or artist"
    bind:value={term}
    oninput={onInput}
    autocomplete="off"
    aria-label="Search albums"
  />

  {#if status === 'loading'}
    <p class="muted">Searching…</p>
  {:else if status === 'error'}
    <p class="muted">Search isn't reachable right now. You can enter it manually.</p>
  {:else if status === 'empty'}
    <p class="muted">No albums found.</p>
  {/if}

  <div class="results">
    {#each results as r (r.itunesId)}
      <button class="result" onclick={() => onpick(r)}>
        {#if r.artworkUrl}<img src={r.artworkUrl.replace('600x600bb', '120x120bb')} alt="" loading="lazy" />{/if}
        <span class="text">
          <span class="title">{r.title}</span>
          <span class="muted">{r.artist}{r.year ? ` · ${r.year}` : ''}</span>
        </span>
      </button>
    {/each}
  </div>

  <button class="link" onclick={onmanual}>Can't find it? Enter it manually</button>
</Sheet>

<style>
  .search {
    height: 52px;
    border-radius: 14px;
    border: 1px solid var(--line);
    background: #120e0b;
    color: var(--text);
    padding: 0 14px;
    font-size: 17px;
  }
  .search:focus {
    outline: none;
    border-color: var(--accent);
  }
  .results {
    display: flex;
    flex-direction: column;
  }
  .result {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 8px 0;
    border: none;
    border-top: 1px solid var(--line-soft);
    background: transparent;
    text-align: left;
  }
  .result img {
    width: 56px;
    height: 56px;
    border-radius: 8px;
    flex-shrink: 0;
  }
  .text {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .title {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
    margin: 0;
  }
  .link {
    border: none;
    background: transparent;
    color: var(--accent);
    font-weight: 600;
    padding: 10px;
  }
</style>
