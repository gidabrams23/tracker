// Keeps the screen on (Floor mode, later the rest timer). iOS 18.4+ in home-screen apps.
let sentinel: WakeLockSentinel | null = null;
let wanted = false;

async function acquire(): Promise<void> {
  if (!wanted || sentinel || !('wakeLock' in navigator)) return;
  try {
    sentinel = await navigator.wakeLock.request('screen');
    sentinel.addEventListener('release', () => (sentinel = null));
  } catch {
    // Denied (low battery mode, page hidden). Nothing else to do.
  }
}

function onVisibility(): void {
  if (document.visibilityState === 'visible') void acquire();
}

export function keepAwake(): () => void {
  wanted = true;
  void acquire();
  document.addEventListener('visibilitychange', onVisibility);
  return () => {
    wanted = false;
    document.removeEventListener('visibilitychange', onVisibility);
    void sentinel?.release();
    sentinel = null;
  };
}
