// Album search. Deezer first, Apple as a fallback.
//
// Why not Apple first: on an iPhone, itunes.apple.com/search answers every request with a
// 301 to a musics:// link (meant to open the Music app), so fetch() fails. Desktop browsers
// get JSON. Deezer works on both, but sends no CORS header, so it's called with JSONP
// (a <script> tag), which Deezer supports. Both are free and need no key.

export interface AlbumResult {
  source: 'deezer' | 'itunes';
  sourceId: string;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkUrl?: string;
}

// --- Deezer --------------------------------------------------------------

interface DeezerAlbum {
  id: number;
  title: string;
  cover_xl?: string;
  cover_big?: string;
  record_type?: string;
  nb_tracks?: number;
  artist?: { name: string };
}

let seq = 0;

function jsonp<T>(url: string, signal?: AbortSignal, timeoutMs = 8000): Promise<T> {
  return new Promise((resolve, reject) => {
    const name = `__albumSearch${seq++}`;
    const w = window as unknown as Record<string, unknown>;
    const script = document.createElement('script');
    const cleanup = () => {
      // Leave a no-op behind in case the script still loads after an abort.
      w[name] = () => {};
      script.remove();
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
    };
    const onAbort = () => {
      cleanup();
      reject(new DOMException('Aborted', 'AbortError'));
    };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error('Search timed out'));
    }, timeoutMs);
    w[name] = (data: T) => {
      cleanup();
      resolve(data);
    };
    script.onerror = () => {
      cleanup();
      reject(new Error('Search unavailable'));
    };
    signal?.addEventListener('abort', onAbort);
    script.src = `${url}&output=jsonp&callback=${name}`;
    document.head.appendChild(script);
  });
}

async function searchDeezer(q: string, signal?: AbortSignal): Promise<AlbumResult[]> {
  const body = await jsonp<{ data?: DeezerAlbum[]; error?: unknown }>(
    `https://api.deezer.com/search/album?q=${encodeURIComponent(q)}&limit=40`,
    signal,
  );
  if (body.error || !body.data) throw new Error('Search unavailable');
  const rank = (a: DeezerAlbum) => (a.record_type === 'album' ? 0 : a.record_type === 'ep' ? 1 : 2);
  return body.data
    .filter((a) => a.record_type !== 'single' && (a.nb_tracks ?? 99) > 3)
    .sort((a, b) => rank(a) - rank(b))
    .slice(0, 25)
    .map((a) => ({
      source: 'deezer' as const,
      sourceId: String(a.id),
      title: a.title,
      artist: a.artist?.name ?? '',
      artworkUrl: a.cover_xl ?? a.cover_big,
    }));
}

// --- Apple (desktop fallback) ---------------------------------------------

interface ItunesAlbum {
  collectionId: number;
  collectionName: string;
  artistName: string;
  releaseDate?: string;
  primaryGenreName?: string;
  artworkUrl100?: string;
  trackCount?: number;
}

const isSingle = (r: ItunesAlbum) => / - Single$/i.test(r.collectionName) || (r.trackCount ?? 99) <= 3;
const isEP = (r: ItunesAlbum) => / - EP$/i.test(r.collectionName);

async function searchItunes(q: string, signal?: AbortSignal): Promise<AlbumResult[]> {
  const params = new URLSearchParams({ term: q, entity: 'album', media: 'music', limit: '50' });
  const res = await fetch(`https://itunes.apple.com/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { results: ItunesAlbum[] };
  return body.results
    .filter((r) => !isSingle(r))
    .sort((a, b) => Number(isEP(a)) - Number(isEP(b)))
    .slice(0, 25)
    .map((r) => ({
      source: 'itunes' as const,
      sourceId: String(r.collectionId),
      title: r.collectionName,
      artist: r.artistName,
      year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : undefined,
      genre: r.primaryGenreName,
      artworkUrl: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
    }));
}

export async function searchAlbums(term: string, signal?: AbortSignal): Promise<AlbumResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  try {
    return await searchDeezer(q, signal);
  } catch (e) {
    if ((e as DOMException).name === 'AbortError') throw e;
    return searchItunes(q, signal);
  }
}

/** The same cover at a different size (Apple and Deezer both encode size in the URL). */
export function artAt(url: string | undefined, px: number): string | undefined {
  if (!url) return url;
  return url.replace(/\/\d+x\d+bb\./, `/${px}x${px}bb.`).replace(/\/\d+x\d+-000000-/, `/${px}x${px}-000000-`);
}
