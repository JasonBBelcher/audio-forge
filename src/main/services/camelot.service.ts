/**
 * CamelotService provides harmonic mixing suggestions using the Camelot Wheel.
 * Maps musical keys to Camelot codes (1A–12B) for DJ/producer mixing.
 */

const CAMELOT_MAP: Record<
  string,
  { code: string; number: number; letter: 'A' | 'B' }
> = {
  C: { code: '8B', number: 8, letter: 'B' },
  G: { code: '9B', number: 9, letter: 'B' },
  D: { code: '10B', number: 10, letter: 'B' },
  A: { code: '11B', number: 11, letter: 'B' },
  E: { code: '12B', number: 12, letter: 'B' },
  B: { code: '1B', number: 1, letter: 'B' },
  'F#': { code: '2B', number: 2, letter: 'B' },
  Db: { code: '3B', number: 3, letter: 'B' },
  Ab: { code: '4B', number: 4, letter: 'B' },
  Eb: { code: '5B', number: 5, letter: 'B' },
  Bb: { code: '6B', number: 6, letter: 'B' },
  F: { code: '7B', number: 7, letter: 'B' },
  Am: { code: '8A', number: 8, letter: 'A' },
  Em: { code: '9A', number: 9, letter: 'A' },
  Bm: { code: '10A', number: 10, letter: 'A' },
  'F#m': { code: '11A', number: 11, letter: 'A' },
  'C#m': { code: '12A', number: 12, letter: 'A' },
  'G#m': { code: '1A', number: 1, letter: 'A' },
  'D#m': { code: '2A', number: 2, letter: 'A' },
  Bbm: { code: '3A', number: 3, letter: 'A' },
  Fm: { code: '4A', number: 4, letter: 'A' },
  Cm: { code: '5A', number: 5, letter: 'A' },
  Gm: { code: '6A', number: 6, letter: 'A' },
  Dm: { code: '7A', number: 7, letter: 'A' },
};

export interface HarmonicMatch {
  key: string;
  camelotCode: string;
  relationship:
    | 'perfect'
    | 'adjacent'
    | 'relative'
    | 'parallel'
    | 'energy-boost'
    | 'energy-drop';
  description: string;
}

/**
 * Builds mapping from camelot codes back to keys for lookup
 */
function buildReverseMap(): Map<string, string> {
  const reverseMap = new Map<string, string>();
  Object.entries(CAMELOT_MAP).forEach(([key, data]) => {
    reverseMap.set(data.code, key);
  });
  return reverseMap;
}

const REVERSE_CAMELOT_MAP = buildReverseMap();

export class CamelotService {
  /**
   * Get the Camelot code for a given key
   */
  getCode(key: string): string | null {
    const data = CAMELOT_MAP[key];
    return data ? data.code : null;
  }

  /**
   * Get harmonically compatible keys for mixing
   * Returns matches sorted by compatibility (perfect first)
   */
  getCompatibleKeys(key: string): HarmonicMatch[] {
    const sourceData = CAMELOT_MAP[key];
    if (!sourceData) {
      return [];
    }

    const matches: HarmonicMatch[] = [];

    // Perfect match: same key
    matches.push({
      key,
      camelotCode: sourceData.code,
      relationship: 'perfect',
      description: `Perfect match - same key`,
    });

    // Relative: same number, other letter (8A ↔ 8B)
    const relativeCode =
      sourceData.letter === 'A'
        ? `${sourceData.number}B`
        : `${sourceData.number}A`;
    const relativeKey = REVERSE_CAMELOT_MAP.get(relativeCode);
    if (relativeKey && relativeKey !== key) {
      matches.push({
        key: relativeKey,
        camelotCode: relativeCode,
        relationship: 'relative',
        description: `Relative key - same number, different mode`,
      });
    }

    // Adjacent: same letter, ±1 number (wrap 12 ↔ 1)
    const nextNumber = sourceData.number === 12 ? 1 : sourceData.number + 1;
    const prevNumber = sourceData.number === 1 ? 12 : sourceData.number - 1;

    const nextCode = `${nextNumber}${sourceData.letter}`;
    const nextKey = REVERSE_CAMELOT_MAP.get(nextCode);
    if (nextKey) {
      // For A side: +1 is energy boost; for B side: just adjacent
      const relationship = sourceData.letter === 'A' ? 'energy-boost' : 'adjacent';
      matches.push({
        key: nextKey,
        camelotCode: nextCode,
        relationship,
        description:
          relationship === 'energy-boost'
            ? 'Energy boost - raise the energy'
            : `Adjacent key - +1 semitone`,
      });
    }

    const prevCode = `${prevNumber}${sourceData.letter}`;
    const prevKey = REVERSE_CAMELOT_MAP.get(prevCode);
    if (prevKey) {
      // For A side: -1 is energy drop; for B side: just adjacent
      const relationship = sourceData.letter === 'A' ? 'energy-drop' : 'adjacent';
      matches.push({
        key: prevKey,
        camelotCode: prevCode,
        relationship,
        description:
          relationship === 'energy-drop'
            ? 'Energy drop - lower the energy'
            : `Adjacent key - -1 semitone`,
      });
    }

    return matches;
  }

  /**
   * Find assets from a list that are harmonically compatible with a given key
   */
  findCompatibleAssets(
    key: string,
    assets: Array<{ id: number; key?: string; name: string }>
  ): Array<{
    asset: { id: number; key?: string; name: string };
    match: HarmonicMatch;
  }> {
    const compatibleKeys = this.getCompatibleKeys(key);
    const compatibleKeySet = new Set(compatibleKeys.map((m) => m.key));

    const results: Array<{
      asset: { id: number; key?: string; name: string };
      match: HarmonicMatch;
    }> = [];

    assets.forEach((asset) => {
      if (!asset.key) return; // Skip assets without key data

      const match = compatibleKeys.find((m) => m.key === asset.key);
      if (match) {
        results.push({ asset, match });
      }
    });

    // Sort by relationship priority
    const relationshipPriority: Record<string, number> = {
      perfect: 0,
      relative: 1,
      'energy-boost': 2,
      'energy-drop': 3,
      adjacent: 4,
      parallel: 5,
    };

    results.sort((a, b) => {
      const aPriority = relationshipPriority[a.match.relationship] ?? 99;
      const bPriority = relationshipPriority[b.match.relationship] ?? 99;
      return aPriority - bPriority;
    });

    return results;
  }
}
