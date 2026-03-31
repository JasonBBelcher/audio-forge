import { getDb } from '../db.js';

export interface Asset {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  duration: number | null;
  sample_rate: number | null;
  channels: number | null;
  bpm: number | null;
  key: string | null;
  role: string | null;
  tags: string | null;
  source: string | null;
  analyzed_at: string | null;
  waveform_peaks: string | null;
  created_at: string;
}

export function listAssets(): Asset[] {
  return getDb().prepare('SELECT * FROM assets WHERE deleted_at IS NULL ORDER BY created_at DESC').all() as Asset[];
}

export function getAssetById(id: number): Asset | undefined {
  return getDb().prepare('SELECT * FROM assets WHERE id = ? AND deleted_at IS NULL').get(id) as Asset | undefined;
}

export function filterAssets(filters: {
  bpm_min?: number;
  bpm_max?: number;
  key?: string;
  file_type?: string;
  role?: string;
  source?: string;
  tags?: string;
}): Asset[] {
  const conditions: string[] = ['deleted_at IS NULL'];
  const params: (string | number)[] = [];

  if (filters.bpm_min !== undefined) { conditions.push('bpm >= ?'); params.push(filters.bpm_min); }
  if (filters.bpm_max !== undefined) { conditions.push('bpm <= ?'); params.push(filters.bpm_max); }
  if (filters.key) { conditions.push('key = ?'); params.push(filters.key); }
  if (filters.file_type) { conditions.push('file_type = ?'); params.push(filters.file_type); }
  if (filters.role) { conditions.push('role = ?'); params.push(filters.role); }
  if (filters.source) { conditions.push('source = ?'); params.push(filters.source); }
  if (filters.tags) { conditions.push('tags LIKE ?'); params.push(`%${filters.tags}%`); }

  const sql = `SELECT * FROM assets WHERE ${conditions.join(' AND ')} ORDER BY created_at DESC`;
  return getDb().prepare(sql).all(...params) as Asset[];
}

export function updateAssetTags(id: number, tags: string): void {
  getDb().prepare('UPDATE assets SET tags = ? WHERE id = ?').run(tags, id);
}

export function softDeleteAsset(id: number): void {
  getDb().prepare("UPDATE assets SET deleted_at = datetime('now') WHERE id = ?").run(id);
}

export function insertAsset(asset: Partial<Asset>): number {
  const stmt = getDb().prepare(`
    INSERT INTO assets (name, file_path, file_type, file_size, duration, sample_rate, channels, bpm, key, role, tags, source, created_at)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
  `);
  const result = stmt.run(
    asset.name, asset.file_path, asset.file_type, asset.file_size ?? 0,
    asset.duration ?? null, asset.sample_rate ?? null, asset.channels ?? null,
    asset.bpm ?? null, asset.key ?? null, asset.role ?? null,
    asset.tags ?? null, asset.source ?? 'mcp-import'
  );
  return result.lastInsertRowid as number;
}
