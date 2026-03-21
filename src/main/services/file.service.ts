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
  tags?: string[];
  trashed_at?: string | null;
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

  constructor(
    private readonly db: DatabaseConnection,
    private readonly mediaDir: string
  ) {
    this.insertStmt = db.prepare(`
      INSERT INTO assets (
        name, file_path, file_type, file_size, mime_type, role, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.listStmt = db.prepare('SELECT * FROM assets WHERE trashed_at IS NULL ORDER BY created_at DESC');
    this.getStmt = db.prepare('SELECT * FROM assets WHERE id = ?');
    this.deleteStmt = db.prepare('UPDATE assets SET trashed_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.restoreStmt = db.prepare('UPDATE assets SET trashed_at = NULL WHERE id = ?');
    this.tagsStmt = db.prepare('UPDATE assets SET tags = ? WHERE id = ?');
    this.statsStmt = db.prepare('SELECT COUNT(*) as count, SUM(file_size) as total FROM assets WHERE trashed_at IS NULL');
  }

  async importFile(filePath: string): Promise<Asset> {
    const fileName = path.basename(filePath);
    const ext = path.extname(fileName).slice(1).toLowerCase();
    const mimeType = MIME_TYPES[ext] ?? 'application/octet-stream';

    // Copy to media directory
    const newPath = path.join(this.mediaDir, fileName);
    fs.copyFileSync(filePath, newPath);

    const stat = fs.statSync(newPath);

    const result = this.insertStmt.run(fileName, newPath, ext, stat.size, mimeType, null) as any;
    const assetId = (result.lastInsertRowid || result.changes) as number;

    const asset = this.getStmt.get(assetId) as any;
    return this.rowToAsset(asset);
  }

  listFiles(options?: { includeTrash?: boolean }): Asset[] {
    let query = 'SELECT * FROM assets';
    if (!options?.includeTrash) {
      query += ' WHERE trashed_at IS NULL';
    }
    query += ' ORDER BY created_at DESC';

    const rows = this.db.prepare(query).all() as any[];
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

  private rowToAsset(row: any): Asset {
    const tags = row.tags ? JSON.parse(row.tags) : undefined;
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
      trashed_at: row.trashed_at,
      created_at: row.created_at,
    };
  }
}
