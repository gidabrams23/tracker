import confetti from 'canvas-confetti';
import { settings } from './settings.svelte';

// --- Haptics -------------------------------------------------------------
// iOS Safari has no Vibration API. Clicking the label of a hidden
// <input type="checkbox" switch> makes iOS 18+ play its switch haptic.
// Undocumented, so it's a bonus: everything still works if it stops.
let hapticLabel: HTMLLabelElement | null = null;

function ensureHapticSwitch(): HTMLLabelElement {
  if (hapticLabel) return hapticLabel;
  const input = document.createElement('input');
  input.type = 'checkbox';
  input.setAttribute('switch', '');
  input.id = 'haptic-switch';
  const label = document.createElement('label');
  label.htmlFor = input.id;
  label.setAttribute('aria-hidden', 'true');
  for (const el of [input, label]) {
    el.style.cssText = 'position:fixed;left:-9999px;width:1px;height:1px;opacity:0;pointer-events:none;';
    document.body.appendChild(el);
  }
  hapticLabel = label;
  return label;
}

export function haptic(): void {
  if (!settings.haptics) return;
  if ('vibrate' in navigator) {
    navigator.vibrate(10);
    return;
  }
  ensureHapticSwitch().click();
}

// --- Sound ---------------------------------------------------------------
let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  if (!settings.sound) return null;
  if (!ctx) {
    // 'ambient' makes Web Audio respect the ringer switch on iOS 17+.
    const session = (navigator as Navigator & { audioSession?: { type: string } }).audioSession;
    if (session) session.type = 'ambient';
    ctx = new AudioContext();
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

function blip(freq: number, start: number, dur: number, gain = 0.08): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + start;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = 'triangle';
  osc.frequency.setValueAtTime(freq, t);
  g.gain.setValueAtTime(gain, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur);
}

export function clickSound(): void {
  blip(880, 0, 0.05, 0.06);
}

export function saveSound(): void {
  blip(660, 0, 0.08);
  blip(990, 0.07, 0.12);
}

/** Climbs a major scale with each set of the day, so later sets sound like progress. */
export function setChime(setNumber: number): void {
  const scale = [0, 2, 4, 5, 7, 9, 11];
  const i = Math.max(0, setNumber - 1);
  const semis = scale[i % 7] + 12 * Math.floor(i / 7);
  const base = 523.25 * Math.pow(2, Math.min(semis, 24) / 12);
  blip(base, 0, 0.09, 0.08);
  blip(base * 1.5, 0.06, 0.16, 0.06);
}

export function goalSound(): void {
  [523, 659, 784, 1047].forEach((f, i) => blip(f, i * 0.09, 0.22, 0.09));
}

// --- Celebration ---------------------------------------------------------
export function celebrate(): void {
  void confetti({
    particleCount: 140,
    spread: 80,
    origin: { y: 0.35 },
    colors: ['#FF6A13', '#FFA53D', '#FFD3B0', '#C9500A'],
    disableForReducedMotion: true,
  });
}
