import { describe, it, expect } from 'vitest';
import { getCamelotCode, getCompatibleKeys } from '../src/utils/camelot.js';

describe('camelot', () => {
  it('maps C major to 8B', () => {
    const code = getCamelotCode('C major');
    expect(code).toBe('8B');
  });

  it('maps A minor to 8A', () => {
    const code = getCamelotCode('A minor');
    expect(code).toBe('8A');
  });

  it('maps multiple major keys', () => {
    const majorKeys = ['C major', 'D-flat major', 'E-flat major', 'F major', 'A-flat major', 'B major'];
    for (const key of majorKeys) {
      expect(getCamelotCode(key)).toBeTruthy();
    }
  });

  it('maps all 12 minor keys', () => {
    const minorKeys = ['A minor', 'E minor', 'B minor', 'F# minor', 'C# minor', 'G# minor',
      'D# minor', 'Bb minor', 'F minor', 'C minor', 'G minor', 'D minor'];
    for (const key of minorKeys) {
      expect(getCamelotCode(key)).toBeTruthy();
    }
  });

  it('returns null for unknown key', () => {
    const code = getCamelotCode('Z major');
    expect(code).toBeNull();
  });

  it('gets compatible keys for C major', () => {
    const compatible = getCompatibleKeys('C major');
    expect(compatible.length).toBeGreaterThan(0);
    expect(compatible.some((k) => k.type === 'perfect')).toBe(true);
    expect(compatible.some((k) => k.type === 'adjacent')).toBe(true);
    expect(compatible.some((k) => k.type === 'relative')).toBe(true);
  });

  it('includes perfect match (same key)', () => {
    const compatible = getCompatibleKeys('C major');
    const perfect = compatible.find((k) => k.type === 'perfect');
    expect(perfect?.key).toBe('C major');
    expect(perfect?.camelot).toBe('8B');
  });

  it('includes relative major/minor', () => {
    const compatible = getCompatibleKeys('C major');
    const relative = compatible.find((k) => k.type === 'relative');
    expect(relative?.key).toBe('A minor');
  });

  it('includes energy boost (+7 semitones)', () => {
    const compatible = getCompatibleKeys('C major');
    const boost = compatible.find((k) => k.type === 'energy_boost');
    expect(boost).toBeDefined();
  });

  it('includes adjacent keys on wheel', () => {
    const compatible = getCompatibleKeys('A minor');
    const adjacent = compatible.filter((k) => k.type === 'adjacent');
    expect(adjacent.length).toBeGreaterThan(0);
    for (const adj of adjacent) {
      expect(adj.camelot).toBeTruthy();
    }
  });

  it('finds compatible keys for both major and minor', () => {
    const compatMajor = getCompatibleKeys('C major');
    const compatMinor = getCompatibleKeys('A minor');
    expect(compatMajor.length).toBeGreaterThan(0);
    expect(compatMinor.length).toBeGreaterThan(0);
  });

  it('handles enharmonic spellings', () => {
    const cSharp = getCamelotCode('C# minor');
    const dFlat = getCamelotCode('D-flat minor');
    expect(cSharp).toBe(dFlat);
  });

  it('returns unknown key as null', () => {
    const compatible = getCompatibleKeys('Unknown Key');
    expect(compatible.length).toBe(0);
  });
});
