<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import AlbumSearch from './AlbumSearch.svelte';
  import AlbumEditor from './AlbumEditor.svelte';
  import { albums } from '../../lib/albums/store';
  import { thisWeekCount, tier, weekStreak } from '../../lib/albums/score';
  import { settings } from '../../lib/settings.svelte';
  import { shortDate, weekday, weekStart, WEEKDAY_NAMES } from '../../lib/day';
  import { celebrate, goalSound, setChime } from '../../lib/feedback';
  import type { AlbumEntry } from '../../lib/db';
  import { artAt, type AlbumResult } from '../../lib/albums/search';
  import type { Go } from '../../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  type Flow = { step: 'search' } | { step: 'rate'; found?: AlbumResult } | { step: 'edit'; entry: AlbumEntry } | null;
  let flow: Flow = $state(null);
  let view: 'wall' | 'ranked' = $state('wall');
  let toast: string | null = $state(null);

  const all = $derived($albums ?? []);
  const goal = $derived(settings.albumsPerWeek);
  const weekCount = $derived(thisWeekCount(all, today));
  const streak = $derived(weekStreak(all, today, goal));
  const thisWeek = $derived(all.filter((a) => a.day >= weekStart(today) && a.day <= today));
  const slots = $derived(Array.from({ length: Math.max(goal, weekCount) }, (_, i) => thisWeek[i] ?? null));
  const wall = $derived([...all].reverse());
  const ranked = $derived([...all].sort((a, b) => b.score - a.score || b.day.localeCompare(a.day)));
  const year = $derived(all.filter((a) => a.day.startsWith(today.slice(0, 4))));
  const avg = $derived(all.length ? Math.round(all.reduce((s, a) => s + a.score, 0) / all.length) : 0);

  const daysLeft = $derived(7 - ((weekday(today) + 6) % 7));
  const caption = $derived.by(() => {
    if (weekCount >= goal) return weekCount > goal ? `Goal hit, plus ${weekCount - goal} bonus` : 'Weekly goal hit';
    const left = goal - weekCount;
    return `${left} more by Sunday · ${daysLeft} ${daysLeft === 1 ? 'day' : 'days'} left`;
  });

  function saved(score: number, isNew: boolean, day: string) {
    flow = null;
    if (!isNew) return;
    // weekCount hasn't refreshed yet, so this is the count before the save. Backdated logs don't count.
    if (day >= weekStart(today) && weekCount + 1 === goal) {
      celebrate();
      goalSound();
      toast = `${goal} for ${goal}. Week done.`;
    } else {
      setChime(weekCount + 1);
      toast = `Logged · ${score} ${tier(score).label}`;
    }
    setTimeout(() => (toast = null), 2400);
  }
</script>

<main class="screen">
  <header class="top">
    <button class="icon-btn" onclick={() => go('home')} aria-label="Home">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6" /></svg>
    </button>
    <div class="head-text">
      <span class="label">{WEEKDAY_NAMES[weekday(today)]}</span>
      <h1 class="title">Album a day</h1>
    </div>
  </header>

  <section class="card hero">
    <div class="hero-head">
      <div>
        <span class="label">This week</span>
        <div class="count"><span class="num">{weekCount}</span><span class="of">/ {goal}</span></div>
      </div>
      {#if streak > 0}
        <span class="streak">{streak} {streak === 1 ? 'week' : 'weeks'} in a row</span>
      {/if}
    </div>

    <div class="records">
      {#each slots as a, i (a?.id ?? `empty-${i}`)}
        {#if a}
          <button class="record" onclick={() => (flow = { step: 'edit', entry: a })} in:fly={{ y: -40, duration: 500, easing: backOut }} aria-label="{a.title}, {a.score}">
            <span class="vinyl">
              {#if a.artworkUrl}<img src={artAt(a.artworkUrl, 200)} alt="" />{/if}
            </span>
            <span class="rec-score">{a.score}</span>
          </button>
        {:else}
          <button class="record empty" onclick={() => (flow = { step: 'search' })} aria-label="Log an album">
            <span class="vinyl"><span class="plus">+</span></span>
          </button>
        {/if}
      {/each}
    </div>
    <p class="caption">{caption}</p>

    <button class="press" onclick={() => (flow = { step: 'search' })}>Log an album</button>
  </section>

  <div class="stats">
    <div class="card stat"><span class="stat-num">{year.length}</span><span class="muted">this year</span></div>
    <div class="card stat"><span class="stat-num">{all.length}</span><span class="muted">all time</span></div>
    <div class="card stat"><span class="stat-num">{avg || '—'}</span><span class="muted">avg score</span></div>
  </div>

  {#if all.length}
    <div class="tabs" role="tablist">
      <button role="tab" aria-selected={view === 'wall'} class:on={view === 'wall'} onclick={() => (view = 'wall')}>Wall</button>
      <button role="tab" aria-selected={view === 'ranked'} class:on={view === 'ranked'} onclick={() => (view = 'ranked')}>Ranked</button>
    </div>

    {#if view === 'wall'}
      <div class="wall">
        {#each wall as a (a.id)}
          <button class="tile" onclick={() => (flow = { step: 'edit', entry: a })} aria-label="{a.title} by {a.artist}, {a.score}">
            {#if a.artworkUrl}
              <img src={artAt(a.artworkUrl, 300)} alt="" loading="lazy" />
            {:else}
              <span class="tile-blank">{a.title}</span>
            {/if}
            <span class="badge">{a.score}</span>
          </button>
        {/each}
      </div>
    {:else}
      <section class="card ranked">
        {#each ranked as a, i (a.id)}
          <button class="rank-row" onclick={() => (flow = { step: 'edit', entry: a })}>
            <span class="rank">{i + 1}</span>
            {#if a.artworkUrl}<img src={artAt(a.artworkUrl, 120)} alt="" loading="lazy" />{:else}<span class="thumb-blank"></span>{/if}
            <span class="rank-text">
              <span class="rank-title">{a.title}</span>
              <span class="muted">{a.artist} · {shortDate(a.day)}</span>
            </span>
            <span class="rank-score">{a.score}</span>
          </button>
        {/each}
      </section>
    {/if}
  {:else}
    <p class="muted center">Your record wall starts with the first album.</p>
  {/if}
</main>

{#if flow?.step === 'search'}
  <AlbumSearch onpick={(found) => (flow = { step: 'rate', found })} onmanual={() => (flow = { step: 'rate' })} onclose={() => (flow = null)} />
{:else if flow?.step === 'rate'}
  <AlbumEditor found={flow.found} {today} onsaved={saved} onclose={() => (flow = null)} />
{:else if flow?.step === 'edit'}
  <AlbumEditor entry={flow.entry} {today} onsaved={saved} onclose={() => (flow = null)} />
{/if}

{#if toast}
  <div class="toast" role="status" transition:fly={{ y: -30, duration: 200 }}>{toast}</div>
{/if}

<style>
  .top {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .head-text {
    display: flex;
    flex-direction: column;
  }
  .hero {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }
  .hero-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .count {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .num {
    font-family: var(--display);
    font-size: 56px;
    font-weight: 800;
    line-height: 1;
  }
  .of {
    font-size: 22px;
    font-weight: 700;
    color: var(--muted);
  }
  .streak {
    padding: 8px 12px;
    border-radius: 999px;
    background: var(--raised);
    border: 1px solid var(--accent);
    font-size: 13px;
    font-weight: 600;
    color: var(--accent-soft);
  }
  .records {
    display: flex;
    justify-content: center;
    gap: 14px;
    flex-wrap: wrap;
  }
  .record {
    position: relative;
    border: none;
    background: transparent;
    padding: 0;
  }
  .vinyl {
    width: 92px;
    height: 92px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    background: repeating-radial-gradient(circle, #1a1a1a 0 2px, #0b0b0b 2px 4px);
    box-shadow:
      0 0 0 3px #000,
      0 8px 18px rgba(0, 0, 0, 0.5);
    animation: spin 6s linear infinite;
  }
  .vinyl img {
    width: 44px;
    height: 44px;
    border-radius: 50%;
    object-fit: cover;
    border: 2px solid #000;
  }
  .empty .vinyl {
    background: transparent;
    border: 2px dashed var(--line);
    box-shadow: none;
    animation: none;
  }
  .plus {
    font-size: 28px;
    color: var(--muted);
  }
  .rec-score {
    position: absolute;
    right: -4px;
    bottom: -2px;
    min-width: 32px;
    padding: 3px 6px;
    border-radius: 999px;
    background: var(--accent);
    color: var(--on-accent);
    font-size: 13px;
    font-weight: 800;
  }
  @keyframes spin {
    to {
      transform: rotate(360deg);
    }
  }
  @media (prefers-reduced-motion: reduce) {
    .vinyl {
      animation: none;
    }
  }
  .caption {
    margin: 0;
    text-align: center;
    font-size: 15px;
    font-weight: 600;
    color: var(--accent-soft);
  }
  .press {
    height: 64px;
    border-radius: 18px;
    border: none;
    background: var(--accent);
    color: var(--on-accent);
    box-shadow: 0 6px 0 var(--accent-deep);
    font-family: var(--display);
    font-size: 22px;
    font-weight: 800;
    transition:
      transform 0.08s ease,
      box-shadow 0.08s ease;
  }
  .press:active {
    transform: translateY(5px);
    box-shadow: 0 1px 0 var(--accent-deep);
  }
  .stats {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 10px;
  }
  .stat {
    display: flex;
    flex-direction: column;
    gap: 2px;
    padding: 14px;
  }
  .stat-num {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 800;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
    margin: 0;
  }
  .center {
    text-align: center;
  }
  .tabs {
    display: flex;
    gap: 8px;
  }
  .tabs button {
    flex: 1;
    height: 42px;
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
  .wall {
    display: grid;
    grid-template-columns: repeat(3, minmax(0, 1fr));
    gap: 6px;
  }
  .tile {
    position: relative;
    aspect-ratio: 1;
    padding: 0;
    border: none;
    border-radius: 10px;
    overflow: hidden;
    background: var(--raised);
  }
  .tile img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }
  .tile-blank {
    padding: 8px;
    font-size: 12px;
    font-weight: 700;
    display: block;
    text-align: left;
  }
  .badge {
    position: absolute;
    left: 6px;
    bottom: 6px;
    padding: 2px 7px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.75);
    color: #fff;
    font-size: 12px;
    font-weight: 800;
  }
  .ranked {
    padding-top: 4px;
    padding-bottom: 4px;
  }
  .rank-row {
    width: 100%;
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 0;
    border: none;
    border-top: 1px solid var(--line-soft);
    background: transparent;
    text-align: left;
  }
  .rank-row:first-child {
    border-top: none;
  }
  .rank {
    width: 24px;
    text-align: center;
    font-weight: 800;
    color: var(--muted);
  }
  .rank-row img,
  .thumb-blank {
    width: 48px;
    height: 48px;
    border-radius: 6px;
    flex-shrink: 0;
    background: var(--raised);
  }
  .rank-text {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
  }
  .rank-title {
    font-weight: 700;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .rank-score {
    font-family: var(--display);
    font-size: 24px;
    font-weight: 800;
    color: var(--accent);
  }
  .toast {
    position: fixed;
    top: calc(env(safe-area-inset-top) + 12px);
    left: 16px;
    right: 16px;
    max-width: 448px;
    margin: 0 auto;
    z-index: 60;
    padding: 12px 16px;
    border-radius: 14px;
    background: var(--accent);
    color: var(--on-accent);
    font-family: var(--display);
    font-size: 18px;
    font-weight: 800;
    text-align: center;
  }
</style>
