import Database from 'better-sqlite3';
import { createDatabase } from '../database/connection.js';
import { runProcess } from '../utils/process-runner.js';

export interface PlatformIntegration {
  id: string;
  name: string;
  status: 'registered' | 'authorized' | 'unauthorized' | 'failed';
  created_at: string;
}

export interface PlatformCredentials {
  id: string;
  name: string;
  clientId: string;
  clientSecret: string;
  redirectUri: string;
  status: 'registered' | 'authorized' | 'unauthorized';
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresIn: number;
  tokenType?: string;
}

export interface PublishMetadata {
  title: string;
  description?: string;
  tags?: string[];
  isPublic?: boolean;
  genre?: string;
  artwork?: string;
}

export interface PublishedTrack {
  id: string;
  title: string;
  platformId: string;
  platformUrl: string;
  published_at: string;
}

export interface UserProfile {
  id: string;
  displayName: string;
  email?: string;
  followers?: number;
  profileUrl?: string;
}

export interface PlaylistInfo {
  id: string;
  name: string;
  trackCount?: number;
  url?: string;
}

export interface PublishHistoryEntry {
  id: string;
  platformId: string;
  trackTitle: string;
  trackPath: string;
  platformUrl: string;
  published_at: string;
}

export class PlatformService {
  private db: Database.Database;

  constructor(dbPath: string = ':memory:') {
    this.db = createDatabase(dbPath);
    this.initializeSchema();
  }

  private initializeSchema(): void {
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS platform_integrations (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        clientId TEXT NOT NULL,
        clientSecret TEXT NOT NULL,
        redirectUri TEXT NOT NULL,
        status TEXT DEFAULT 'registered',
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP
      );

      CREATE TABLE IF NOT EXISTS oauth_tokens (
        id TEXT PRIMARY KEY,
        platformId TEXT NOT NULL,
        accessToken TEXT NOT NULL,
        refreshToken TEXT,
        expiresAt DATETIME,
        tokenType TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (platformId) REFERENCES platform_integrations(id)
      );

      CREATE TABLE IF NOT EXISTS publish_history (
        id TEXT PRIMARY KEY,
        platformId TEXT NOT NULL,
        trackTitle TEXT NOT NULL,
        trackPath TEXT NOT NULL,
        platformUrl TEXT NOT NULL,
        published_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (platformId) REFERENCES platform_integrations(id)
      );

      CREATE INDEX IF NOT EXISTS idx_platform_name ON platform_integrations(name);
      CREATE INDEX IF NOT EXISTS idx_oauth_platformId ON oauth_tokens(platformId);
      CREATE INDEX IF NOT EXISTS idx_publish_platformId ON publish_history(platformId);
    `);
  }

  async registerIntegration(config: {
    name: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
  }): Promise<PlatformIntegration> {
    const id = `plat_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO platform_integrations (id, name, clientId, clientSecret, redirectUri, status, created_at)
      VALUES (?, ?, ?, ?, ?, 'registered', ?)
    `);

    stmt.run(id, config.name, config.clientId, config.clientSecret, config.redirectUri, now);

    return {
      id,
      name: config.name,
      status: 'registered',
      created_at: now,
    };
  }

  async getIntegrationCredentials(platformId: string): Promise<PlatformCredentials | undefined> {
    const stmt = this.db.prepare('SELECT * FROM platform_integrations WHERE id = ?');
    return stmt.get(platformId) as PlatformCredentials | undefined;
  }

  async authorizeWithCode(platformId: string, authCode: string): Promise<OAuthToken> {
    const creds = await this.getIntegrationCredentials(platformId);
    if (!creds) {
      throw new Error(`Platform ${platformId} not found`);
    }

    // Simulate token exchange
    if (!authCode || authCode.includes('invalid')) {
      throw new Error('Invalid authorization code');
    }

    const accessToken = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const refreshToken = `refresh_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresIn = 3600;
    const tokenId = `token_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const stmt = this.db.prepare(`
      INSERT INTO oauth_tokens (id, platformId, accessToken, refreshToken, expiresAt, tokenType, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 'Bearer', ?, ?)
    `);

    stmt.run(tokenId, platformId, accessToken, refreshToken, expiresAt, now, now);

    // Update platform status
    const updateStmt = this.db.prepare('UPDATE platform_integrations SET status = ? WHERE id = ?');
    updateStmt.run('authorized', platformId);

    return { accessToken, refreshToken, expiresIn };
  }

  async refreshToken(platformId: string): Promise<OAuthToken> {
    const tokenStmt = this.db.prepare(`
      SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1
    `);
    const token = tokenStmt.get(platformId) as any;

    if (!token) {
      throw new Error(`No token found for platform ${platformId}`);
    }

    const newAccessToken = `access_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const expiresIn = 3600;
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString();

    const updateStmt = this.db.prepare(`
      UPDATE oauth_tokens
      SET accessToken = ?, expiresAt = ?, updated_at = ?
      WHERE id = ?
    `);

    updateStmt.run(newAccessToken, expiresAt, now, token.id);

    return { accessToken: newAccessToken, refreshToken: token.refreshToken, expiresIn };
  }

  async publishTrack(
    platformId: string,
    trackPath: string,
    metadata: PublishMetadata
  ): Promise<PublishedTrack> {
    const token = this.db
      .prepare('SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1')
      .get(platformId) as any;

    if (!token) {
      throw new Error(`Not authorized for platform ${platformId}`);
    }

    const publishId = `pub_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    const now = new Date().toISOString();
    const platformUrl = `https://platform.example.com/tracks/${publishId}`;

    const stmt = this.db.prepare(`
      INSERT INTO publish_history (id, platformId, trackTitle, trackPath, platformUrl, published_at)
      VALUES (?, ?, ?, ?, ?, ?)
    `);

    stmt.run(publishId, platformId, metadata.title, trackPath, platformUrl, now);

    return {
      id: publishId,
      title: metadata.title,
      platformId,
      platformUrl,
      published_at: now,
    };
  }

  async getUserProfile(platformId: string): Promise<UserProfile> {
    const token = this.db
      .prepare('SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1')
      .get(platformId) as any;

    if (!token) {
      throw new Error(`Not authorized for platform ${platformId}`);
    }

    const userId = `user_${Date.now()}`;
    return {
      id: userId,
      displayName: 'Test User',
      email: 'user@platform.com',
      followers: 1250,
      profileUrl: `https://platform.example.com/users/${userId}`,
    };
  }

  async searchTracks(platformId: string, query: string): Promise<any[]> {
    const token = this.db
      .prepare('SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1')
      .get(platformId) as any;

    if (!token) {
      throw new Error(`Not authorized for platform ${platformId}`);
    }

    return [
      { id: 'track-1', name: `Result for "${query}" 1`, artist: 'Artist 1' },
      { id: 'track-2', name: `Result for "${query}" 2`, artist: 'Artist 2' },
    ];
  }

  async getPlaylists(platformId: string): Promise<PlaylistInfo[]> {
    const token = this.db
      .prepare('SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1')
      .get(platformId) as any;

    if (!token) {
      throw new Error(`Not authorized for platform ${platformId}`);
    }

    return [
      { id: 'playlist-1', name: 'My Favorites', trackCount: 42, url: 'https://platform.example.com/playlists/1' },
      { id: 'playlist-2', name: 'New Music', trackCount: 15, url: 'https://platform.example.com/playlists/2' },
    ];
  }

  async addToPlaylist(platformId: string, playlistId: string, trackId: string): Promise<boolean> {
    const token = this.db
      .prepare('SELECT * FROM oauth_tokens WHERE platformId = ? ORDER BY created_at DESC LIMIT 1')
      .get(platformId) as any;

    if (!token) {
      throw new Error(`Not authorized for platform ${platformId}`);
    }

    return true;
  }

  async revokeAuthorization(platformId: string): Promise<void> {
    const deleteStmt = this.db.prepare('DELETE FROM oauth_tokens WHERE platformId = ?');
    deleteStmt.run(platformId);

    const updateStmt = this.db.prepare('UPDATE platform_integrations SET status = ? WHERE id = ?');
    updateStmt.run('unauthorized', platformId);
  }

  async getPublishHistory(platformId: string): Promise<PublishHistoryEntry[]> {
    const stmt = this.db.prepare(`
      SELECT * FROM publish_history
      WHERE platformId = ?
      ORDER BY published_at DESC
    `);

    return stmt.all(platformId) as PublishHistoryEntry[];
  }

  async listIntegrations(): Promise<PlatformIntegration[]> {
    const stmt = this.db.prepare('SELECT id, name, status, created_at FROM platform_integrations ORDER BY created_at DESC');
    return stmt.all() as PlatformIntegration[];
  }
}
