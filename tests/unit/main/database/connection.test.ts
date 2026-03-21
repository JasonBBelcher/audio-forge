import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase, DatabaseConnection } from '../../../../src/main/database/connection.js';

describe('Database Connection', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseConnection;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-db-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates a SQLite database file', () => {
    expect(fs.existsSync(dbPath)).toBe(true);
  });

  it('enables WAL journal mode', () => {
    const result = db.pragma('journal_mode');
    expect(result).toEqual([{ journal_mode: 'wal' }]);
  });

  it('enables foreign keys', () => {
    const result = db.pragma('foreign_keys');
    expect(result).toEqual([{ foreign_keys: 1 }]);
  });

  it('can execute raw SQL statements', () => {
    db.exec('CREATE TABLE test (id INTEGER PRIMARY KEY, name TEXT)');
    db.exec("INSERT INTO test (name) VALUES ('hello')");

    const rows = db.prepare('SELECT * FROM test').all();
    expect(rows).toEqual([{ id: 1, name: 'hello' }]);
  });

  it('supports synchronous reads (< 1ms for simple query)', () => {
    db.exec('CREATE TABLE bench (id INTEGER PRIMARY KEY, val TEXT)');
    db.exec("INSERT INTO bench (val) VALUES ('test')");

    const start = performance.now();
    db.prepare('SELECT * FROM bench WHERE id = 1').get();
    const elapsed = performance.now() - start;

    expect(elapsed).toBeLessThan(5); // generous threshold for CI
  });

  it('prepare returns a statement object', () => {
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY)');
    const stmt = db.prepare('SELECT * FROM t');
    expect(stmt).toHaveProperty('all');
    expect(stmt).toHaveProperty('get');
    expect(stmt).toHaveProperty('run');
  });

  it('provides transaction support', () => {
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT)');

    const insertMany = db.transaction((items: { val: string }[]) => {
      const stmt = db.prepare('INSERT INTO t (val) VALUES (?)');
      for (const item of items) {
        stmt.run(item.val);
      }
    });

    insertMany([{ val: 'a' }, { val: 'b' }, { val: 'c' }]);

    const rows = db.prepare('SELECT * FROM t').all();
    expect(rows).toHaveLength(3);
  });

  it('rolls back transaction on error', () => {
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, val TEXT NOT NULL)');

    const insertMany = db.transaction((items: (string | null)[]) => {
      const stmt = db.prepare('INSERT INTO t (val) VALUES (?)');
      for (const item of items) {
        stmt.run(item);
      }
    });

    expect(() => insertMany(['a', null as any, 'c'])).toThrow();

    const rows = db.prepare('SELECT * FROM t').all();
    expect(rows).toHaveLength(0);
  });
});
