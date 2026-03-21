import type { DatabaseConnection } from '../database/connection.js';

export class SettingsService {
  private readonly getStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly setStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly deleteStmt: ReturnType<DatabaseConnection['prepare']>;
  private readonly getAllStmt: ReturnType<DatabaseConnection['prepare']>;

  constructor(private readonly db: DatabaseConnection) {
    this.getStmt = db.prepare('SELECT value FROM settings WHERE key = ?');
    this.setStmt = db.prepare(
      'INSERT INTO settings (key, value, updated_at) VALUES (?, ?, CURRENT_TIMESTAMP) ' +
      'ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = CURRENT_TIMESTAMP'
    );
    this.deleteStmt = db.prepare('DELETE FROM settings WHERE key = ?');
    this.getAllStmt = db.prepare('SELECT key, value FROM settings');
  }

  get<T = unknown>(key: string, defaultValue?: T): T | undefined {
    const row = this.getStmt.get(key) as { value: string } | undefined;
    if (row === undefined) return defaultValue;
    return JSON.parse(row.value) as T;
  }

  set(key: string, value: unknown): void {
    this.setStmt.run(key, JSON.stringify(value));
  }

  delete(key: string): void {
    this.deleteStmt.run(key);
  }

  getAll(): Record<string, unknown> {
    const rows = this.getAllStmt.all() as { key: string; value: string }[];
    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = JSON.parse(row.value);
    }
    return result;
  }
}
