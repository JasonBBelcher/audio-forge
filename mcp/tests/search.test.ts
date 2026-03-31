import { describe, it, expect, beforeAll } from 'vitest';
import { buildSearchIndex, searchAssets } from '../src/search.js';
import type { Asset } from '../src/queries/assets.js';

const mockAssets: Asset[] = [
  {
    id: 1,
    name: 'electronic-beat',
    file_path: '/beats/electronic.wav',
    file_type: 'wav',
    file_size: 1000000,
    duration: 120,
    sample_rate: 44100,
    channels: 2,
    bpm: 120,
    key: 'C major',
    role: 'drums',
    tags: 'electronic,dance,loop',
    source: 'recorded',
    analyzed_at: '2025-01-01',
    waveform_peaks: null,
    created_at: '2025-01-01',
  },
  {
    id: 2,
    name: 'ambient-pad',
    file_path: '/pads/ambient.wav',
    file_type: 'wav',
    file_size: 2000000,
    duration: 240,
    sample_rate: 44100,
    channels: 2,
    bpm: null,
    key: 'G minor',
    role: null,
    tags: 'ambient,experimental',
    source: 'generated',
    analyzed_at: '2025-01-02',
    waveform_peaks: null,
    created_at: '2025-01-02',
  },
  {
    id: 3,
    name: 'jazz-drums',
    file_path: '/drums/jazz.wav',
    file_type: 'wav',
    file_size: 800000,
    duration: 180,
    sample_rate: 48000,
    channels: 2,
    bpm: 95,
    key: 'F major',
    role: 'drums',
    tags: 'jazz,acoustic,drums',
    source: 'youtube',
    analyzed_at: '2025-01-03',
    waveform_peaks: null,
    created_at: '2025-01-03',
  },
];

describe('search', () => {
  beforeAll(() => {
    buildSearchIndex(mockAssets);
  });

  it('searches by asset name', () => {
    const results = searchAssets('electronic', 10);
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].name).toContain('electronic');
  });

  it('searches by tags', () => {
    const results = searchAssets('jazz', 10);
    expect(results.some((r) => r.tags?.includes('jazz'))).toBe(true);
  });

  it('performs fuzzy matching', () => {
    const results = searchAssets('elctron', 10); // Typo
    expect(results.some((r) => r.name.includes('electronic'))).toBe(true);
  });

  it('respects search limit', () => {
    const results = searchAssets('wav', 2);
    expect(results.length).toBeLessThanOrEqual(2);
  });

  it('includes relevance scores', () => {
    const results = searchAssets('drums', 10);
    expect(results[0].score).toBeDefined();
    expect(results[0].score).toBeGreaterThan(0);
    expect(results[0].score).toBeLessThanOrEqual(1);
  });

  it('weights name higher than tags', () => {
    const results = searchAssets('beat', 10);
    const nameMatch = results.find((r) => r.name.includes('beat'));
    if (nameMatch && results.length > 1) {
      expect(results[0].id).toBe(nameMatch.id);
    }
  });

  it('returns empty for non-matching query', () => {
    const results = searchAssets('nonexistent12345', 10);
    expect(results.length).toBe(0);
  });

  it('handles special characters in search', () => {
    const results = searchAssets('hello@world', 10);
    expect(Array.isArray(results)).toBe(true);
  });
});
