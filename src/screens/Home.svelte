<script lang="ts">
  import { fly } from 'svelte/transition';
  import { backOut } from 'svelte/easing';
  import Ring from '../components/Ring.svelte';
  import { allSets, totalsByDay } from '../lib/pushups';
  import { computeStreak } from '../lib/streak';
  import { goalFor, settings } from '../lib/settings.svelte';
  import { addDays, parseDay, weekday, weekStart, WEEKDAY_NAMES, WEEKDAY_SHORT } from '../lib/day';
  import { sessions } from '../lib/workouts/store';
  import { albums } from '../lib/albums/store';
  import { runs } from '../lib/running/store';
  import { thisWeekCount } from '../lib/albums/score';
  import { formatMiles, totals as runTotals } from '../lib/running/stats';
  import { haptic } from '../lib/feedback';
  import type { Go, Screen } from '../lib/nav';

  let { today, go }: { today: string; go: Go } = $props();

  const dayGoal = (d: string) => goalFor(weekday(d));
  const pushTotals = $derived(totalsByDay($allSets ?? []));
  const pushups = $derived(pushTotals.get(today) ?? 0);
  const pushGoal = $derived(dayGoal(today));
  const streak = $derived(computeStreak(pushTotals, dayGoal, today));

  const allSessions = $derived($sessions ?? []);
  const active = $derived(allSessions.find((s) => !s.endedAt));
  const lastWorkout = $derived(allSessions.find((s) => s.endedAt));

  const allAlbums = $derived($albums ?? []);
  const albumWeek = $derived(thisWeekCount(allAlbums, today));
  const covers = $derived(
    [...allAlbums]
      .reverse()
      .filter((a) => a.artworkUrl)
      .slice(0, 3)
      .map((a) => a.artworkUrl!.replace('600x600bb', '200x200bb')),
  );

  const allRuns = $derived($runs ?? []);
  const miles = $derived(runTotals(allRuns, today));

  const week = $derived(Array.from({ length: 7 }, (_, i) => addDays(weekStart(today), i)));
  const runSpark = $derived(week.map((d) => allRuns.filter((r) => r.day === d).reduce((a, r) => a + r.miles, 0)));
  const sparkMax = $derived(Math.max(1, ...runSpark));

  // The week's chain: one row per habit, one dot per day.
  const chain = $derived([
    { key: 'pushups' as Screen, label: 'Push-ups', done: (d: string) => dayGoal(d) > 0 && (pushTotals.get(d) ?? 0) >= dayGoal(d) },
    { key: 'workouts' as Screen, label: 'Lift', done: (d: string) => allSessions.some((s) => s.day === d && s.endedAt) },
    { key: 'albums' as Screen, label: 'Album', done: (d: string) => allAlbums.some((a) => a.day === d) },
    { key: 'running' as Screen, label: 'Run', done: (d: string) => allRuns.some((r) => r.day === d) },
  ]);
  const doneToday = $derived(chain.filter((c) => c.done(today)).length);

  const greeting = $derived.by(() => {
    const h = new Date().getHours();
    return h < 12 ? 'Good morning' : h < 17 ? 'Good afternoon' : 'Good evening';
  });

  const workoutLine = $derived.by(() => {
    if (active) return 'In progress';
    if (!lastWorkout) return 'Biceps & Back';
    const days = Math.round((parseDay(today).getTime() - parseDay(lastWorkout.day).getTime()) / 86_400_000);
    return days === 0 ? 'Done today' : days === 1 ? 'Last: yesterday' : `Last: ${days} days ago`;
  });

  // Respect iOS "Reduce Motion" for the tile entrance.
  const reduced = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const enter = (delay: number) => ({ y: 30, duration: reduced ? 0 : 450, delay: reduced ? 0 : delay, easing: backOut });

  function open(s: Screen) {
    haptic();
    go(s);
  }
</script>

<main class="screen">
  <header class="top">
    <div>
      <span class="label">{WEEKDAY_NAMES[weekday(today)]} Â· {parseDay(today).toLocaleDateString([], { month: 'long', day: 'numeric' })}</span>
      <h1 class="title">{greeting}</h1>
    </div>
    <button class="icon-btn" onclick={() => go('settings')} aria-label="Settings">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 6h10M18 6h2M4 12h4M12 12h8M4 18h12" /><circle cx="16" cy="6" r="2" /><circle cx="10" cy="12" r="2" /><circle cx="18" cy="18" r="2" /></svg>
    </button>
  </header>

  <div class="grid">
    <button class="tile t-push" aria-label="Push-ups: {pushups} of {pushGoal}" onclick={() => open('pushups')} in:fly={enter(0)}>
      <div class="visual">
        <Ring pct={pushGoal > 0 ? pushups / pushGoal : 1} size={86} stroke={10}>
          <span class="ring-num">{pushups}</span>
        </Ring>
      </div>
      <span class="name">Push-ups</span>
      <span class="sub">{pushGoal > 0 ? (pushups >= pushGoal ? 'Goal hit' : `${pushGoal - pushups} to go`) : 'Rest day'} Â· {streak.current}d streak</span>
    </button>

    <button class="tile t-lift" class:live={!!active} aria-label="Workouts: {workoutLine}" onclick={() => open('workouts')} in:fly={enter(60)}>
      <div class="visual">
        <span class="badge">
          <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 7v10M3 9v6M18 7v10M21 9v6M6 12h12" /></svg>
        </span>
        {#if active}<span class="pulse" aria-hidden="true"></span>{/if}
      </div>
      <span class="name">Workouts</span>
      <span class="sub">{workoutLine}</span>
    </button>

    <button class="tile t-album" aria-label="Albums: {albumWeek} of {settings.albumsPerWeek} this week" onclick={() => open('albums')} in:fly={enter(120)}>
      <div class="visual">
        {#if covers.length}
          <div class="fan">
            {#each [...covers].reverse() as src, i (src + i)}
              <img {src} alt="" style="--r:{(i - (covers.length - 1) / 2) * 9}deg; --x:{(i - (covers.length - 1) / 2) * 18}px" />
            {/each}
          </div>
        {:else}
          <span class="vinyl" aria-hidden="true"></span>
        {/if}
      </div>
      <span class="name">Albums</span>
      <span class="sub">
        {#each Array(settings.albumsPerWeek) as _, i (i)}<span class="dot" class:on={i < albumWeek}></span>{/each}
        {albumWeek}/{settings.albumsPerWeek} this week
      </span>
    </button>

    <button class="tile t-run" aria-label="Running: {formatMiles(miles.week)} miles this week" onclick={() => open('running')} in:fly={enter(180)}>
      <div class="visual run-visual">
        <span class="miles">{formatMiles(miles.week)}<small>mi</small></span>
        <span class="spark" aria-hidden="true">
          {#each runSpark as v, i (i)}
            <span class="spark-bar" class:today={week[i] === today} style="height:{Math.max(3, (v / sparkMax) * 26)}px"></span>
          {/each}
        </span>
      </div>
      <span class="name">Running</span>
      <span class="sub">{formatMiles(miles.month)} mi this month</span>
    </button>
  </div>

  <section class="card chain" in:fly={enter(240)}>
    <div class="chain-head">
      <h2>This week</h2>
      <span class="muted">{doneToday} of 4 today</span>
    </div>
    <div class="chain-grid">
      <span></span>
      {#each week as d (d)}
        <span class="day" class:is-today={d === today}>{WEEKDAY_SHORT[weekday(d)]}</span>
      {/each}
      {#each chain as row (row.key)}
        <button class="row-label" onclick={() => open(row.key)}>{row.label}</button>
        {#each week as d (d)}
          <span class="link" class:on={d <= today && row.done(d)} class:future={d > today} class:is-today={d === today}></span>
        {/each}
      {/each}
    </div>
  </section>
</main>

<style>
  .top {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .grid {
    display: grid;
    grid-template-columns: repeat(2, minmax(0, 1fr));
    gap: 14px;
  }
  .tile {
    position: relative;
    min-height: 190px;
    padding: 16px;
    border-radius: 26px;
    border: 1px solid var(--line-soft);
    background: var(--card);
    box-shadow: 0 6px 0 #0d0a08;
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    text-align: left;
    overflow: hidden;
    transition:
      transform 0.1s ease,
      box-shadow 0.1s ease;
  }
  .tile:active {
    transform: translateY(5px);
    box-shadow: 0 1px 0 #0d0a08;
  }
  /* A warm glow in each tile's corner, a different shade per module. */
  .tile::before {
    content: '';
    position: absolute;
    right: -40px;
    top: -40px;
    width: 140px;
    height: 140px;
    border-radius: 50%;
    background: var(--tint);
    opacity: 0.14;
    filter: blur(20px);
    pointer-events: none;
  }
  .t-push {
    --tint: #ff6a13;
  }
  .t-lift {
    --tint: #ffa53d;
  }
  .t-album {
    --tint: #ff7e5f;
  }
  .t-run {
    --tint: #ffc46b;
  }
  .live {
    border-color: var(--accent);
  }
  .visual {
    position: relative;
    height: 96px;
    width: 100%;
    display: flex;
    align-items: center;
    margin-bottom: auto;
  }
  .ring-num {
    font-family: var(--display);
    font-size: 26px;
    font-weight: 800;
  }
  .badge {
    width: 72px;
    height: 72px;
    border-radius: 22px;
    display: grid;
    place-items: center;
    background: var(--tint);
    color: var(--on-accent);
    box-shadow: 0 5px 0 #8a4a1f;
  }
  .pulse {
    position: absolute;
    left: 62px;
    top: 14px;
    width: 14px;
    height: 14px;
    border-radius: 50%;
    background: var(--accent);
    box-shadow: 0 0 0 0 rgba(255, 106, 19, 0.6);
    animation: pulse 1.6s infinite;
  }
  @keyframes pulse {
    to {
      box-shadow: 0 0 0 12px rgba(255, 106, 19, 0);
    }
  }
  .fan {
    position: relative;
    width: 100%;
    height: 80px;
  }
  .fan img {
    position: absolute;
    left: calc(50% - 36px);
    top: 4px;
    width: 72px;
    height: 72px;
    border-radius: 8px;
    object-fit: cover;
    box-shadow: 0 6px 14px rgba(0, 0, 0, 0.55);
    transform: translateX(var(--x)) rotate(var(--r));
  }
  .vinyl {
    width: 80px;
    height: 80px;
    border-radius: 50%;
    background:
      radial-gradient(circle, var(--tint) 0 14px, #000 15px 17px, transparent 18px),
      repeating-radial-gradient(circle, #1a1a1a 0 2px, #0b0b0b 2px 4px);
    box-shadow: 0 0 0 3px #000;
  }
  .run-visual {
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 8px;
  }
  .miles {
    font-family: var(--display);
    font-size: 40px;
    font-weight: 800;
    line-height: 1;
  }
  .miles small {
    font-size: 15px;
    color: var(--muted);
    margin-left: 3px;
  }
  .spark {
    display: flex;
    align-items: flex-end;
    gap: 4px;
    height: 26px;
  }
  .spark-bar {
    width: 10px;
    border-radius: 3px;
    background: #8a5a20;
  }
  .spark-bar.today {
    background: var(--tint);
  }
  .name {
    font-family: var(--display);
    font-size: 21px;
    font-weight: 800;
  }
  .sub {
    display: flex;
    align-items: center;
    gap: 4px;
    font-size: 13px;
    color: var(--muted);
  }
  .dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    border: 1.5px solid var(--line);
  }
  .dot.on {
    background: var(--tint);
    border-color: var(--tint);
  }
  .chain-head {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    margin-bottom: 12px;
  }
  h2 {
    margin: 0;
    font-size: 15px;
    font-weight: 600;
  }
  .muted {
    color: var(--muted);
    font-size: 13px;
  }
  .chain-grid {
    display: grid;
    grid-template-columns: 72px repeat(7, minmax(0, 1fr));
    gap: 8px 4px;
    align-items: center;
    justify-items: center;
  }
  .day {
    font-size: 11px;
    color: var(--muted);
    font-weight: 600;
  }
  .day.is-today {
    color: var(--accent);
  }
  .row-label {
    justify-self: start;
    border: none;
    background: transparent;
    padding: 0;
    font-size: 13px;
    font-weight: 600;
    color: var(--text);
  }
  .link {
    width: 22px;
    height: 22px;
    border-radius: 7px;
    background: #2a221b;
  }
  .link.on {
    background: var(--accent);
    box-shadow: 0 2px 0 var(--accent-deep);
  }
  .link.future {
    background: transparent;
    border: 1px dashed var(--line);
  }
  .link.is-today:not(.on) {
    outline: 2px solid var(--accent-past);
  }
</style>
