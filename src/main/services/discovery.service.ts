import { Database } from 'better-sqlite3';
import { app } from 'electron';
import * as fs from 'fs';
import * as path from 'path';
import { runProcess } from '../utils/process-runner.js';
import { FileService } from './file.service.js';
import { AudioService } from './audio.service.js';
import { CamelotService } from './camelot.service.js';

export interface Discovery {
  id?: number;
  youtube_id: string;
  title: string;
  uploader: string | null;
  upload_date: string | null;
  duration: number | null;
  view_count: number | null;
  thumbnail_url: string | null;
  description: string | null;
  bpm: number | null;
  key: string | null;
  time_signature: string | null;
  genre: string | null;
  style: string | null;
  region: string | null;
  year: number | null;
  label: string | null;
  discovered_via: 'random' | 'search' | 'batch' | 'url';
  search_query: string | null;
  notes: string | null;
  is_favorite: boolean;
  listen_count: number;
  last_listened_at: string | null;
  asset_id: number | null;
  imported_at: string | null;
  created_at?: string;
}

export interface DiscoveryFilters {
  genres?: string[];
  styles?: string[];
  regions?: string[];
  yearMin?: number;
  yearMax?: number;
  bpmMin?: number;
  bpmMax?: number;
  key?: string;
  maxViews?: number;
  minViews?: number;
  minDuration?: number;
  maxDuration?: number;
}

export class DiscoveryService {
  private db: Database;
  private fileService: FileService;
  private audioService: AudioService;
  private camelotService: CamelotService;

  constructor(db: Database, fileService: FileService, audioService: AudioService, camelotService: CamelotService) {
    this.db = db;
    this.fileService = fileService;
    this.audioService = audioService;
    this.camelotService = camelotService;
  }

  async rollDice(filters?: DiscoveryFilters): Promise<Discovery> {
    const query = this.generateRandomQuery(filters);
    const results = await this.searchYouTube(query, 50);

    if (results.length === 0) {
      throw new Error('No videos found for random query');
    }

    const selected = this.selectRandomResult(results, filters?.maxViews);
    return this.storeDiscovery(selected, 'random', query);
  }

  async search(query: string, filters?: DiscoveryFilters, limit: number = 20): Promise<Discovery[]> {
    const results = await this.searchYouTube(query, limit);

    if (results.length === 0) {
      return [];
    }

    const filtered = this.applyFilters(results, filters);
    return Promise.all(filtered.map((result) => this.storeDiscovery(result, 'search', query)));
  }

  async processUrl(url: string): Promise<Discovery> {
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    if (!match) {
      throw new Error('Invalid YouTube URL');
    }

    const youtubeId = match[1];

    // Check if already discovered
    const existing = this.db
      .prepare('SELECT * FROM discoveries WHERE youtube_id = ?')
      .get(youtubeId) as Discovery | undefined;

    if (existing) {
      return existing;
    }

    const details = await this.getVideoDetails(youtubeId);
    return this.storeDiscovery(details, 'url');
  }

  async batchProcess(urls: string[]): Promise<Discovery[]> {
    const results: Discovery[] = [];

    for (const url of urls) {
      try {
        const result = await this.processUrl(url);
        results.push(result);
      } catch {
        // Skip failed URLs
      }
    }

    return results;
  }

  async importToLibrary(
    discoveryId: number,
    options?: {
      analyze?: boolean;
      stems?: boolean;
      midi?: boolean;
      collection?: number;
    }
  ): Promise<number> {
    const discovery = this.db.prepare('SELECT * FROM discoveries WHERE id = ?').get(discoveryId) as Discovery | undefined;

    if (!discovery) {
      throw new Error(`Discovery ${discoveryId} not found`);
    }

    // Download audio
    const filePath = await this.downloadDiscovery(discovery);

    // Insert into assets
    const stmt = this.db.prepare(`
      INSERT INTO assets (name, file_path, file_type, file_size, duration, bpm, key, source, created_at)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'youtube', datetime('now'))
    `);

    const fileSize = fs.statSync(filePath).size;
    const assetResult = stmt.run(
      discovery.title,
      filePath,
      'wav',
      fileSize,
      discovery.duration,
      discovery.bpm,
      discovery.key
    );

    const assetId = assetResult.lastInsertRowid as number;

    // Link discovery to asset
    this.db.prepare('UPDATE discoveries SET asset_id = ?, imported_at = datetime(\'now\') WHERE id = ?').run(assetId, discoveryId);

    // Analyze if requested
    if (options?.analyze) {
      try {
        const bpm = await this.audioService.analyzeBPM(filePath);
        const key = await this.audioService.analyzeKey(filePath);
        this.db
          .prepare('UPDATE assets SET bpm = ?, key = ? WHERE id = ?')
          .run(bpm.bpm, key.key, assetId);
      } catch {
        // Analysis failed, continue
      }
    }

    // Add to collection if specified
    if (options?.collection) {
      this.db
        .prepare('INSERT OR IGNORE INTO collection_assets (collection_id, asset_id) VALUES (?, ?)')
        .run(options.collection, assetId);
    }

    return assetId;
  }

  getHistory(limit: number = 100): Discovery[] {
    const rows = this.db.prepare('SELECT * FROM discoveries ORDER BY created_at DESC LIMIT ?').all(limit) as any[];
    return rows.map((r) => ({ ...r, is_favorite: r.is_favorite === 1 }));
  }

  getFavorites(): Discovery[] {
    const rows = this.db.prepare('SELECT * FROM discoveries WHERE is_favorite = 1 ORDER BY created_at DESC').all() as any[];
    return rows.map((r) => ({ ...r, is_favorite: true }));
  }

  toggleFavorite(id: number): boolean {
    const current = this.db.prepare('SELECT is_favorite FROM discoveries WHERE id = ?').get(id) as { is_favorite: number } | undefined;

    if (!current) return false;

    const newValue = current.is_favorite === 0 ? 1 : 0;
    this.db.prepare('UPDATE discoveries SET is_favorite = ? WHERE id = ?').run(newValue, id);

    return newValue === 1;
  }

  updateNotes(id: number, notes: string): void {
    this.db.prepare('UPDATE discoveries SET notes = ? WHERE id = ?').run(notes, id);
  }

  createPlaylist(name: string, description?: string): number {
    const result = this.db
      .prepare("INSERT INTO discovery_playlists (name, description, created_at) VALUES (?, ?, datetime('now'))")
      .run(name, description ?? null);

    return result.lastInsertRowid as number;
  }

  addToPlaylist(playlistId: number, discoveryId: number): void {
    const maxPos = this.db
      .prepare('SELECT MAX(position) as max_pos FROM discovery_playlist_items WHERE playlist_id = ?')
      .get(playlistId) as { max_pos: number | null } | undefined;

    const position = (maxPos?.max_pos ?? -1) + 1;

    this.db
      .prepare(
        "INSERT OR IGNORE INTO discovery_playlist_items (playlist_id, discovery_id, position, added_at) VALUES (?, ?, ?, datetime('now'))"
      )
      .run(playlistId, discoveryId, position);
  }

  listPlaylists() {
    return this.db.prepare('SELECT * FROM discovery_playlists ORDER BY created_at DESC').all();
  }

  getPlaylistItems(playlistId: number): Discovery[] {
    return this.db
      .prepare(
        `
      SELECT d.* FROM discoveries d
      INNER JOIN discovery_playlist_items dpi ON d.id = dpi.discovery_id
      WHERE dpi.playlist_id = ?
      ORDER BY dpi.position ASC
    `
      )
      .all(playlistId) as Discovery[];
  }

  // Private helpers

  private generateRandomQuery(filters?: DiscoveryFilters): string {
    const genreSeeds: Record<string, string[]> = {
      funk: ['funk', 'deep funk', 'p-funk', 'afro funk'],
      soul: ['soul', 'northern soul', 'deep soul', 'quiet storm'],
      jazz: ['jazz', 'modal jazz', 'spiritual jazz', 'free jazz'],
      afrobeat: ['afrobeat', 'highlife', 'jùjú'],
      latin: ['latin', 'boogaloo', 'salsa', 'cumbia'],
      disco: ['disco', 'boogie', 'italo disco'],
      reggae: ['reggae', 'dub', 'roots reggae'],
      hiphop: ['boom bap', 'lo-fi hip hop', 'instrumental rap'],
      electronic: ['synth', 'electro', 'ambient'],
      world: ['world music', 'ethno', 'folk'],
    };

    const regions = ['japanese', 'brazilian', 'turkish', 'nigerian', 'colombian', 'ethiopian', 'ghanaian'];
    const decades = ['60s', '70s', '80s', '90s'];
    const modifiers = ['rare', 'obscure', 'deep cut', 'vinyl'];

    const parts: string[] = [];

    // Genre
    if (filters?.genres && filters.genres.length > 0) {
      const genre = filters.genres[Math.floor(Math.random() * filters.genres.length)];
      const seeds = genreSeeds[genre] ?? [];
      if (seeds.length > 0) {
        parts.push(seeds[Math.floor(Math.random() * seeds.length)]);
      }
    } else {
      const allGenres = Object.keys(genreSeeds);
      const genre = allGenres[Math.floor(Math.random() * allGenres.length)];
      const seeds = genreSeeds[genre];
      parts.push(seeds[Math.floor(Math.random() * seeds.length)]);
    }

    // Region
    if (filters?.regions && filters.regions.length > 0) {
      parts.push(filters.regions[Math.floor(Math.random() * filters.regions.length)]);
    } else if (Math.random() > 0.5) {
      parts.push(regions[Math.floor(Math.random() * regions.length)]);
    }

    // Decade
    if (!filters?.yearMin && !filters?.yearMax && Math.random() > 0.4) {
      parts.push(decades[Math.floor(Math.random() * decades.length)]);
    }

    // Modifier
    if (Math.random() > 0.6) {
      parts.push(modifiers[Math.floor(Math.random() * modifiers.length)]);
    }

    return parts.join(' ');
  }

  private async searchYouTube(query: string, maxResults: number): Promise<any[]> {
    const args = ['--dump-json', '--flat-playlist', `ytsearch${maxResults}:${query}`];
    const result = await runProcess('yt-dlp', args, { timeout: 30000 });

    if (result.exitCode !== 0) {
      throw new Error(`YouTube search failed: ${result.stderr}`);
    }

    const lines = result.stdout.trim().split('\n').filter((line) => line.length > 0);
    const videos: any[] = [];

    for (const line of lines) {
      try {
        const data = JSON.parse(line);
        videos.push({
          id: data.id ?? data.url,
          title: data.title ?? 'Unknown',
          uploader: data.uploader ?? null,
          upload_date: data.upload_date ?? null,
          duration: data.duration ?? null,
          view_count: data.view_count ?? null,
          thumbnail: data.thumbnail ?? null,
          description: data.description ?? null,
        });
      } catch {
        // Skip malformed lines
      }
    }

    return videos;
  }

  private async getVideoDetails(videoId: string): Promise<any> {
    const url = `https://www.youtube.com/watch?v=${videoId}`;
    const result = await runProcess('yt-dlp', ['-j', url], { timeout: 15000 });

    if (result.exitCode !== 0) {
      throw new Error(`Failed to fetch details for ${videoId}`);
    }

    const data = JSON.parse(result.stdout);
    return {
      id: videoId,
      title: data.title ?? 'Unknown',
      uploader: data.uploader ?? null,
      upload_date: data.upload_date ?? null,
      duration: data.duration ?? null,
      view_count: data.view_count ?? null,
      thumbnail: data.thumbnail ?? null,
      description: data.description ?? null,
    };
  }

  private selectRandomResult(results: any[], maxViews?: number): any {
    let filtered = results;
    if (maxViews !== undefined) {
      filtered = results.filter((r) => (r.view_count ?? 0) <= maxViews);
    }

    if (filtered.length === 0) {
      filtered = results;
    }

    filtered.sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0));
    const weights = filtered.map((_, idx) => Math.exp(-idx * 0.1));
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let random = Math.random() * totalWeight;

    for (let i = 0; i < filtered.length; i++) {
      random -= weights[i];
      if (random <= 0) return filtered[i];
    }

    return filtered[filtered.length - 1];
  }

  private applyFilters(results: any[], filters?: DiscoveryFilters): any[] {
    if (!filters) return results;

    return results.filter((result) => {
      if (filters.maxViews !== undefined && (result.view_count ?? 0) > filters.maxViews) {
        return false;
      }
      if (filters.minViews !== undefined && (result.view_count ?? 0) < filters.minViews) {
        return false;
      }
      if (filters.minDuration !== undefined && (result.duration ?? 0) < filters.minDuration) {
        return false;
      }
      if (filters.maxDuration !== undefined && (result.duration ?? 0) > filters.maxDuration) {
        return false;
      }
      return true;
    });
  }

  private async storeDiscovery(result: any, via: 'random' | 'search' | 'batch' | 'url', query?: string): Promise<Discovery> {
    // Dedup check
    let existing = this.db.prepare('SELECT * FROM discoveries WHERE youtube_id = ?').get(result.id) as Discovery | undefined;

    if (existing) {
      return existing;
    }

    const stmt = this.db.prepare(`
      INSERT INTO discoveries (
        youtube_id, title, uploader, upload_date, duration, view_count,
        thumbnail_url, description, discovered_via, search_query, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const insertResult = stmt.run(
      result.id,
      result.title,
      result.uploader,
      result.upload_date,
      result.duration,
      result.view_count,
      result.thumbnail,
      result.description,
      via,
      query
    );

    const id = insertResult.lastInsertRowid as number;

    return {
      id,
      youtube_id: result.id,
      title: result.title,
      uploader: result.uploader,
      upload_date: result.upload_date,
      duration: result.duration,
      view_count: result.view_count,
      thumbnail_url: result.thumbnail,
      description: result.description,
      bpm: null,
      key: null,
      time_signature: null,
      genre: null,
      style: null,
      region: null,
      year: null,
      label: null,
      discovered_via: via,
      search_query: query ?? null,
      notes: null,
      is_favorite: false,
      listen_count: 0,
      last_listened_at: null,
      asset_id: null,
      imported_at: null,
    };
  }

  private async downloadDiscovery(discovery: Discovery): Promise<string> {
    const youtubeDir = path.join(app.getPath('userData'), 'media', 'youtube-discovery');
    fs.mkdirSync(youtubeDir, { recursive: true });

    // Sanitize title for use as a filename
    const safeName = discovery.title
      .replace(/[/\\:*?"<>|]/g, '_')
      .replace(/\s+/g, ' ')
      .trim()
      .substring(0, 100);

    const outputTemplate = path.join(youtubeDir, `${safeName}_${discovery.youtube_id}.%(ext)s`);
    const expectedPath = path.join(youtubeDir, `${safeName}_${discovery.youtube_id}.wav`);

    const args = [
      '-x',
      '--audio-format', 'wav',
      '--audio-quality', '0',
      '--no-playlist',
      '-o', outputTemplate,
      `https://www.youtube.com/watch?v=${discovery.youtube_id}`,
    ];

    const result = await runProcess('yt-dlp', args, { timeout: 300000 });

    if (result.exitCode !== 0) {
      throw new Error(`Download failed: ${result.stderr}`);
    }

    // yt-dlp may report the destination in stdout; fall back to expected path
    const destMatch = result.stdout.match(/(?:\[ExtractAudio\]|\[download\]) Destination: (.+\.wav)/);
    if (destMatch && fs.existsSync(destMatch[1].trim())) {
      return destMatch[1].trim();
    }

    if (fs.existsSync(expectedPath)) {
      return expectedPath;
    }

    throw new Error('Could not locate downloaded file');
  }
}
