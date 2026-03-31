import Database from 'better-sqlite3';
import { DB_PATH } from './constants.js';
import { existsSync } from 'fs';

let db: Database.Database | null = null;

export function getDb(): Database.Database {
  if (db) return db;

  if (!existsSync(DB_PATH)) {
    throw new Error(`AudioForge database not found at: ${DB_PATH}`);
  }

  db = new Database(DB_PATH, { readonly: false });
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  return db;
}

export function closeDb(): void {
  if (db) {
    db.close();
    db = null;
  }
}
