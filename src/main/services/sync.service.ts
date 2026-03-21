import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';

export type SyncStatusType = 'initialized' | 'syncing' | 'synced' | 'out-of-sync' | 'failed';

export interface SyncStatus {
  id: string;
  projectId: string;
  backend: string;
  status: SyncStatusType;
  progress?: number;
  currentStage?: string;
  error?: string;
  lastSyncTime?: string;
  syncRules?: any;
}

export interface SyncConflict {
  id: string;
  syncId: string;
  filePath: string;
  localModified: string;
  remoteModified: string;
  resolution?: string;
}

export interface SyncRules {
  includeAudio?: boolean;
  includeMetadata?: boolean;
  excludePatterns?: string[];
}

export class SyncService {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS sync_sessions (
        id TEXT PRIMARY KEY,
        projectId TEXT NOT NULL,
        backend TEXT NOT NULL,
        status TEXT DEFAULT 'initialized',
        progress INTEGER DEFAULT 0,
        currentStage TEXT,
        error TEXT,
        lastSyncTime DATETIME,
        syncRules TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS sync_conflicts (
        id TEXT PRIMARY KEY,
        syncId TEXT NOT NULL,
        filePath TEXT NOT NULL,
        localModified DATETIME NOT NULL,
        remoteModified DATETIME NOT NULL,
        resolution TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (syncId) REFERENCES sync_sessions(id)
      );

      CREATE INDEX IF NOT EXISTS idx_sync_projectId ON sync_sessions(projectId);
      CREATE INDEX IF NOT EXISTS idx_sync_conflicts_syncId ON sync_conflicts(syncId);
    `);
  }

  async initializeSync(projectId: string, backend: string): Promise<SyncStatus> {
    const id = `sync_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO sync_sessions (id, projectId, backend, status, created_at, updated_at)
      VALUES (?, ?, ?, 'initialized', ?, ?)
    `);

    stmt.run(id, projectId, backend, now, now);

    return {
      id,
      projectId,
      backend,
      status: 'initialized',
    };
  }

  async getSyncStatus(projectId: string): Promise<SyncStatus | undefined> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_sessions
      WHERE projectId = ?
      ORDER BY created_at DESC
      LIMIT 1
    `);

    const result = stmt.get(projectId) as any;
    if (!result) return undefined;

    return {
      ...result,
      syncRules: result.syncRules ? JSON.parse(result.syncRules) : undefined,
    };
  }

  async markSynced(projectId: string): Promise<SyncStatus | undefined> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_sessions
      SET status = 'synced', lastSyncTime = ?, updated_at = ?
      WHERE projectId = ?
    `);

    stmt.run(now, now, projectId);

    return this.getSyncStatus(projectId);
  }

  async markOutOfSync(projectId: string): Promise<SyncStatus | undefined> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_sessions
      SET status = 'out-of-sync', updated_at = ?
      WHERE projectId = ?
    `);

    stmt.run(now, projectId);

    return this.getSyncStatus(projectId);
  }

  async updateSyncProgress(syncId: string, update: { progress: number; stage: string }): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_sessions
      SET progress = ?, currentStage = ?, status = 'syncing', updated_at = ?
      WHERE id = ?
    `);

    stmt.run(update.progress, update.stage, now, syncId);
  }

  async recordSyncError(syncId: string, error: string): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_sessions
      SET status = 'failed', error = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(error, now, syncId);
  }

  async listSyncSessions(projectId: string): Promise<SyncStatus[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_sessions
      WHERE projectId = ?
      ORDER BY created_at DESC
    `);

    const results = stmt.all(projectId) as any[];
    return results.map((r) => ({
      ...r,
      syncRules: r.syncRules ? JSON.parse(r.syncRules) : undefined,
    }));
  }

  async recordConflict(syncId: string, conflict: Omit<SyncConflict, 'id' | 'syncId'>): Promise<void> {
    const id = `conflict_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    const stmt = this.db.prepare(`
      INSERT INTO sync_conflicts (id, syncId, filePath, localModified, remoteModified, created_at)
      VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    stmt.run(id, syncId, conflict.filePath, conflict.localModified, conflict.remoteModified);
  }

  async getConflicts(syncId: string): Promise<SyncConflict[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM sync_conflicts
      WHERE syncId = ?
      ORDER BY created_at DESC
    `);

    return stmt.all(syncId) as SyncConflict[];
  }

  async resolveConflict(syncId: string, filePath: string, resolution: string): Promise<void> {
    const stmt = this.db.prepare(`
      UPDATE sync_conflicts
      SET resolution = ?
      WHERE syncId = ? AND filePath = ?
    `);

    stmt.run(resolution, syncId, filePath);
  }

  async setSyncRules(syncId: string, rules: SyncRules): Promise<void> {
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      UPDATE sync_sessions
      SET syncRules = ?, updated_at = ?
      WHERE id = ?
    `);

    stmt.run(JSON.stringify(rules), now, syncId);
  }
}
