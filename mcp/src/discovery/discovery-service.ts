import { QueryGenerator } from './query-generator.js';
import { YouTubeFetcher, SearchResult, VideoDetails } from './youtube-fetcher.js';
import {
  insertDiscovery,
  getDiscoveryById,
  getDiscoveryByYoutubeId,
  listDiscoveries,
  getFavorites,
  toggleFavorite,
  updateNotes,
  updateDiscoveryMetadata,
  linkAsset,
  incrementListenCount,
  deleteDiscovery,
  Discovery,
} from '../queries/discoveries.js';
import { createPlaylist, addToPlaylist, getPlaylistItems, listPlaylists, removeFromPlaylist, deletePlaylist } from '../queries/discovery-playlists.js';
import { savePreset, loadPreset, listPresets, deletePreset as deletePresetDb, DiscoveryFilters } from '../queries/discovery-presets.js';
import { downloadAudio } from '../utils/youtube.js';

export interface DiscoveryResult {
  youtubeId: string;
  title: string;
  uploader: string | null;
  uploadDate: string | null;
  duration: number | null;
  viewCount: number | null;
  thumbnailUrl: string | null;
  description: string | null;
  discoveredVia: 'random' | 'search' | 'batch' | 'url';
  searchQuery?: string;
}

export class DiscoveryService {
  private queryGenerator = new QueryGenerator();
  private fetcher = new YouTubeFetcher();

  async rollDice(filters?: DiscoveryFilters): Promise<DiscoveryResult> {
    const query = this.queryGenerator.generateRandomQuery(filters);
    const results = await this.fetcher.searchVideos(query, 50);

    if (results.length === 0) {
      throw new Error('No videos found for random query');
    }

    const selected = this.queryGenerator.selectRandomResult(results, filters?.maxViews);
    return this.storeDiscovery(selected, 'random', query);
  }

  async search(query: string, filters?: DiscoveryFilters, limit: number = 20): Promise<DiscoveryResult[]> {
    const results = await this.fetcher.searchVideos(query, limit);

    if (results.length === 0) {
      return [];
    }

    const filtered = this.applyFilters(results, filters);
    return Promise.all(filtered.map((result) => this.storeDiscovery(result, 'search', query)));
  }

  async processUrl(url: string): Promise<DiscoveryResult> {
    // Extract YouTube ID from various URL formats
    const match = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/);
    if (!match) {
      throw new Error('Invalid YouTube URL');
    }

    const youtubeId = match[1];

    // Check if already discovered
    const existing = getDiscoveryByYoutubeId(youtubeId);
    if (existing) {
      return {
        youtubeId: existing.youtube_id,
        title: existing.title,
        uploader: existing.uploader,
        uploadDate: existing.upload_date,
        duration: existing.duration,
        viewCount: existing.view_count,
        thumbnailUrl: existing.thumbnail_url,
        description: existing.description,
        discoveredVia: existing.discovered_via as 'random' | 'search' | 'batch' | 'url',
      };
    }

    const details = await this.fetcher.getVideoDetails(youtubeId);
    return this.storeDiscovery(details, 'url');
  }

  async batchProcess(urls: string[]): Promise<DiscoveryResult[]> {
    const results: DiscoveryResult[] = [];

    for (const url of urls) {
      try {
        const result = await this.processUrl(url);
        results.push(result);
      } catch (err) {
        // Skip failed URLs
      }
    }

    return results;
  }

  // History & state
  getHistory(limit: number = 100): Discovery[] {
    return listDiscoveries(limit);
  }

  clearHistory(): void {
    const history = listDiscoveries(1000);
    for (const item of history) {
      deleteDiscovery(item.id);
    }
  }

  // Favorites
  toggleFavoritStatus(id: number): boolean {
    return toggleFavorite(id);
  }

  getFavoriteslist(): Discovery[] {
    return getFavorites();
  }

  // Playlists
  createPlaylistItem(name: string, description?: string): number {
    return createPlaylist(name, description);
  }

  addToPlaylistItem(playlistId: number, discoveryId: number): void {
    addToPlaylist(playlistId, discoveryId);
  }

  getPlaylistItemslist(playlistId: number): Discovery[] {
    return getPlaylistItems(playlistId);
  }

  listPlaylistsAll(): any[] {
    return listPlaylists();
  }

  removeFromPlaylistItem(playlistId: number, discoveryId: number): void {
    removeFromPlaylist(playlistId, discoveryId);
  }

  deletePlaylistItem(playlistId: number): void {
    deletePlaylist(playlistId);
  }

  // Notes
  updateNotesfor(id: number, notes: string): void {
    updateNotes(id, notes);
  }

  // Filter presets
  savePresetItem(name: string, filters: DiscoveryFilters): number {
    return savePreset(name, filters);
  }

  loadPresetItem(name: string): DiscoveryFilters | undefined {
    return loadPreset(name);
  }

  listPresetsAll(): any[] {
    return listPresets();
  }

  deletePresetItem(id: number): void {
    deletePresetDb(id);
  }

  // Import to library
  async importToLibrary(
    id: number,
    options?: {
      analyze?: boolean;
      stems?: boolean;
      midi?: boolean;
      collection?: number;
    }
  ): Promise<number> {
    // This is a stub — actual implementation in MCP tools will call back to analysis services
    throw new Error('Not implemented in discovery service — handle in MCP tools layer');
  }

  // Private helpers
  private async storeDiscovery(result: SearchResult | VideoDetails, via: 'random' | 'search' | 'batch' | 'url', query?: string): Promise<DiscoveryResult> {
    // Dedup check
    let existing = getDiscoveryByYoutubeId(result.id);
    if (existing) {
      return {
        youtubeId: existing.youtube_id,
        title: existing.title,
        uploader: existing.uploader,
        uploadDate: existing.upload_date,
        duration: existing.duration,
        viewCount: existing.view_count,
        thumbnailUrl: existing.thumbnail_url,
        description: existing.description,
        discoveredVia: via,
        searchQuery: query,
      };
    }

    const id = insertDiscovery({
      youtube_id: result.id,
      title: result.title,
      uploader: result.uploader,
      upload_date: result.upload_date,
      duration: result.duration,
      view_count: result.view_count,
      thumbnail_url: result.thumbnail,
      description: result.description,
      discovered_via: via,
      search_query: query,
    });

    return {
      youtubeId: result.id,
      title: result.title,
      uploader: result.uploader,
      uploadDate: result.upload_date,
      duration: result.duration,
      viewCount: result.view_count,
      thumbnailUrl: result.thumbnail,
      description: result.description,
      discoveredVia: via,
      searchQuery: query,
    };
  }

  private applyFilters(results: SearchResult[], filters?: DiscoveryFilters): SearchResult[] {
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
}
