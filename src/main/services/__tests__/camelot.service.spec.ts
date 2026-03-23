import { describe, it, expect } from 'vitest';
import { CamelotService } from '../camelot.service';

describe('CamelotService', () => {
  const service = new CamelotService();

  describe('getCode', () => {
    it('returns correct code for C major', () => {
      const code = service.getCode('C');
      expect(code).toBe('8B');
    });

    it('returns correct code for Am minor', () => {
      const code = service.getCode('Am');
      expect(code).toBe('8A');
    });

    it('returns correct code for Em', () => {
      const code = service.getCode('Em');
      expect(code).toBe('9A');
    });

    it('returns null for unknown key', () => {
      const code = service.getCode('Unknown');
      expect(code).toBeNull();
    });

    it('handles sharp keys', () => {
      const code = service.getCode('F#');
      expect(code).toBe('2B');
    });

    it('handles flat keys', () => {
      const code = service.getCode('Bb');
      expect(code).toBe('6B');
    });
  });

  describe('getCompatibleKeys', () => {
    it('returns matches for C major', () => {
      const matches = service.getCompatibleKeys('C');
      expect(matches.length).toBeGreaterThan(0);
      expect(matches[0].key).toBe('C');
      expect(matches[0].relationship).toBe('perfect');
    });

    it('includes relative key for major key', () => {
      const matches = service.getCompatibleKeys('C');
      const hasRelative = matches.some((m) => m.relationship === 'relative' && m.key === 'Am');
      expect(hasRelative).toBeTruthy();
    });

    it('includes relative key for minor key', () => {
      const matches = service.getCompatibleKeys('Am');
      const hasRelative = matches.some((m) => m.relationship === 'relative' && m.key === 'C');
      expect(hasRelative).toBeTruthy();
    });

    it('returns empty array for unknown key', () => {
      const matches = service.getCompatibleKeys('Unknown');
      expect(matches).toEqual([]);
    });

    it('sorts by relationship priority', () => {
      const matches = service.getCompatibleKeys('C');
      // Perfect should be first
      expect(matches[0].relationship).toBe('perfect');
      // Relative should come early
      const relativeIdx = matches.findIndex((m) => m.relationship === 'relative');
      expect(relativeIdx).toBeGreaterThan(0);
      expect(relativeIdx).toBeLessThan(4);
    });

    it('includes energy boost for A-side keys', () => {
      const matches = service.getCompatibleKeys('Am');
      const hasEnergyBoost = matches.some((m) => m.relationship === 'energy-boost');
      expect(hasEnergyBoost).toBeTruthy();
    });
  });

  describe('findCompatibleAssets', () => {
    it('finds compatible assets by key', () => {
      const assets = [
        { id: 1, key: 'C', name: 'Track 1' },
        { id: 2, key: 'Am', name: 'Track 2' },
        { id: 3, key: 'F', name: 'Track 3' },
      ];
      const results = service.findCompatibleAssets('C', assets);
      expect(results.length).toBeGreaterThan(0);
    });

    it('skips assets without key', () => {
      const assets = [
        { id: 1, key: 'C', name: 'Track 1' },
        { id: 2, name: 'No Key Track' }, // no key
      ];
      const results = service.findCompatibleAssets('C', assets);
      expect(results.every((r) => r.asset.key)).toBeTruthy();
    });

    it('sorts compatible assets by relationship priority', () => {
      const assets = [
        { id: 1, key: 'C', name: 'C Major' },
        { id: 2, key: 'Am', name: 'A Minor (relative)' },
        { id: 3, key: 'G', name: 'G Major (adjacent)' },
      ];
      const results = service.findCompatibleAssets('C', assets);

      // Perfect should be first, relative second
      if (results.length >= 2) {
        expect(results[0].match.key).toBe('C');
        expect(results[1].match.key).toBe('Am');
      }
    });

    it('returns empty array for unknown key', () => {
      const assets = [{ id: 1, key: 'C', name: 'Track 1' }];
      const results = service.findCompatibleAssets('Unknown', assets);
      expect(results).toEqual([]);
    });
  });
});
