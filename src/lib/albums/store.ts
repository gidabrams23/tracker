import { liveQuery } from 'dexie';
import { db, type AlbumEntry } from '../db';

export const albums = liveQuery(() => db.albums.orderBy('day').toArray());

export async function saveAlbum(entry: Omit<AlbumEntry, 'id' | 'createdAt'> & { id?: string }): Promise<void> {
  const existing = entry.id ? await db.albums.get(entry.id) : undefined;
  await db.albums.put({
    ...entry,
    score: Math.round(Math.min(100, Math.max(0, entry.score))),
    id: entry.id ?? crypto.randomUUID(),
    createdAt: existing?.createdAt ?? Date.now(),
  });
}

export function deleteAlbum(id: string): Promise<void> {
  return db.albums.delete(id);
}
