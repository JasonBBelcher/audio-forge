import { getDb } from '../db.js';
import { Discovery } from './discoveries.js';

export interface DiscoveryPlaylist {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export interface PlaylistItem {
  id: number;
  playlist_id: number;
  discovery_id: number;
  position: number;
  added_at: string;
}

export function createPlaylist(name: string, description?: string): number {
  const result = getDb().prepare("INSERT INTO discovery_playlists (name, description, created_at) VALUES (?, ?, datetime('now'))").run(
    name,
    description ?? null
  );

  return result.lastInsertRowid as number;
}

export function listPlaylists(): DiscoveryPlaylist[] {
  return getDb().prepare('SELECT * FROM discovery_playlists ORDER BY created_at DESC').all() as DiscoveryPlaylist[];
}

export function getPlaylist(playlistId: number): DiscoveryPlaylist | undefined {
  return getDb().prepare('SELECT * FROM discovery_playlists WHERE id = ?').get(playlistId) as DiscoveryPlaylist | undefined;
}

export function getPlaylistItems(playlistId: number): Discovery[] {
  return getDb()
    .prepare(
      `
    SELECT d.* FROM discoveries d
    INNER JOIN discovery_playlist_items dpi ON d.id = dpi.discovery_id
    WHERE dpi.playlist_id = ?
    ORDER BY dpi.position ASC
  `
    )
    .all(playlistId) as Discovery[];
}

export function addToPlaylist(playlistId: number, discoveryId: number): void {
  // Get the next position
  const maxPos = getDb()
    .prepare('SELECT MAX(position) as max_pos FROM discovery_playlist_items WHERE playlist_id = ?')
    .get(playlistId) as { max_pos: number | null } | undefined;

  const position = (maxPos?.max_pos ?? -1) + 1;

  getDb()
    .prepare("INSERT OR IGNORE INTO discovery_playlist_items (playlist_id, discovery_id, position, added_at) VALUES (?, ?, ?, datetime('now'))")
    .run(playlistId, discoveryId, position);
}

export function removeFromPlaylist(playlistId: number, discoveryId: number): void {
  getDb().prepare('DELETE FROM discovery_playlist_items WHERE playlist_id = ? AND discovery_id = ?').run(playlistId, discoveryId);
}

export function reorderPlaylist(playlistId: number, discoveryId: number, newPosition: number): void {
  getDb().prepare('UPDATE discovery_playlist_items SET position = ? WHERE playlist_id = ? AND discovery_id = ?').run(newPosition, playlistId, discoveryId);
}

export function deletePlaylist(playlistId: number): void {
  getDb().prepare('DELETE FROM discovery_playlists WHERE id = ?').run(playlistId);
}

export function getPlaylistCount(playlistId: number): number {
  const result = getDb().prepare('SELECT COUNT(*) as count FROM discovery_playlist_items WHERE playlist_id = ?').get(playlistId) as {
    count: number;
  };
  return result.count;
}
