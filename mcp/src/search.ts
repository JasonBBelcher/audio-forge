import Fuse from 'fuse.js';
import type { Asset } from './queries/assets.js';

let fuse: Fuse<Asset> | null = null;

export interface SearchResult {
  id: number;
  name: string;
  file_type: string;
  bpm: number | null;
  key: string | null;
  tags: string | null;
  score: number;
}

export function buildSearchIndex(assets: Asset[]): void {
  fuse = new Fuse(assets, {
    keys: [
      { name: 'name', weight: 2 },
      { name: 'tags', weight: 1.5 },
      { name: 'key', weight: 0.5 },
      { name: 'file_type', weight: 0.3 },
    ],
    threshold: 0.4,
    includeScore: true,
  });
}

export function searchAssets(query: string, limit: number = 10): SearchResult[] {
  if (!fuse) throw new Error('Search index not built — call buildSearchIndex first');
  return fuse.search(query, { limit }).map((r) => ({
    id: r.item.id,
    name: r.item.name,
    file_type: r.item.file_type,
    bpm: r.item.bpm,
    key: r.item.key,
    tags: r.item.tags,
    score: Math.round((1 - (r.score ?? 0)) * 100) / 100,
  }));
}
