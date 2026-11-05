<script lang="ts">
  import { untrack } from 'svelte';
  import Sheet from '../../components/Sheet.svelte';
  import { saveAlbum, deleteAlbum } from '../../lib/albums/store';
  import { tier } from '../../lib/albums/score';
  import { haptic, clickSound } from '../../lib/feedback';
  import type { AlbumEntry } from '../../lib/db';
  import { artAt, type AlbumResult } from '../../lib/albums/search';

  let {
    entry,
    found,
    today,
    onsaved,
    onclose,
  }: {
    /** Editing an existing log. */
    entry?: AlbumEntry;
    /** Or creating from a search result (or manual entry when neither is set). */
    found?: AlbumResult;
    today: string;
    onsaved: (score: number, isNew: boolean, day: string) => void;
    onclose: () => void;
  } = $props();

  const init = untrack(() => entry ?? found);
  const isNew = untrack(() => !entry);
  let title = $state(init?.title ?? '');
  let artist = $state(init?.artist ?? '');
  let score = $state(untrack(() => entry?.score ?? 75));
  let notes = $state(untrack(() => entry?.notes ?? ''));
  let day = $state(untrack(() => entry?.day ?? today));
  const artworkUrl = init?.artworkUrl;
  const manual = !init;

  const t = $derived(tier(score));
  let lastTier = untrack(() => tier(score).label);

  function setScore(v: number) {
    score = Math.min(100, Math.max(0, Math.round(v)));
    // A tap of feedback each time you cross into a new tier.
    const label = tier(score).label;
    if (label !== lastTier) {
      lastTier = label;
      haptic();
      clickSound();
    }
  }

  async function save() {
    if (!title.trim() || !artist.trim()) return;
    await saveAlbum({
      id: entry?.id,
      day,
      title: title.trim(),
      artist: artist.trim(),
      year: entry?.year ?? found?.year,
      genre: entry?.genre ?? found?.genre,
      artworkUrl,
      itunesId: entry?.itunesId,
      source: entry?.source ?? found?.source,
      sourceId: entry?.sourceId ?? found?.sourceId,
      score,
      notes: notes.trim(),
    });
    onsaved(score, isNew, day);
  }

  async function remove() {
    if (entry && confirm(`Delete ${entry.title}?`)) {
      await deleteAlbum(entry.id);
      onclose();
    }
  }
</script>

<Sheet title={isNew ? 'Rate it' : 'Edit album'} {onclose}>
  <div class="album">
    {#if artworkUrl}
      <img src={artAt(artworkUrl, 300)} alt="" class="cover" />
    {:else}
      <div class="cover blank" aria-hidden="true">♪</div>
    {/if}
    {#if manual}
      <div class="manual">
        <input class="text" bind:value={title} placeholder="Album" aria-label="Album title" />
        <input class="text" bind:value={artist} placeholder="Artist" aria-label="Artist" />
      </div>
    {:else}
      <div class="meta">
        <span class="name">{title}</span>
        <span class="muted">{artist}{init?.year ? ` · ${init.year}` : ''}</span>
      </div>
    {/if}
  </div>

  <div class="score-box">
    <div class="score-read">
      <span class="score" style="--heat:{score / 100}">{score}</span>
      <span class="tier">{t.label}</span>
    </div>
    <input
      class="slider"
      type="range"
      min="0"
      max="100"
      step="1"
      value={score}
      oninput={(e) => setScore(Number(e.currentTarget.value))}
      aria-label="Score out of 100"
      style="--pct:{score}%"
    />
    <div class="nudges">
      <button class="chip" onclick={() => setScore(score - 5)}>−5</button>
      <button class="chip" onclick={() => setScore(score - 1)}>−1</button>
      <button class="chip" onclick={() => setScore(score + 1)}>+1</button>
      <button class="chip" onclick={() => setScore(score + 5)}>+5</button>
    </div>
  </div>

  <label class="field">
    <span class="label">Notes</span>
    <textarea class="text" rows="3" bind:value={notes} placeholder="Standout tracks, first impressions…"></textarea>
  </label>

  <label class="field">
    <span class="label">Listened on</span>
    <input class="text" type="date" bind:value={day} max={today} />
  </label>

  <button class="primary" onclick={save} disabled={!title.trim() || !artist.trim()}>{isNew ? 'Log album' : 'Save'}</button>
  {#if entry}<button class="chip" onclick={remove}>Delete</button>{/if}
</Sheet>

<style>
  .album {
    display: flex;
    gap: 14px;
    align-items: center;
  }
  .cover {
    width: 96px;
    height: 96px;
    border-radius: 12px;
    object-fit: cover;
    flex-shrink: 0;
    box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
  }
  .blank {
    display: grid;
    place-items: center;
    background: var(--raised);
    color: var(--muted);
    font-size: 36px;
  }
  .meta,
  .manual {
    display: flex;
    flex-direction: column;
    gap: 6px;
    min-width: 0;
    flex: 1;
  }
  .name {
    font-family: var(--display);
    font-size: 20px;
    font-weight: 800;
    line-height: 1.15;
  }
  .muted {
    color: var(--muted);
    font-size: 14px;
  }
  .score-box {
    display: flex;
    flex-direction: column;
    gap: 12px;
    padding: 16px;
    border-radius: 18px;
    background: #120e0b;
    border: 1px solid var(--line-soft);
  }
  .score-read {
    display: flex;
    align-items: baseline;
    justify-content: center;
    gap: 12px;
  }
  .score {
    font-family: var(--display);
    font-size: 76px;
    font-weight: 800;
    line-height: 1;
    font-variant-numeric: tabular-nums;
    /* Warmer as the score climbs. */
    color: color-mix(in srgb, var(--accent) calc(var(--heat) * 100%), var(--text));
  }
  .tier {
    font-size: 18px;
    font-weight: 700;
    color: var(--accent-soft);
  }
  .slider {
    -webkit-appearance: none;
    appearance: none;
    width: 100%;
    height: 12px;
    border-radius: 6px;
    background: linear-gradient(to right, var(--accent) var(--pct), var(--line) var(--pct));
  }
  .slider::-webkit-slider-thumb {
    -webkit-appearance: none;
    width: 32px;
    height: 32px;
    border-radius: 50%;
    background: var(--text);
    border: 4px solid var(--accent);
  }
  .slider::-moz-range-thumb {
    width: 26px;
    height: 26px;
    border-radius: 50%;
    background: var(--text);
    border: 4px solid var(--accent);
  }
  .nudges {
    display: grid;
    grid-template-columns: repeat(4, minmax(0, 1fr));
    gap: 6px;
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
    height: 46px;
  }
</style>
