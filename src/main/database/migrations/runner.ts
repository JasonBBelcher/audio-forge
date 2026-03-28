import type { DatabaseConnection } from '../connection.js';

interface Migration {
  name: string;
  up: (db: DatabaseConnection) => void;
}

const migrations: Migration[] = [
  {
    name: '001_initial_schema',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS projects (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          name TEXT NOT NULL,
          description TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS assets (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          project_id INTEGER,
          name TEXT NOT NULL,
          file_path TEXT NOT NULL,
          file_type TEXT NOT NULL,
          file_size INTEGER,
          mime_type TEXT,
          duration REAL,
          sample_rate INTEGER,
          channels INTEGER,
          bpm REAL,
          key TEXT,
          role TEXT,
          tags TEXT,
          metadata TEXT,
          trashed_at DATETIME,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE SET NULL
        );

        CREATE TABLE IF NOT EXISTS settings (
          key TEXT PRIMARY KEY,
          value TEXT NOT NULL,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    name: '002_jobs_queue',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS jobs (
          id TEXT PRIMARY KEY,
          type TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'pending',
          priority INTEGER NOT NULL DEFAULT 1,
          payload TEXT NOT NULL,
          result TEXT,
          error TEXT,
          progress INTEGER DEFAULT 0,
          retries INTEGER DEFAULT 0,
          max_retries INTEGER DEFAULT 3,
          timeout INTEGER DEFAULT 600000,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          started_at DATETIME,
          completed_at DATETIME
        );

        CREATE INDEX IF NOT EXISTS idx_jobs_status ON jobs(status);
        CREATE INDEX IF NOT EXISTS idx_jobs_type ON jobs(type);
        CREATE INDEX IF NOT EXISTS idx_jobs_priority ON jobs(priority, created_at);
      `);
    },
  },
  {
    name: '003_platform_tokens',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS platform_tokens (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          platform TEXT NOT NULL UNIQUE,
          access_token TEXT NOT NULL,
          refresh_token TEXT,
          expires_at DATETIME,
          scope TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    name: '004_hardware_tables',
    up: (db) => {
      db.exec(`
        CREATE TABLE IF NOT EXISTS hardware_adapters (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          manufacturer TEXT,
          version TEXT NOT NULL,
          capabilities TEXT NOT NULL,
          enabled INTEGER DEFAULT 1,
          config TEXT,
          installed_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );

        CREATE TABLE IF NOT EXISTS midi_devices (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          manufacturer TEXT,
          adapter_id TEXT,
          direction TEXT NOT NULL,
          last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (adapter_id) REFERENCES hardware_adapters(id)
        );

        CREATE TABLE IF NOT EXISTS midi_captures (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          adapter_id TEXT NOT NULL,
          device_name TEXT,
          capture_mode TEXT NOT NULL,
          asset_id INTEGER,
          event_count INTEGER,
          duration_ms INTEGER,
          captured_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (adapter_id) REFERENCES hardware_adapters(id),
          FOREIGN KEY (asset_id) REFERENCES assets(id)
        );
      `);
    },
  },
  {
    name: '005_projects_v2',
    up: (db) => {
      db.exec(`
        DROP TABLE IF EXISTS projects;

        CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          description TEXT,
          bpm INTEGER DEFAULT 120,
          key TEXT DEFAULT 'C major',
          timeSignature TEXT DEFAULT '4/4',
          state TEXT,
          created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
          updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
        );
      `);
    },
  },
  {
    name: '006_assets_perf',
    up: (db) => {
      db.exec(`
        CREATE INDEX IF NOT EXISTS idx_assets_active ON assets(trashed_at, created_at);
        ALTER TABLE assets ADD COLUMN waveform_peaks TEXT;
      `);
    },
  },
  {
    name: '007_analyzed_at',
    up: (db) => {
      db.exec(`
        ALTER TABLE assets ADD COLUMN analyzed_at DATETIME;
      `);
    },
  },
  {
    name: '008_asset_source',
    up: (db) => {
      db.exec(`
        ALTER TABLE assets ADD COLUMN source TEXT;
        CREATE INDEX IF NOT EXISTS idx_assets_source ON assets(source, trashed_at);
      `);
    },
  },
];

export function runMigrations(db: DatabaseConnection): void {
  // Create migrations tracking table
  db.exec(`
    CREATE TABLE IF NOT EXISTS _migrations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      applied_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
  `);

  const getApplied = db.prepare('SELECT name FROM _migrations');
  const applied = new Set((getApplied.all() as { name: string }[]).map((r) => r.name));

  const insertMigration = db.prepare('INSERT INTO _migrations (name) VALUES (?)');

  for (const migration of migrations) {
    if (!applied.has(migration.name)) {
      const run = db.transaction(() => {
        migration.up(db);
        insertMigration.run(migration.name);
      });
      run();
    }
  }
}
