import { getDb } from '../db.js';

export interface Collection {
  id: number;
  name: string;
  description: string | null;
  created_at: string;
}

export function listCollections(): (Collection & { asset_count: number })[] {
  return getDb().prepare(`
    SELECT c.*, COUNT(ca.asset_id) as asset_count
    FROM collections c
    LEFT JOIN collection_assets ca ON c.id = ca.collection_id
    GROUP BY c.id ORDER BY c.name
  `).all() as (Collection & { asset_count: number })[];
}

export function getCollectionAssets(collectionId: number): number[] {
  const rows = getDb().prepare(
    'SELECT asset_id FROM collection_assets WHERE collection_id = ?'
  ).all(collectionId) as { asset_id: number }[];
  return rows.map((r) => r.asset_id);
}

export function createCollection(name: string, description?: string): number {
  const result = getDb().prepare(
    "INSERT INTO collections (name, description, created_at) VALUES (?, ?, datetime('now'))"
  ).run(name, description ?? null);
  return result.lastInsertRowid as number;
}

export function addAssetToCollection(collectionId: number, assetId: number): void {
  getDb().prepare(
    'INSERT OR IGNORE INTO collection_assets (collection_id, asset_id) VALUES (?, ?)'
  ).run(collectionId, assetId);
}

export function removeAssetFromCollection(collectionId: number, assetId: number): void {
  getDb().prepare(
    'DELETE FROM collection_assets WHERE collection_id = ? AND asset_id = ?'
  ).run(collectionId, assetId);
}
