import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { createDatabase, DatabaseConnection } from '../../../../src/main/database/connection.js';
import { runMigrations } from '../../../../src/main/database/migrations/runner.js';

describe('Migration Runner', () => {
  let tmpDir: string;
  let dbPath: string;
  let db: DatabaseConnection;

  beforeEach(() => {
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-mig-test-'));
    dbPath = path.join(tmpDir, 'test.db');
    db = createDatabase(dbPath);
  });

  afterEach(() => {
    db.close();
    fs.rmSync(tmpDir, { recursive: true, force: true });
  });

  it('creates _migrations tracking table', () => {
    runMigrations(db);

    const tables = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='_migrations'"
    ).all();
    expect(tables).toHaveLength(1);
  });

  it('runs all migrations on first call', () => {
    runMigrations(db);

    const migrations = db.prepare('SELECT * FROM _migrations ORDER BY id').all() as any[];
    expect(migrations.length).toBeGreaterThan(0);
  });

  it('is idempotent — running twice applies no extra migrations', () => {
    runMigrations(db);
    const firstRun = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as any;

    runMigrations(db);
    const secondRun = db.prepare('SELECT COUNT(*) as count FROM _migrations').get() as any;

    expect(secondRun.count).toBe(firstRun.count);
  });

  it('creates projects table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='projects'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates assets table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='assets'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates settings table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='settings'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates jobs table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='jobs'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates platform_tokens table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='platform_tokens'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates hardware_adapters table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='hardware_adapters'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates midi_devices table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='midi_devices'"
    ).get();
    expect(table).toBeDefined();
  });

  it('creates midi_captures table', () => {
    runMigrations(db);

    const table = db.prepare(
      "SELECT name FROM sqlite_master WHERE type='table' AND name='midi_captures'"
    ).get();
    expect(table).toBeDefined();
  });

  it('records migration name and timestamp', () => {
    runMigrations(db);

    const migration = db.prepare('SELECT * FROM _migrations LIMIT 1').get() as any;
    expect(migration).toHaveProperty('name');
    expect(migration).toHaveProperty('applied_at');
    expect(typeof migration.name).toBe('string');
  });

  describe('Migration 005 - Projects Schema Update', () => {
    it('creates projects table with TEXT primary key', () => {
      runMigrations(db);

      const table = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'"
      ).get() as any;
      expect(table).toBeDefined();
      expect(table.sql).toContain('id TEXT PRIMARY KEY');
    });

    it('includes all required project fields', () => {
      runMigrations(db);

      const columns = db.prepare(
        "PRAGMA table_info(projects)"
      ).all() as any[];
      const columnNames = columns.map((c: any) => c.name);

      const requiredFields = [
        'id', 'name', 'description', 'bpm', 'key', 'timeSignature',
        'state', 'created_at', 'updated_at'
      ];

      for (const field of requiredFields) {
        expect(columnNames).toContain(field);
      }
    });

    it('sets default bpm to 120', () => {
      runMigrations(db);

      const table = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'"
      ).get() as any;
      expect(table.sql).toContain("DEFAULT 120");
    });

    it('sets default timeSignature to 4/4', () => {
      runMigrations(db);

      const table = db.prepare(
        "SELECT sql FROM sqlite_master WHERE type='table' AND name='projects'"
      ).get() as any;
      expect(table.sql).toContain("'4/4'");
    });

    it('allows inserting a project and retrieving it with TEXT id', () => {
      runMigrations(db);

      const testId = 'proj_test_12345';
      db.prepare(
        `INSERT INTO projects (id, name, description, bpm, key, timeSignature)
         VALUES (?, ?, ?, ?, ?, ?)`
      ).run(testId, 'Test Project', 'A test', 120, 'C major', '4/4');

      const project = db.prepare('SELECT * FROM projects WHERE id = ?').get(testId);
      expect(project).toBeDefined();
      expect((project as any).id).toBe(testId);
      expect((project as any).name).toBe('Test Project');
    });
  });
});
