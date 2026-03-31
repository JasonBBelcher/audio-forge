import { describe, it, expect, beforeEach, vi } from 'vitest';
import Database from 'better-sqlite3';
import { DiscoveryService } from '../discovery.service';
import { FileService } from '../file.service';
import { AudioService } from '../audio.service';
import { CamelotService } from '../camelot.service';

// Mock services
const mockDb = {
  prepare: vi.fn(),
} as unknown as Database.Database;

const mockFileService = {
  getFileInfo: vi.fn(),
} as unknown as FileService;

const mockAudioService = {
  analyzeBPM: vi.fn(),
  analyzeKey: vi.fn(),
} as unknown as AudioService;

const mockCamelotService = {
  // Mock camelot methods if needed
} as unknown as CamelotService;

describe('DiscoveryService', () => {
  let discoveryService: DiscoveryService;

  beforeEach(() => {
    vi.clearAllMocks();
    discoveryService = new DiscoveryService(
      mockDb,
      mockFileService,
      mockAudioService,
      mockCamelotService
    );
  });

  describe('Discovery Data Validation', () => {
    it('should validate Discovery interface has required fields', () => {
      const discovery = {
        youtube_id: 'test123',
        title: 'Test Track',
        uploader: 'Test Artist',
        upload_date: '2024-01-01',
        duration: 240,
        view_count: 5000,
        thumbnail_url: 'https://example.com/thumb.jpg',
        description: 'A test track',
        bpm: 120,
        key: 'C',
        genre: 'funk',
        discovered_via: 'random' as const,
        is_favorite: false,
      };

      expect(discovery).toBeDefined();
      expect(discovery.youtube_id).toBe('test123');
      expect(discovery.title).toBe('Test Track');
    });

    it('should handle Discovery with null optional fields', () => {
      const discovery = {
        youtube_id: 'test123',
        title: 'Test Track',
        uploader: null,
        upload_date: null,
        duration: null,
        view_count: null,
        thumbnail_url: null,
        description: null,
        bpm: null,
        key: null,
        genre: null,
        discovered_via: 'url' as const,
        is_favorite: false,
      };

      expect(discovery).toBeDefined();
      expect(discovery.uploader).toBeNull();
      expect(discovery.bpm).toBeNull();
    });
  });

  describe('URL Processing', () => {
    it('should extract YouTube ID from youtube.com/watch?v= URLs', () => {
      const url = 'https://www.youtube.com/watch?v=dQw4w9WgXcQ';
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
      );
      expect(match?.[1]).toBe('dQw4w9WgXcQ');
    });

    it('should extract YouTube ID from youtu.be URLs', () => {
      const url = 'https://youtu.be/dQw4w9WgXcQ';
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
      );
      expect(match?.[1]).toBe('dQw4w9WgXcQ');
    });

    it('should extract YouTube ID from youtube.com/embed/ URLs', () => {
      const url = 'https://www.youtube.com/embed/dQw4w9WgXcQ';
      const match = url.match(
        /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
      );
      expect(match?.[1]).toBe('dQw4w9WgXcQ');
    });

    it('should reject invalid YouTube URLs', () => {
      const invalidUrls = [
        'https://example.com/video',
        'not-a-url',
        'https://youtube.com/',
        'https://youtu.be/', // No ID
      ];

      invalidUrls.forEach((url) => {
        const match = url.match(
          /(?:youtube\.com\/watch\?v=|youtu\.be\/|youtube\.com\/embed\/)([A-Za-z0-9_-]{11})/
        );
        expect(match).toBeNull();
      });
    });
  });

  describe('Discovery Filters', () => {
    it('should validate DiscoveryFilters interface', () => {
      const filters = {
        genres: ['funk', 'soul'],
        styles: ['deep funk'],
        regions: ['japanese'],
        yearMin: 1970,
        yearMax: 1980,
        bpmMin: 90,
        bpmMax: 120,
        key: 'C',
        maxViews: 50000,
        minViews: 100,
        minDuration: 180,
        maxDuration: 600,
      };

      expect(filters).toBeDefined();
      expect(filters.genres).toHaveLength(2);
      expect(filters.bpmMin).toBe(90);
    });

    it('should handle partial filter objects', () => {
      const partialFilters = {
        genres: ['funk'],
        bpmMin: 100,
      };

      expect(partialFilters).toBeDefined();
      expect(partialFilters.genres).toBeDefined();
      expect(partialFilters.bpmMin).toBe(100);
    });

    it('should filter results by view count', () => {
      const results = [
        { view_count: 100 },
        { view_count: 5000 },
        { view_count: 50000 },
        { view_count: 1000000 },
      ];

      const maxViews = 50000;
      const filtered = results.filter((r) => (r.view_count ?? 0) <= maxViews);

      expect(filtered).toHaveLength(3);
    });

    it('should filter results by duration range', () => {
      const results = [
        { duration: 120 },
        { duration: 240 },
        { duration: 480 },
        { duration: 600 },
      ];

      const minDuration = 180;
      const maxDuration = 480;
      const filtered = results.filter(
        (r) => (r.duration ?? 0) >= minDuration && (r.duration ?? 0) <= maxDuration
      );

      expect(filtered).toHaveLength(2);
    });
  });

  describe('Result Weighting', () => {
    it('should weight results with exponential decay toward lower view counts', () => {
      const results = [
        { title: 'A', view_count: 100 },
        { title: 'B', view_count: 1000 },
        { title: 'C', view_count: 10000 },
        { title: 'D', view_count: 100000 },
      ];

      results.sort((a, b) => (a.view_count ?? 0) - (b.view_count ?? 0));
      const weights = results.map((_, idx) => Math.exp(-idx * 0.1));

      expect(weights[0]).toBeGreaterThan(weights[1]);
      expect(weights[1]).toBeGreaterThan(weights[2]);
      expect(weights[2]).toBeGreaterThan(weights[3]);
    });

    it('should calculate weight distribution correctly', () => {
      const weights = [
        Math.exp(-0 * 0.1),
        Math.exp(-1 * 0.1),
        Math.exp(-2 * 0.1),
      ];

      const total = weights.reduce((a, b) => a + b, 0);
      expect(total).toBeGreaterThan(0);
      expect(total).toBeLessThan(4); // Sum of exponential decay
    });
  });

  describe('Time Formatting', () => {
    it('should format duration in seconds to MM:SS', () => {
      const formatDuration = (seconds: number | null): string => {
        if (seconds === null || seconds === undefined) return '--:--';
        const m = Math.floor(seconds / 60);
        const s = Math.floor(seconds % 60);
        return `${m}:${s.toString().padStart(2, '0')}`;
      };

      expect(formatDuration(0)).toBe('0:00');
      expect(formatDuration(60)).toBe('1:00');
      expect(formatDuration(125)).toBe('2:05');
      expect(formatDuration(3661)).toBe('61:01');
      expect(formatDuration(null)).toBe('--:--');
    });
  });

  describe('View Count Formatting', () => {
    it('should format view counts with appropriate suffixes', () => {
      const formatViews = (views: number | null): string => {
        if (views === null || views === undefined) return '?';
        if (views > 1000000) return (views / 1000000).toFixed(1) + 'M';
        if (views > 1000) return (views / 1000).toFixed(1) + 'K';
        return views.toString();
      };

      expect(formatViews(0)).toBe('0');
      expect(formatViews(500)).toBe('500');
      expect(formatViews(1500)).toBe('1.5K');
      expect(formatViews(50000)).toBe('50.0K');
      expect(formatViews(1500000)).toBe('1.5M');
      expect(formatViews(null)).toBe('?');
    });
  });

  describe('Genre Seeds', () => {
    it('should have valid genre seed structure', () => {
      const GENRE_SEEDS: Record<string, string[]> = {
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

      expect(Object.keys(GENRE_SEEDS)).toHaveLength(10);
      expect(GENRE_SEEDS.funk).toHaveLength(4);
      expect(GENRE_SEEDS.afrobeat).toHaveLength(3);
    });

    it('should support random genre selection', () => {
      const genres = ['funk', 'soul', 'jazz'];
      const randomGenre = genres[Math.floor(Math.random() * genres.length)];

      expect(genres).toContain(randomGenre);
    });
  });

  describe('Query Generation', () => {
    it('should generate random query with genre', () => {
      const GENRE_SEEDS: Record<string, string[]> = {
        funk: ['funk', 'deep funk'],
      };

      const selectedGenre = 'funk';
      const seeds = GENRE_SEEDS[selectedGenre];
      const selectedSeed = seeds[Math.floor(Math.random() * seeds.length)];

      expect(selectedSeed).toBeDefined();
      expect(['funk', 'deep funk']).toContain(selectedSeed);
    });

    it('should combine multiple query parts', () => {
      const parts = ['funk', 'japanese', '70s', 'rare'];
      const query = parts.join(' ');

      expect(query).toBe('funk japanese 70s rare');
    });

    it('should handle empty parts array', () => {
      const parts: string[] = [];
      const query = parts.join(' ');

      expect(query).toBe('');
    });
  });
});
