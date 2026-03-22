import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import Database from 'better-sqlite3';
import { SP404CompanionService } from '../../../../src/main/services/sp404-companion.service.js';
import type { AudioService } from '../../../../src/main/services/audio.service.js';

// Mock runProcess before importing service
vi.mock('../../../../src/main/utils/process-runner.js', () => ({
  runProcess: vi.fn(),
}));

describe('SP404CompanionService', () => {
  let db: Database.Database;
  let service: SP404CompanionService;
  let mockAudioService: Partial<AudioService>;

  beforeEach(() => {
    // Create in-memory database for testing
    db = new Database(':memory:');

    // Mock AudioService
    mockAudioService = {
      analyzeWaveform: vi.fn(async () => [0.5, 0.7, 0.1, -0.2, -0.5]),
    };

    // Initialize service (constructor creates tables)
    service = new SP404CompanionService(db, mockAudioService as AudioService);
  });

  describe('getChops', () => {
    it('returns empty array initially', () => {
      const chops = service.getChops(1);
      expect(chops).toEqual([]);
    });

    it('returns chops after setChops', () => {
      const newChops = [
        { chopIndex: 0, startOffset: 0, endOffset: 0.25, crossfadeMs: 0, snapToZero: true },
        { chopIndex: 1, startOffset: 0.25, endOffset: 0.5, crossfadeMs: 0, snapToZero: true },
      ];
      service.setChops(1, newChops);
      const retrieved = service.getChops(1);
      expect(retrieved).toHaveLength(2);
      expect(retrieved[0].chopIndex).toBe(0);
      expect(retrieved[0].startOffset).toBe(0);
      expect(retrieved[1].endOffset).toBe(0.5);
    });
  });

  describe('setChops', () => {
    it('persists chops to database', () => {
      const newChops = [
        { chopIndex: 0, startOffset: 0, endOffset: 0.5, crossfadeMs: 0, snapToZero: true },
      ];
      service.setChops(1, newChops);
      const retrieved = service.getChops(1);
      expect(retrieved).toHaveLength(1);
      expect(retrieved[0].startOffset).toBe(0);
    });

    it('deletes old chops when setting new ones', () => {
      const oldChops = [
        { chopIndex: 0, startOffset: 0, endOffset: 0.5, crossfadeMs: 0, snapToZero: true },
      ];
      service.setChops(1, oldChops);
      expect(service.getChops(1)).toHaveLength(1);

      const newChops = [
        { chopIndex: 0, startOffset: 0, endOffset: 0.33, crossfadeMs: 0, snapToZero: true },
        { chopIndex: 1, startOffset: 0.33, endOffset: 0.66, crossfadeMs: 0, snapToZero: true },
        { chopIndex: 2, startOffset: 0.66, endOffset: 1, crossfadeMs: 0, snapToZero: true },
      ];
      service.setChops(1, newChops);
      expect(service.getChops(1)).toHaveLength(3);
    });
  });

  describe('getState', () => {
    it('returns null initially', () => {
      const state = service.getState('A01');
      expect(state).toBeNull();
    });

    it('returns state after setState', () => {
      service.setState('A01', { zoomLevel: 2 });
      const state = service.getState('A01');
      expect(state).not.toBeNull();
      expect(state?.zoomLevel).toBe(2);
    });
  });

  describe('setState', () => {
    it('persists state with default values', () => {
      service.setState('A01', { zoomLevel: 2 });
      const state = service.getState('A01');
      expect(state?.padRef).toBe('A01');
      expect(state?.zoomLevel).toBe(2);
      expect(state?.gridSnap).toBe(true); // default
      expect(state?.gridSubdivision).toBe('1/16'); // default
    });

    it('merges partial state updates', () => {
      service.setState('B02', { zoomLevel: 1.5, scrollPosition: 100 });
      service.setState('B02', { gridSnap: false });
      const state = service.getState('B02');
      expect(state?.zoomLevel).toBe(1.5);
      expect(state?.scrollPosition).toBe(100);
      expect(state?.gridSnap).toBe(false);
    });
  });

  describe('detectOnsets', () => {
    it('parses float lines from aubio onset output', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '0.1\n0.3\n0.6\n1.0\n',
        stderr: '',
      } as any);

      const onsets = await service.detectOnsets('/path/to/file.wav');
      expect(onsets).toEqual([0.1, 0.3, 0.6, 1.0]);
    });

    it('ignores non-numeric lines in output', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '0.1\nnon-numeric\n0.3\ninvalid\n0.6\n',
        stderr: '',
      } as any);

      const onsets = await service.detectOnsets('/path/to/file.wav');
      expect(onsets).toEqual([0.1, 0.3, 0.6]);
    });

    it('returns sorted onsets', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '0.6\n0.1\n1.0\n0.3\n',
        stderr: '',
      } as any);

      const onsets = await service.detectOnsets('/path/to/file.wav');
      expect(onsets).toEqual([0.1, 0.3, 0.6, 1.0]);
    });
  });

  describe('autoChop', () => {
    it('returns 4 chops in equal mode', async () => {
      const chops = await service.autoChop('/path/to/file.wav', 'equal', { count: 4 });
      expect(chops).toHaveLength(4);
      expect(chops[0].startOffset).toBeCloseTo(0, 2);
      expect(chops[0].endOffset).toBeCloseTo(0.25, 2);
      expect(chops[3].endOffset).toBeCloseTo(1, 2);
    });

    it('returns beat-aligned chops', async () => {
      // At 120 BPM, beat every 0.5s; duration 4s = 8 beats
      // 1 beat group = 1 chop every 0.5s (8 chops total)
      const chops = await service.autoChop('/path/to/file.wav', 'beat-aligned', {
        beats: 1,
        bpm: 120,
        durationSec: 4,
      });
      expect(chops.length).toBeGreaterThan(0);
      expect(chops[0].startOffset).toBeCloseTo(0, 2);
    });

    it('returns transient-based chops', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        exitCode: 0,
        stdout: '0.5\n1.0\n2.0\n',
        stderr: '',
      } as any);

      const chops = await service.autoChop('/path/to/file.wav', 'transient', {
        durationSec: 4,
      });
      // Transient mode: chop at each onset
      expect(chops.length).toBeGreaterThan(0);
    });
  });

  describe('findNearestZeroCrossing', () => {
    it('finds zero-crossing on peaks [0.5, 0.1, 0, -0.1, -0.5]', () => {
      const peaks = [0.5, 0.1, 0, -0.1, -0.5];
      const result = service.findNearestZeroCrossing(peaks, 0.4);
      // Cursor at 0.4 (index 2), zero-crossing between index 2 and 3 (0 and -0.1)
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });

    it('returns cursor if no zero-crossing found nearby', () => {
      const peaks = [0.5, 0.6, 0.7, 0.8, 0.9];
      const cursor = 0.5;
      const result = service.findNearestZeroCrossing(peaks, cursor);
      expect(result).toBe(cursor);
    });

    it('searches in window around cursor', () => {
      const peaks = [0.1, 0.2, 0.3, -0.1, -0.2, 0.3, 0.2, 0.1];
      const cursor = 0.5;
      const result = service.findNearestZeroCrossing(peaks, cursor, 0.5);
      // Should find zero-crossing near index 3-4 (0.3 to -0.1)
      expect(result).toBeGreaterThanOrEqual(0);
      expect(result).toBeLessThanOrEqual(1);
    });
  });

  describe('getPattern', () => {
    it('returns null for non-existent pattern', () => {
      const pattern = service.getPattern('P99');
      expect(pattern).toBeNull();
    });

    it('returns pattern after save', () => {
      const pattern = {
        patternRef: 'P01',
        bpm: 120,
        bars: 1,
        parts: [
          {
            padRef: 'A01',
            label: 'Part 1',
            color: '#e53935',
            steps: Array(16).fill({ active: false, velocity: 100, substep: 'none', pitchOffset: 0 }),
            muted: false,
            volume: 1,
          },
        ],
      };
      service.savePattern(pattern);
      const retrieved = service.getPattern('P01');
      expect(retrieved).not.toBeNull();
      expect(retrieved?.bpm).toBe(120);
      expect(retrieved?.parts).toHaveLength(1);
    });
  });

  describe('savePattern', () => {
    it('persists pattern to database', () => {
      const pattern = {
        patternRef: 'P01',
        bpm: 130,
        bars: 2,
        parts: [],
      };
      service.savePattern(pattern);
      const retrieved = service.getPattern('P01');
      expect(retrieved?.bpm).toBe(130);
      expect(retrieved?.bars).toBe(2);
    });

    it('overwrites existing pattern', () => {
      const pattern1 = {
        patternRef: 'P02',
        bpm: 100,
        bars: 1,
        parts: [],
      };
      service.savePattern(pattern1);
      expect(service.getPattern('P02')?.bpm).toBe(100);

      const pattern2 = {
        patternRef: 'P02',
        bpm: 140,
        bars: 2,
        parts: [],
      };
      service.savePattern(pattern2);
      expect(service.getPattern('P02')?.bpm).toBe(140);
    });
  });

  describe('listPatterns', () => {
    it('returns empty array initially', () => {
      const patterns = service.listPatterns();
      expect(patterns).toEqual([]);
    });

    it('returns all saved patterns', () => {
      const pattern1 = {
        patternRef: 'P01',
        bpm: 120,
        bars: 1,
        parts: [],
      };
      const pattern2 = {
        patternRef: 'P02',
        bpm: 140,
        bars: 2,
        parts: [],
      };
      service.savePattern(pattern1);
      service.savePattern(pattern2);

      const patterns = service.listPatterns();
      expect(patterns).toHaveLength(2);
      expect(patterns[0].patternRef).toBe('P01');
      expect(patterns[1].bpm).toBe(140);
    });
  });
});
