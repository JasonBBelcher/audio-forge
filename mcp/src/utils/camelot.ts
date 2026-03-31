// Camelot Wheel mapping
const CAMELOT_MAP: Record<string, string> = {
  'A-flat minor': '1A', 'B major': '1B',
  'E-flat minor': '2A', 'F-sharp major': '2B',
  'B-flat minor': '3A', 'D-flat major': '3B',
  'F minor': '4A', 'A-flat major': '4B',
  'C minor': '5A', 'E-flat major': '5B',
  'G minor': '6A', 'B-flat major': '6B',
  'D minor': '7A', 'F major': '7B',
  'A minor': '8A', 'C major': '8B',
  'E minor': '9A', 'G major': '9B',
  'B minor': '10A', 'D major': '10B',
  'F-sharp minor': '11A', 'A major': '11B',
  'D-flat minor': '12A', 'E major': '12B',
  'G# minor': '1A', 'Cb major': '1B',
  'D# minor': '2A', 'Gb major': '2B',
  'Bb minor': '3A', 'Db major': '3B',
  'Ab major': '4B', 'Eb major': '5B',
  'Bb major': '6B', 'F# minor': '11A',
  'C# minor': '12A',
};

export interface CompatibleKey {
  key: string;
  camelot: string;
  type: string;
}

export function getCamelotCode(key: string): string | null {
  return CAMELOT_MAP[key] ?? null;
}

export function getCompatibleKeys(key: string): CompatibleKey[] {
  const code = CAMELOT_MAP[key];
  if (!code) return [];

  const num = parseInt(code);
  const letter = code.slice(-1);
  const results: CompatibleKey[] = [];

  results.push({ key, camelot: code, type: 'perfect' });

  const prev = ((num - 2 + 12) % 12) + 1;
  const next = (num % 12) + 1;
  addByCode(`${prev}${letter}`, 'adjacent', results);
  addByCode(`${next}${letter}`, 'adjacent', results);

  const otherLetter = letter === 'A' ? 'B' : 'A';
  addByCode(`${num}${otherLetter}`, 'relative', results);

  const boost = ((num + 6) % 12) + 1;
  addByCode(`${boost}${letter}`, 'energy_boost', results);

  return results;
}

function addByCode(code: string, type: string, results: CompatibleKey[]): void {
  const entry = Object.entries(CAMELOT_MAP).find(([, c]) => c === code);
  if (entry) results.push({ key: entry[0], camelot: code, type });
}
