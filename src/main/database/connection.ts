import Database, { Database as BetterSqlite3 } from 'better-sqlite3';

export type DatabaseConnection = BetterSqlite3;

export function createDatabase(dbPath: string): DatabaseConnection {
  const db = new Database(dbPath);

  // Enable WAL mode for concurrent reads
  db.pragma('journal_mode = WAL');

  // Enforce foreign key constraints
  db.pragma('foreign_keys = ON');

  return db;
}
