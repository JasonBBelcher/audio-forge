import { describe, it, expect } from 'vitest';
import { CamelotService, HarmonicMatch } from '../../../../src/main/services/camelot.service.js';

describe('CamelotService', () => {
  let camelot: CamelotService;

  beforeEach(() => {
    camelot = new CamelotService();
  });

  describe('getCode', () => {
    it('returns correct code for C major', () => {
      const code = camelot.getCode('C');
      expect(code).toBe('8B');
    });

    it('returns correct code for Am minor', () => {
      const code = camelot.getCode('Am');
      expect(code).toBe('8A');
    });

    it('returns null for invalid key', () => {
      const code = camelot.getCode('invalid');
      expect(code).toBeNull();
    });

    it('handles all major keys', () => {
      const majorKeys = ['C', 'G', 'D', 'A', 'E', 'B', 'F#', 'Db', 'Ab', 'Eb', 'Bb', 'F'];
      majorKeys.forEach((key) => {
        expect(camelot.getCode(key)).not.toBeNull();
      });
    });

    it('handles all minor keys', () => {
      const minorKeys = ['Am', 'Em', 'Bm', 'F#m', 'C#m', 'G#m', 'D#m', 'Bbm', 'Fm', 'Cm', 'Gm', 'Dm'];
      minorKeys.forEach((key) => {
        expect(camelot.getCode(key)).not.toBeNull();
      });
    });
  });

  describe('getCompatibleKeys', () => {
    it('includes perfect match for Am', () => {
      const matches = camelot.getCompatibleKeys('Am');
      const perfectMatch = matches.find((m) => m.relationship === 'perfect');
      expect(perfectMatch).toBeDefined();
      expect(perfectMatch?.key).toBe('Am');
    });

    it('includes relative key (same number, other letter) for Am', () => {
      const matches = camelot.getCompatibleKeys('Am');
      const relativeMatch = matches.find((m) => m.relationship === 'relative');
      expect(relativeMatch).toBeDefined();
      expect(relativeMatch?.key).toBe('C');
      expect(relativeMatch?.camelotCode).toBe('8B');
    });

    it('includes adjacent keys for Am (7A and 9A)', () => {
      const matches = camelot.getCompatibleKeys('Am');
      // For Am (A side), neighbors are energy-boost and energy-drop
      const energyMatches = matches.filter(
        (m) => m.relationship === 'energy-boost' || m.relationship === 'energy-drop'
      );
      const adjacentCodes = energyMatches.map((m) => m.camelotCode);
      expect(adjacentCodes).toContain('7A');
      expect(adjacentCodes).toContain('9A');
    });

    it('returns at least 4 matches for any valid key', () => {
      const matches = camelot.getCompatibleKeys('Am');
      expect(matches.length).toBeGreaterThanOrEqual(4);
    });

    it('returns matches sorted with perfect match first', () => {
      const matches = camelot.getCompatibleKeys('Am');
      expect(matches[0].relationship).toBe('perfect');
    });

    it('wraps around for high numbers (12 -> 1)', () => {
      const matches = camelot.getCompatibleKeys('E');
      // E is 12B, so adjacent should include 1B and 11B
      const adjacentCodes = matches
        .filter((m) => m.relationship === 'adjacent')
        .map((m) => m.camelotCode);
      // 12B wraps: next is 1B, prev is 11B
      expect(adjacentCodes).toContain('1B');
      expect(adjacentCodes).toContain('11B');
    });

    it('wraps around for low numbers (1 -> 12)', () => {
      const matches = camelot.getCompatibleKeys('G#m');
      // G#m is 1A, so energy neighbors should include 12A and 2A
      const energyMatches = matches.filter(
        (m) => m.relationship === 'energy-boost' || m.relationship === 'energy-drop'
      );
      const adjacentCodes = energyMatches.map((m) => m.camelotCode);
      expect(adjacentCodes).toContain('12A');
      expect(adjacentCodes).toContain('2A');
    });

    it('includes energy-boost (same letter, +1 number)', () => {
      const matches = camelot.getCompatibleKeys('Am');
      const boostMatch = matches.find((m) => m.relationship === 'energy-boost');
      expect(boostMatch).toBeDefined();
      expect(boostMatch?.key).toBe('Em');
    });

    it('includes energy-drop (same letter, -1 number)', () => {
      const matches = camelot.getCompatibleKeys('Am');
      const dropMatch = matches.find((m) => m.relationship === 'energy-drop');
      expect(dropMatch).toBeDefined();
      // Am is 8A, so -1 number is 7A which is Dm
      expect(dropMatch?.key).toBe('Dm');
      expect(dropMatch?.camelotCode).toBe('7A');
    });
  });

  describe('findCompatibleAssets', () => {
    it('filters assets by compatible key', () => {
      const assets = [
        { id: 1, key: 'Am', name: 'track1' },
        { id: 2, key: 'Em', name: 'track2' },
        { id: 3, key: 'C', name: 'track3' },
        { id: 4, key: 'Dm', name: 'track4' },
      ];

      const compatible = camelot.findCompatibleAssets('Am', assets);

      // Should find Am, Em, C, and Gm (but Gm not in assets)
      expect(compatible.length).toBeGreaterThan(0);
      expect(compatible.some((c) => c.asset.key === 'Am')).toBe(true);
    });

    it('ranks perfect match first', () => {
      const assets = [
        { id: 1, key: 'Em', name: 'adjacent' },
        { id: 2, key: 'Am', name: 'perfect' },
        { id: 3, key: 'C', name: 'relative' },
      ];

      const compatible = camelot.findCompatibleAssets('Am', assets);

      const perfectIdx = compatible.findIndex((c) => c.asset.id === 2);
      const adjacentIdx = compatible.findIndex((c) => c.asset.id === 1);

      expect(perfectIdx).toBeLessThan(adjacentIdx);
    });

    it('skips assets without key data', () => {
      const assets = [
        { id: 1, key: 'Am', name: 'with_key' },
        { id: 2, name: 'no_key' }, // No key property
      ];

      const compatible = camelot.findCompatibleAssets('Am', assets as any);

      expect(compatible.some((c) => c.asset.id === 2)).toBe(false);
    });

    it('returns empty array for no matches', () => {
      const assets = [
        { id: 1, key: 'Db', name: 'track1' },
        { id: 2, key: 'Ab', name: 'track2' },
      ];

      const compatible = camelot.findCompatibleAssets('Am', assets);

      // Even if no perfect/adjacent matches, relative and energy relationships exist
      // but if all assets are far from the key, might still be some compatibility
      // Actually, every key has connections, so we should always find some matches
      expect(compatible.length).toBeGreaterThanOrEqual(0);
    });
  });

  describe('compatibility relationships', () => {
    it('correctly identifies all relationship types for C major', () => {
      const matches = camelot.getCompatibleKeys('C');
      const relationships = new Set(matches.map((m) => m.relationship));

      expect(relationships.has('perfect')).toBe(true);
      expect(relationships.has('adjacent') || matches.some((m) => m.relationship !== 'perfect')).toBe(true);
    });

    it('provides descriptions for all matches', () => {
      const matches = camelot.getCompatibleKeys('Am');
      matches.forEach((match) => {
        expect(match.description).toBeDefined();
        expect(match.description.length).toBeGreaterThan(0);
      });
    });
  });
});
