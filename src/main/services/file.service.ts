import fs from 'fs';
import path from 'path';
import type { DatabaseConnection } from '../database/connection.js';

export interface Asset {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  mime_type?: string;
  duration?: number;
  sample_rate?: number;
  channels?: number;
  bpm?: number;
  key?: string;
  role?: string;
  source?: string;
  tags?: string[];
  waveform_peaks?: number[];
  trashed_at?: string | null;
  analyzed_at?: string | null;
  created_at: string;
}

const MIME_TYPES: Record<string, string> = {
  wav: 'audio/wav',
  mp3: 'audio/mpeg',
  flac: 'audio/flac',
  m4a: 'audio/mp4',
  ogg: 'audio/ogg',
  aac: 'audio/aac',
  mp4: 'video/mp4',
  mov: 'video/quicktime',
  mkv: 'video/x-matroska',
  webm: 'video/webm',
};

export class FileService {
  private readonly insertStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly listStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly deleteStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly restoreStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly tagsStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly statsStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateAnalysisStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly listUnanalyzedStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updatePeaksStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly findByPathStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly markAnalyzedStmt: ReturnType<DatabaseConnection['prepare']>;

  constructor(
    private readonly db: DatabaseConnection,
    private readonly mediaDir: string
  ) {
    this.insertStmt = db.prepare(`
      INSERT INTO assets (
        name, file_path, file_type, file_size, mime_type, role, source, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.listStmt = db.prepare('SELECT * FROM assets WHERE trashed_at IS NULL ORDER BY created_at DESC');
    this.getStmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    this.deleteStmt = db.prepare('UPDATE assets SET trashed_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.restoreStmt = db.prepare('UPDATE assets SET trashed_at = NULL WHERE id = ?');
    this.tagsStmt = db.prepare('UPDATE assets SET tags = ? WHERE id = ?');
    this.statsStmt = db.prepare('SELECT COUNT(*) as count, SUM(file_size) as total FROM assets WHERE trashed_at IS NULL');
    this.updateAnalysisStmt = db.prepare(`
      UPDATE assets SET bpm = COALESCE(?, bpm), key = COALESCE(?, key), duration = COALESCE(?, duration) WHERE id = ?
    `);
    this.listUnanalyzedStmt = db.prepare(`
      SELECT * FROM assets WHERE trashed_at IS NULL AND analyzed_at IS NULL ORDER BY created_at DESC
    `);
    this.updatePeaksStmt = db.prepare('UPDATE assets SET waveform_peaks = ? WHERE id = ?');
    this.findByPathStmt = db.prepare('SELECT id FROM assets WHERE name = ? AND trashed_at IS NULL LIMIT 1');
    this.markAnalyzedStmt = db.prepare('UPDATE assets SET analyzed_at = CURRENT_TIMESTAMP WHERE id = ?');
  }

  async importFile(filePath: string, options?: { source?: string; destDir?: string }): Promise<Asset> {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    // Copy to destination (media dir by default, or a source-specific subfolder)
    const destDir = options?.destDir ?? this.mediaDir;
    if (!fs.existsSync(destDir)) fs.mkdirSync(destDir, { recursive: true });
    const newPath = path.join(destDir, fileName);
    fs.copyFileSync(filePath, newPath);

    const stat = fs.statSync(newPath);

    const result = this.insertStmt.run(
      fileName, newPath, ext, stat.size, mimeType, null, options?.source ?? null
    ) as any;
    const assetId = (result.lastInsertRowid || result.changes) as number;

    const asset = this.getStmt.get(assetId) as any;
    return this.rowToAsset(asset);
  }

  listBySource(source: string): Asset[] {
    const rows = this.db.prepare(
      'SELECT * FROM assets WHERE trashed_at IS NULL AND source = ? ORDER BY created_at DESC'
    ).all(source) as any[];
    return rows.map((r) => this.rowToAsset(r));
  }

  listFiles(options?: { includeTrash?: boolean }): Asset[] {
    const rows = (options?.includeTrash
      ? this.db.prepare('SELECT * FROM assets ORDER BY created_at DESC').all()
      : this.listStmt.all()) as any[];
    return rows.map((r) => this.rowToAsset(r));
  }

  getFile(id: number): Asset | undefined {
    const row = this.getStmt.get(id) as any;
    if (!row) return undefined;
    return this.rowToAsset(row);
  }

  deleteFile(id: number): void {
    this.deleteStmt.run(id);
  }

  restoreFile(id: number): void {
    this.restoreStmt.run(id);
  }

  searchFiles(query: string): Asset[] {
    // Basic substring search (FTS5 would be more powerful but complex to set up for tests)
    const rows = this.db.prepare(`
      SELECT * FROM assets
      WHERE trashed_at IS NULL AND (name LIKE ? OR tags LIKE ?)
      ORDER BY created_at DESC
    `).all(`%${query}%`, `%${query}%`) as any[];
    return rows.map((r) => this.rowToAsset(r));
  }

  // Aliases for asset-related methods (used by assetHandlers)
  listAssets = this.listFiles.bind(this);
  searchAssets = this.searchFiles.bind(this);
  deleteAsset = this.deleteFile.bind(this);
  importAsset = this.importFile.bind(this);

  addTags(id: number, tags: string[]): void {
    const tagsStr = JSON.stringify(tags);
    this.tagsStmt.run(tagsStr, id);
  }

  getStorageStats(): { totalSize: number; totalFiles: number } {
    const row = this.statsStmt.get() as any;
    return {
      totalSize: row.total ?? 0,
      totalFiles: row.count ?? 0,
    };
  }

  updateAssetAnalysis(id: number, data: { bpm?: number; key?: string; durationSec?: number }): void {
    this.updateAnalysisStmt.run(data.bpm ?? null, data.key ?? null, data.durationSec ?? null, id);
  }

  findByFilePath(filePath: string): boolean {
    const name = filePath.split('/').pop() ?? filePath;
    return !!this.findByPathStmt.get(name);
  }

  updateWaveformPeaks(id: number, peaks: number[]): void {
    this.updatePeaksStmt.run(JSON.stringify(peaks), id);
  }

  markAnalyzed(id: number): void {
    this.markAnalyzedStmt.run(id);
  }

  listUnanalyzedAssets(): Asset[] {
    const rows = this.listUnanalyzedStmt.all() as any[];
    return rows.map((r) => this.rowToAsset(r));
  }

  private rowToAsset(row: any): Asset {
    const tags = row.tags ? JSON.parse(row.tags) : undefined;
    const waveform_peaks = row.waveform_peaks ? JSON.parse(row.waveform_peaks) : undefined;
    return {
      id: row.id,
      name: row.name,
      file_path: row.file_path,
      file_type: row.file_type,
      file_size: row.file_size,
      mime_type: row.mime_type,
      duration: row.duration,
      sample_rate: row.sample_rate,
      channels: row.channels,
      bpm: row.bpm,
      key: row.key,
      role: row.role,
      tags,
      waveform_peaks,
      source: row.source ?? undefined,
      trashed_at: row.trashed_at,
      analyzed_at: row.analyzed_at,
      created_at: row.created_at,
    };
  }
}
