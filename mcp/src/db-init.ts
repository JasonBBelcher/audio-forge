import Database from 'better-sqlite3';

export function initializeDatabase(db: Database.Database): void {
  // Enable foreign keys
  db.pragma('foreign_keys = ON');

  // Assets table
  db.exec(`
    CREATE TABLE IF NOT EXISTS assets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      file_path TEXT NOT NULL UNIQUE,
      file_type TEXT NOT NULL,
      file_size INTEGER NOT NULL,
      duration REAL,
      sample_rate INTEGER,
      channels INTEGER,
      bpm INTEGER,
      key TEXT,
      role TEXT,
      tags TEXT,
      source TEXT,
      analyzed_at TEXT,
      waveform_peaks TEXT,
      created_at TEXT NOT NULL,
      deleted_at TEXT
    )
  `);

  // Collections table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collections (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Collection assets junction table
  db.exec(`
    CREATE TABLE IF NOT EXISTS collection_assets (
      collection_id INTEGER NOT NULL,
      asset_id INTEGER NOT NULL,
      PRIMARY KEY (collection_id, asset_id),
      FOREIGN KEY (collection_id) REFERENCES collections(id) ON DELETE CASCADE,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE CASCADE
    )
  `);

  // Projects table
  db.exec(`
    CREATE TABLE IF NOT EXISTS projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      description TEXT,
      bpm INTEGER,
      key TEXT,
      time_signature TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Watch folders table
  db.exec(`
    CREATE TABLE IF NOT EXISTS watch_folders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      path TEXT NOT NULL UNIQUE,
      recursive BOOLEAN NOT NULL DEFAULT 1,
      enabled BOOLEAN NOT NULL DEFAULT 1,
      created_at TEXT NOT NULL
    )
  `);

  // Discoveries table (Samplette feature)
  db.exec(`
    CREATE TABLE IF NOT EXISTS discoveries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      youtube_id TEXT NOT NULL UNIQUE,
      title TEXT NOT NULL,
      uploader TEXT,
      upload_date TEXT,
      duration INTEGER,
      view_count INTEGER,
      thumbnail_url TEXT,
      description TEXT,
      bpm INTEGER,
      key TEXT,
      time_signature TEXT,
      genre TEXT,
      style TEXT,
      region TEXT,
      year INTEGER,
      label TEXT,
      discovered_via TEXT,
      search_query TEXT,
      notes TEXT,
      is_favorite BOOLEAN DEFAULT 0,
      listen_count INTEGER DEFAULT 0,
      last_listened_at TEXT,
      asset_id INTEGER,
      imported_at TEXT,
      created_at TEXT NOT NULL,
      FOREIGN KEY (asset_id) REFERENCES assets(id) ON DELETE SET NULL
    )
  `);

  // Discovery playlists
  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_playlists (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      description TEXT,
      created_at TEXT NOT NULL
    )
  `);

  // Discovery playlist items (ordered)
  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_playlist_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      playlist_id INTEGER NOT NULL,
      discovery_id INTEGER NOT NULL,
      position INTEGER NOT NULL,
      added_at TEXT NOT NULL,
      FOREIGN KEY (playlist_id) REFERENCES discovery_playlists(id) ON DELETE CASCADE,
      FOREIGN KEY (discovery_id) REFERENCES discoveries(id) ON DELETE CASCADE,
      UNIQUE(playlist_id, discovery_id)
    )
  `);

  // Discovery filter presets
  db.exec(`
    CREATE TABLE IF NOT EXISTS discovery_presets (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL UNIQUE,
      filters_json TEXT NOT NULL,
      created_at TEXT NOT NULL
    )
  `);

  // Create indexes for common queries
  db.exec(`
    CREATE INDEX IF NOT EXISTS idx_assets_deleted_at ON assets(deleted_at);
    CREATE INDEX IF NOT EXISTS idx_assets_created_at ON assets(created_at);
    CREATE INDEX IF NOT EXISTS idx_assets_bpm ON assets(bpm);
    CREATE INDEX IF NOT EXISTS idx_assets_key ON assets(key);
    CREATE INDEX IF NOT EXISTS idx_assets_role ON assets(role);
    CREATE INDEX IF NOT EXISTS idx_projects_created_at ON projects(created_at);
    CREATE INDEX IF NOT EXISTS idx_collections_name ON collections(name);
    CREATE INDEX IF NOT EXISTS idx_discoveries_youtube_id ON discoveries(youtube_id);
    CREATE INDEX IF NOT EXISTS idx_discoveries_genre ON discoveries(genre);
    CREATE INDEX IF NOT EXISTS idx_discoveries_bpm ON discoveries(bpm);
    CREATE INDEX IF NOT EXISTS idx_discoveries_key ON discoveries(key);
    CREATE INDEX IF NOT EXISTS idx_discoveries_view_count ON discoveries(view_count);
    CREATE INDEX IF NOT EXISTS idx_discoveries_is_favorite ON discoveries(is_favorite);
    CREATE INDEX IF NOT EXISTS idx_discoveries_created_at ON discoveries(created_at);
    CREATE INDEX IF NOT EXISTS idx_playlist_items_playlist ON discovery_playlist_items(playlist_id, position);
  `);
}
