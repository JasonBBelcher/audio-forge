import { randomUUID } from 'crypto';
import type { DatabaseConnection } from '../database/connection.js';

export type JobType =
  | 'download-youtube'
  | 'convert-audio'
  | 'separate-stems'
  | 'sync-media'
  | 'upload-platform'
  | 'hardware-capture'
  | 'hardware-bounce'
  | 'analyze-audio';

export interface Job {
  id: string;
  type: JobType;
  status: 'pending' | 'running' | 'completed' | 'failed' | 'cancelled';
  priority: number;
  payload: Record<string, unknown>;
  result?: Record<string, unknown>;
  error?: string;
  progress: number;
  retries: number;
  maxRetries: number;
  timeout: number;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface EnqueueOptions {
  priority?: number;
  timeout?: number;
  maxRetries?: number;
}

const CONCURRENCY_LIMITS: Record<JobType, number> = {
  'download-youtube': 3,
  'convert-audio': 4,
  'separate-stems': 1,
  'sync-media': 2,
  'upload-platform': 2,
  'hardware-capture': 1,
  'hardware-bounce': 2,
  'analyze-audio': 8,
};

const TIMEOUT_DEFAULTS: Record<JobType, number> = {
  'download-youtube': 30 * 60 * 1000,
  'convert-audio': 10 * 60 * 1000,
  'separate-stems': 30 * 60 * 1000,
  'sync-media': 15 * 60 * 1000,
  'upload-platform': 15 * 60 * 1000,
  'hardware-capture': 60 * 60 * 1000,
  'hardware-bounce': 10 * 60 * 1000,
  'analyze-audio': 5 * 60 * 1000,
};

export class QueueService {
  private readonly insertStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly listStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateProgressStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateStatusStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateResultStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateErrorStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly updateRetriesStmt: ReturnType<DatabaseConnection['prepare']>;

  constructor(private readonly db: DatabaseConnection) {
    this.insertStmt = db.prepare(`
      INSERT INTO jobs (id, type, status, priority, payload, timeout, max_retries, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
    `);

    this.getStmt = db.prepare('SELECT * FROM jobs WHERE id = ?');
    this.listStmt = db.prepare('SELECT * FROM jobs WHERE status = ? ORDER BY priority, created_at');
    this.updateProgressStmt = db.prepare('UPDATE jobs SET progress = ? WHERE id = ?');
    this.updateStatusStmt = db.prepare('UPDATE jobs SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.updateResultStmt = db.prepare('UPDATE jobs SET result = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.updateErrorStmt = db.prepare('UPDATE jobs SET error = ?, status = ?, completed_at = CURRENT_TIMESTAMP WHERE id = ?');
    this.updateRetriesStmt = db.prepare('UPDATE jobs SET retries = retries + 1 WHERE id = ?');
  }

  enqueue(type: JobType, payload: Record<string, unknown> = {}, options: EnqueueOptions = {}): string {
    const id = randomUUID();
    const priority = options.priority ?? 1;
    const timeout = options.timeout ?? TIMEOUT_DEFAULTS[type];
    const maxRetries = options.maxRetries ?? 3;

    this.insertStmt.run(id, type, 'pending', priority, JSON.stringify(payload), timeout, maxRetries);
    return id;
  }

  getJob(id: string): Job | undefined {
    const row = this.getStmt.get(id) as any;
    if (!row) return undefined;
    return this.rowToJob(row);
  }

  listJobs(filter?: { status?: string; type?: JobType }): Job[] {
    let query = 'SELECT * FROM jobs WHERE 1=1';
    const params: any[] = [];

    if (filter?.status) {
      query += ' AND status = ?';
      params.push(filter.status);
    }
    if (filter?.type) {
      query += ' AND type = ?';
      params.push(filter.type);
    }

    query += ' ORDER BY priority, created_at';
    const rows = this.db.prepare(query).all(...params) as any[];
    return rows.map((r) => this.rowToJob(r));
  }

  updateProgress(id: string, progress: number, _stage?: string): void {
    this.updateProgressStmt.run(progress, id);
  }

  markCompleted(id: string, result: Record<string, unknown>): void {
    this.updateResultStmt.run(JSON.stringify(result), 'completed', id);
  }

  markFailed(id: string, error: string): void {
    this.updateErrorStmt.run(error, 'failed', id);
  }

  cancel(id: string): void {
    this.updateStatusStmt.run('cancelled', id);
  }

  markRunning(id: string): void {
    this.updateStatusStmt.run('running', id);
  }

  retry(id: string): void {
    const job = this.getJob(id);
    if (!job) return;

    if (job.retries >= job.maxRetries) {
      // Don't retry, leave as failed
      return;
    }

    this.updateRetriesStmt.run(id);
    this.updateStatusStmt.run('pending', id);
  }

  getConcurrencyLimit(type: JobType): number {
    return CONCURRENCY_LIMITS[type] ?? 1;
  }

  getActiveJobCount(type: JobType): number {
    const row = this.db.prepare('SELECT COUNT(*) as count FROM jobs WHERE type = ? AND status = ?').get(type, 'running') as any;
    return row.count;
  }

  private rowToJob(row: any): Job {
    return {
      id: row.id,
      type: row.type as JobType,
      status: row.status,
      priority: row.priority,
      payload: JSON.parse(row.payload),
      result: row.result ? JSON.parse(row.result) : undefined,
      error: row.error,
      progress: row.progress ?? 0,
      retries: row.retries ?? 0,
      maxRetries: row.max_retries ?? 3,
      timeout: row.timeout,
      createdAt: row.created_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
    };
  }
}
