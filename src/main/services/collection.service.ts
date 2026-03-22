import type Database from 'better-sqlite3';
import archiver from 'archiver';
import fs from 'fs';
import path from 'path';

export interface Collection {
  id: number;
  name: string;
  description?: string;
  assetCount?: number;
  created_at: string;
  updated_at: string;
}

export interface Asset {
  id: number;
  name: string;
  file_path: string;
  file_type: string;
  file_size: number;
  bpm?: number;
  key?: string;
  duration?: number;
  created_at: string;
}

export class CollectionService {
  private readonly listCollectionsStmt: ReturnType<Database['prepare']>;
  private readonly createCollectionStmt: ReturnType<Database['prepare']>;
  private readonly deleteCollectionStmt: ReturnType<Database['prepare']>;
  private readonly renameCollectionStmt: ReturnType<Database['prepare']>;
  private readonly addAssetStmt: ReturnType<Database['prepare']>;
  private readonly removeAssetStmt: ReturnType<Database['prepare']>;
  private readonly listAssetsStmt: ReturnType<Database['prepare']>;
  private readonly getCollectionStmt: ReturnType<Database['prepare']>;

  constructor(private db: Database.Database) {
    // Initialize database tables
    this.db.exec(`
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

    // Prepare statements
    this.listCollectionsStmt = db.prepare(`
      SELECT
        c.id, c.name, c.description, c.created_at, c.updated_at,
        COUNT(ca.asset_id) as assetCount
      FROM collections c
      LEFT JOIN collection_assets ca ON c.id = ca.collection_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    this.getCollectionStmt = db.prepare('SELECT * FROM collections WHERE id = ?');

    this.createCollectionStmt = db.prepare(`
      INSERT INTO collections (name, description)
      VALUES (?, ?)
    `);

    this.deleteCollectionStmt = db.prepare('DELETE FROM collections WHERE id = ?');

    this.renameCollectionStmt = db.prepare(`
      UPDATE collections
      SET name = ?, updated_at = datetime('now')
      WHERE id = ?
    `);

    this.addAssetStmt = db.prepare(`
      INSERT INTO collection_assets (collection_id, asset_id)
      VALUES (?, ?)
    `);

    this.removeAssetStmt = db.prepare(`
      DELETE FROM collection_assets
      WHERE collection_id = ? AND asset_id = ?
    `);

    this.listAssetsStmt = db.prepare(`
      SELECT a.* FROM assets a
      INNER JOIN collection_assets ca ON a.id = ca.asset_id
      WHERE ca.collection_id = ?
      ORDER BY ca.added_at DESC
    `);
  }

  listCollections(): Collection[] {
    const rows = this.listCollectionsStmt.all() as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      description: row.description,
      assetCount: row.assetCount,
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  }

  createCollection(name: string, description?: string): Collection {
    const result = this.createCollectionStmt.run(name, description ?? null) as any;
    const id = result.lastInsertRowid as number;

    const row = this.getCollectionStmt.get(id) as any;
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      assetCount: 0,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };
  }

  deleteCollection(id: number): void {
    this.deleteCollectionStmt.run(id);
  }

  renameCollection(id: number, name: string): void {
    this.renameCollectionStmt.run(name, id);
  }

  addAsset(collectionId: number, assetId: number): void {
    this.addAssetStmt.run(collectionId, assetId);
  }

  removeAsset(collectionId: number, assetId: number): void {
    this.removeAssetStmt.run(collectionId, assetId);
  }

  listAssets(collectionId: number): Asset[] {
    const rows = this.listAssetsStmt.all(collectionId) as any[];
    return rows.map(row => ({
      id: row.id,
      name: row.name,
      file_path: row.file_path,
      file_type: row.file_type,
      file_size: row.file_size,
      bpm: row.bpm,
      key: row.key,
      duration: row.duration,
      created_at: row.created_at,
    }));
  }

  async exportAsZip(collectionId: number, outputPath: string): Promise<void> {
    // Get collection
    const collection = this.getCollectionStmt.get(collectionId) as any;
    if (!collection) {
      throw new Error(`Collection ${collectionId} not found`);
    }

    // Get assets in collection
    const assets = this.listAssets(collectionId);
    if (assets.length === 0) {
      throw new Error('Cannot export empty collection');
    }

    // Create ZIP file
    return new Promise((resolve, reject) => {
      const output = fs.createWriteStream(outputPath);
      const archive = archiver('zip', { zlib: { level: 9 } });

      output.on('close', () => {
        resolve();
      });

      archive.on('error', (err) => {
        reject(err);
      });

      output.on('error', (err) => {
        reject(err);
      });

      archive.pipe(output);

      // Add each asset to the ZIP under a folder named after the collection
      for (const asset of assets) {
        if (fs.existsSync(asset.file_path)) {
          archive.file(asset.file_path, {
            name: path.join(collection.name, asset.name),
          });
        }
      }

      archive.finalize();
    });
  }
}
