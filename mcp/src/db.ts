import Database from 'better-sqlite3';
import { DB_PATH } from './constants.js';
import { existsSync, mkdirSync } from 'fs';
import { dirname } from 'path';
import { initializeDatabase } from './db-init.js';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  const isNewDatabase = !existsSync(DB_PATH);

  // Create directory if needed
  const dbDir = dirname(DB_PATH);
  if (!existsSync(dbDir)) {
    mkdirSync(dbDir, { recursive: true });
  }

  db = new Database(DB_PATH, { readonly: false });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  // Initialize schema if this is a new database
  if (isNewDatabase) {
    initializeDatabase(db);
  }

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
