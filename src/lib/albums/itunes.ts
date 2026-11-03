// Apple's iTunes Search API: free, no key, works from the browser (CORS enabled).
// Roughly 20 requests a minute, so callers debounce.

export interface AlbumResult {
  itunesId: number;
  title: string;
  artist: string;
  year?: number;
  genre?: string;
  artworkUrl?: string;
}

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

export async function searchAlbums(term: string, signal?: AbortSignal): Promise<AlbumResult[]> {
  const q = term.trim();
  if (q.length < 2) return [];
  const params = new URLSearchParams({ term: q, entity: 'album', media: 'music', limit: '50' });
  const res = await fetch(`https://itunes.apple.com/search?${params}`, { signal });
  if (!res.ok) throw new Error(`Search failed (${res.status})`);
  const body = (await res.json()) as { results: ItunesAlbum[] };
  // Album a day: hide singles, list full albums before EPs, keep Apple's relevance order otherwise.
  const albumsFirst = body.results.filter((r) => !isSingle(r)).sort((a, b) => Number(isEP(a)) - Number(isEP(b)));
  return albumsFirst.slice(0, 25).map((r) => ({
    itunesId: r.collectionId,
    title: r.collectionName,
    artist: r.artistName,
    year: r.releaseDate ? Number(r.releaseDate.slice(0, 4)) : undefined,
    genre: r.primaryGenreName,
    // Swap the 100px thumbnail for a 600px cover.
    artworkUrl: r.artworkUrl100?.replace('100x100bb', '600x600bb'),
  }));
}
