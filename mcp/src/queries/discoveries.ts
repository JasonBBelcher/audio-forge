import { getDb } from '../db.js';

export interface Discovery {
  id: number;
  youtube_id: string;
  title: string;
  uploader: string | null;
  upload_date: string | null;
  duration: number | null;
  view_count: number | null;
  thumbnail_url: string | null;
  description: string | null;
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  genre: string | null;
  style: string | null;
  region: string | null;
  year: number | null;
  label: string | null;
  discovered_via: string;
  search_query: string | null;
  notes: string | null;
  is_favorite: boolean;
  listen_count: number;
  last_listened_at: string | null;
  asset_id: number | null;
  imported_at: string | null;
  created_at: string;
}

export function insertDiscovery(data: Partial<Discovery>): number {
  const stmt = getDb().prepare(`
    INSERT INTO discoveries (
      youtube_id, title, uploader, upload_date, duration, view_count,
      thumbnail_url, description, bpm, key, time_signature, genre, style,
      region, year, label, discovered_via, search_query, notes, is_favorite,
      listen_count, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);

  const result = stmt.run(
    data.youtube_id,
    data.title,
    data.uploader ?? null,
    data.upload_date ?? null,
    data.duration ?? null,
    data.view_count ?? null,
    data.thumbnail_url ?? null,
    data.description ?? null,
    data.bpm ?? null,
    data.key ?? null,
    data.time_signature ?? null,
    data.genre ?? null,
    data.style ?? null,
    data.region ?? null,
    data.year ?? null,
    data.label ?? null,
    data.discovered_via ?? 'random',
    data.search_query ?? null,
    data.notes ?? null,
    data.is_favorite ? 1 : 0,
    0
  );

  return result.lastInsertRowid as number;
}

export function getDiscoveryById(id: number): Discovery | undefined {
  return getDb().prepare('SELECT * FROM discoveries WHERE id = ?').get(id) as Discovery | undefined;
}

export function getDiscoveryByYoutubeId(youtubeId: string): Discovery | undefined {
  return getDb().prepare('SELECT * FROM discoveries WHERE youtube_id = ?').get(youtubeId) as Discovery | undefined;
}

export function listDiscoveries(limit: number = 100): Discovery[] {
  return getDb().prepare('SELECT * FROM discoveries ORDER BY created_at DESC LIMIT ?').all(limit) as Discovery[];
}

export function getFavorites(): Discovery[] {
  return getDb()
    .prepare('SELECT * FROM discoveries WHERE is_favorite = 1 ORDER BY created_at DESC')
    .all() as Discovery[];
}

export function toggleFavorite(id: number): boolean {
  const current = getDb()
    .prepare('SELECT is_favorite FROM discoveries WHERE id = ?')
    .get(id) as { is_favorite: number } | undefined;

  if (!current) return false;

  const newValue = current.is_favorite === 0 ? 1 : 0;
  getDb().prepare('UPDATE discoveries SET is_favorite = ? WHERE id = ?').run(newValue, id);

  return newValue === 1;
}

export function updateNotes(id: number, notes: string): void {
  getDb().prepare('UPDATE discoveries SET notes = ? WHERE id = ?').run(notes, id);
}

export function updateDiscoveryMetadata(id: number, data: Partial<Discovery>): void {
  const fields: string[] = [];
  const params: (string | number | boolean | null)[] = [];

  const keys: (keyof Partial<Discovery>)[] = ['bpm', 'key', 'time_signature', 'genre', 'style', 'region', 'year', 'label'];

  for (const key of keys) {
    if (key in data && data[key] !== undefined) {
      fields.push(`${key} = ?`);
      params.push(data[key] ?? null);
    }
  }

  if (fields.length === 0) return;

  params.push(id);
  getDb().prepare(`UPDATE discoveries SET ${fields.join(', ')} WHERE id = ?`).run(...params);
}

export function linkAsset(discoveryId: number, assetId: number): void {
  getDb().prepare("UPDATE discoveries SET asset_id = ?, imported_at = datetime('now') WHERE id = ?").run(assetId, discoveryId);
}

export function incrementListenCount(id: number): void {
  getDb().prepare("UPDATE discoveries SET listen_count = listen_count + 1, last_listened_at = datetime('now') WHERE id = ?").run(id);
}

export function deleteDiscovery(id: number): void {
  getDb().prepare('DELETE FROM discoveries WHERE id = ?').run(id);
}
