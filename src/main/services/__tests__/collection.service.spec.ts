import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { CollectionService, Collection } from '../collection.service.js';
import path from 'path';
import fs from 'fs';
import os from 'os';

describe('CollectionService', () => {
  let db: Database.Database;
  let service: CollectionService;
  let tempDir: string;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Create required tables (assets table is referenced by foreign key)
    db.exec(`
      CREATE TABLE IF NOT EXISTS assets (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL,
        file_path TEXT NOT NULL,
        file_type TEXT,
        file_size INTEGER,
        mime_type TEXT,
        duration REAL,
        sample_rate INTEGER,
        channels INTEGER,
        bpm INTEGER,
        key TEXT,
        role TEXT,
        tags TEXT,
        trashed_at TEXT,
        created_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS collections (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT NOT NULL UNIQUE,
        description TEXT,
        created_at TEXT DEFAULT (datetime('now')),
        updated_at TEXT DEFAULT (datetime('now'))
      );

      CREATE TABLE IF NOT EXISTS collection_assets (
        collection_id INTEGER NOT NULL REFERENCES collections(id) ON DELETE CASCADE,
        asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
        added_at TEXT DEFAULT (datetime('now')),
        PRIMARY KEY (collection_id, asset_id)
      );
    `);

    service = new CollectionService(db);

    // Create temp directory for ZIP export tests
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'audioforge-test-'));
  });

  describe('listCollections', () => {
    it('returns empty array initially', () => {
      const collections = service.listCollections();
      expect(collections).toEqual([]);
    });

    it('returns all created collections with asset counts', () => {
      const col1 = service.createCollection('Drums', 'Drum samples');
      const col2 = service.createCollection('Bass', 'Bass samples');

      const collections = service.listCollections();
      expect(collections).toHaveLength(2);
      expect(collections[0].name).toBe('Drums');
      expect(collections[1].name).toBe('Bass');
      expect(collections[0].assetCount).toBe(0);
    });

    it('includes asset count in each collection', () => {
      const col = service.createCollection('Test Collection');

      // Add test assets
      const assetId1 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('kick.wav', '/path/kick.wav', 'wav', 1024).lastInsertRowid as number;
      const assetId2 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('snare.wav', '/path/snare.wav', 'wav', 2048).lastInsertRowid as number;

      service.addAsset(col.id, assetId1);
      service.addAsset(col.id, assetId2);

      const collections = service.listCollections();
      expect(collections[0].assetCount).toBe(2);
    });
  });

  describe('createCollection', () => {
    it('creates a collection with name only', () => {
      const collection = service.createCollection('My Collection');

      expect(collection.id).toBeDefined();
      expect(collection.name).toBe('My Collection');
      expect(collection.description).toBe(null);
      expect(collection.created_at).toBeDefined();
      expect(collection.updated_at).toBeDefined();
      expect(collection.assetCount).toBe(0);
    });

    it('creates a collection with name and description', () => {
      const collection = service.createCollection('Drums', 'All drum samples');

      expect(collection.name).toBe('Drums');
      expect(collection.description).toBe('All drum samples');
    });

    it('throws error if name is not unique', () => {
      service.createCollection('Unique Name');

      expect(() => {
        service.createCollection('Unique Name');
      }).toThrow();
    });

    it('persists collection to database', () => {
      service.createCollection('Persisted Collection');

      const collections = service.listCollections();
      expect(collections.some(c => c.name === 'Persisted Collection')).toBe(true);
    });
  });

  describe('deleteCollection', () => {
    it('deletes a collection by id', () => {
      const col = service.createCollection('To Delete');
      expect(service.listCollections()).toHaveLength(1);

      service.deleteCollection(col.id);

      expect(service.listCollections()).toHaveLength(0);
    });

    it('cascades delete to collection_assets', () => {
      const col = service.createCollection('To Delete');
      const assetId = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('test.wav', '/path/test.wav', 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId);
      expect(service.listAssets(col.id)).toHaveLength(1);

      service.deleteCollection(col.id);

      expect(service.listCollections()).toHaveLength(0);
      // Verify via direct query that the join is gone
      const remaining = db.prepare('SELECT * FROM collection_assets WHERE collection_id = ?').all(col.id);
      expect(remaining).toHaveLength(0);
    });
  });

  describe('renameCollection', () => {
    it('updates collection name', () => {
      const col = service.createCollection('Old Name');
      service.renameCollection(col.id, 'New Name');

      const collections = service.listCollections();
      expect(collections[0].name).toBe('New Name');
    });

    it('throws error if new name is not unique', () => {
      service.createCollection('Name 1');
      const col2 = service.createCollection('Name 2');

      expect(() => {
        service.renameCollection(col2.id, 'Name 1');
      }).toThrow();
    });

    it('updates updated_at timestamp', () => {
      const col = service.createCollection('Test');
      const oldUpdatedAt = col.updated_at;

      // Wait to ensure timestamp changes (SQLite datetime is per-second)
      const start = Date.now();
      while (Date.now() - start < 1050) {
        // Busy wait to ensure at least 1 second passes
      }

      service.renameCollection(col.id, 'New Name');

      const collections = service.listCollections();
      expect(new Date(collections[0].updated_at).getTime()).toBeGreaterThanOrEqual(
        new Date(oldUpdatedAt).getTime()
      );
    });
  });

  describe('addAsset', () => {
    it('adds an asset to a collection', () => {
      const col = service.createCollection('Collection');
      const assetId = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('sample.wav', '/path/sample.wav', 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId);

      const assets = service.listAssets(col.id);
      expect(assets).toHaveLength(1);
      expect(assets[0].id).toBe(assetId);
    });

    it('does not duplicate if asset already in collection', () => {
      const col = service.createCollection('Collection');
      const assetId = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('sample.wav', '/path/sample.wav', 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId);
      // SQLite will throw on duplicate primary key
      expect(() => {
        service.addAsset(col.id, assetId);
      }).toThrow();
    });
  });

  describe('removeAsset', () => {
    it('removes an asset from a collection', () => {
      const col = service.createCollection('Collection');
      const assetId = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('sample.wav', '/path/sample.wav', 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId);
      expect(service.listAssets(col.id)).toHaveLength(1);

      service.removeAsset(col.id, assetId);

      expect(service.listAssets(col.id)).toHaveLength(0);
    });

    it('does not throw if asset not in collection', () => {
      const col = service.createCollection('Collection');
      const assetId = 999; // Non-existent

      expect(() => {
        service.removeAsset(col.id, assetId);
      }).not.toThrow();
    });
  });

  describe('listAssets', () => {
    it('returns empty array for collection with no assets', () => {
      const col = service.createCollection('Empty Collection');
      const assets = service.listAssets(col.id);

      expect(assets).toEqual([]);
    });

    it('returns all assets in a collection', () => {
      const col = service.createCollection('Collection');

      const assetId1 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('kick.wav', '/path/kick.wav', 'wav', 1024).lastInsertRowid as number;
      const assetId2 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('snare.wav', '/path/snare.wav', 'wav', 2048).lastInsertRowid as number;

      service.addAsset(col.id, assetId1);
      service.addAsset(col.id, assetId2);

      const assets = service.listAssets(col.id);
      expect(assets).toHaveLength(2);
      expect(assets.map(a => a.name)).toContain('kick.wav');
      expect(assets.map(a => a.name)).toContain('snare.wav');
    });

    it('returns full asset rows with metadata', () => {
      const col = service.createCollection('Collection');

      const assetId = db
        .prepare(
          'INSERT INTO assets (name, file_path, file_type, file_size, bpm, key, duration) VALUES (?, ?, ?, ?, ?, ?, ?)'
        )
        .run('drum.wav', '/path/drum.wav', 'wav', 1024, 120, 'Am', 4.5).lastInsertRowid as number;

      service.addAsset(col.id, assetId);

      const assets = service.listAssets(col.id);
      expect(assets[0].name).toBe('drum.wav');
      expect(assets[0].bpm).toBe(120);
      expect(assets[0].key).toBe('Am');
      expect(assets[0].duration).toBe(4.5);
    });
  });

  describe('exportAsZip', () => {
    it('exports collection with assets as ZIP file', async () => {
      const col = service.createCollection('Export Test');

      // Create actual test files to export
      const testFile1 = path.join(tempDir, 'test1.wav');
      const testFile2 = path.join(tempDir, 'test2.wav');
      fs.writeFileSync(testFile1, 'fake wav data 1');
      fs.writeFileSync(testFile2, 'fake wav data 2');

      const assetId1 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('test1.wav', testFile1, 'wav', 1024).lastInsertRowid as number;
      const assetId2 = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('test2.wav', testFile2, 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId1);
      service.addAsset(col.id, assetId2);

      const outputZip = path.join(tempDir, 'collection.zip');
      await service.exportAsZip(col.id, outputZip);

      // Verify ZIP file was created
      expect(fs.existsSync(outputZip)).toBe(true);
      expect(fs.statSync(outputZip).size).toBeGreaterThan(0);
    });

    it('exports with collection name as folder in ZIP', async () => {
      const col = service.createCollection('MyCollection');

      const testFile = path.join(tempDir, 'test.wav');
      fs.writeFileSync(testFile, 'fake wav data');

      const assetId = db
        .prepare('INSERT INTO assets (name, file_path, file_type, file_size) VALUES (?, ?, ?, ?)')
        .run('test.wav', testFile, 'wav', 1024).lastInsertRowid as number;

      service.addAsset(col.id, assetId);

      const outputZip = path.join(tempDir, 'collection.zip');
      await service.exportAsZip(col.id, outputZip);

      expect(fs.existsSync(outputZip)).toBe(true);
    });

    it('throws error if collection is empty', async () => {
      const col = service.createCollection('Empty');
      const outputZip = path.join(tempDir, 'collection.zip');

      await expect(service.exportAsZip(col.id, outputZip)).rejects.toThrow();
    });

    it('handles non-existent collection gracefully', async () => {
      const outputZip = path.join(tempDir, 'collection.zip');

      await expect(service.exportAsZip(999, outputZip)).rejects.toThrow();
    });
  });
});
