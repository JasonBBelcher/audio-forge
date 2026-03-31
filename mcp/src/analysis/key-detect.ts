import { run } from '../utils/process-runner.js';
import { TOOL_PATHS } from '../constants.js';

const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

// Krumhansl-Schmuckler key profiles
const MAJOR_PROFILE = [6.35, 2.23, 3.48, 2.33, 4.38, 4.09, 2.52, 5.19, 2.39, 3.66, 2.29, 2.88];
const MINOR_PROFILE = [6.33, 2.68, 3.52, 5.38, 2.60, 3.53, 2.54, 4.75, 3.98, 2.69, 3.34, 3.17];

export async function analyzeKey(filePath: string): Promise<string | null> {
  const result = await run(TOOL_PATHS.aubio, ['pitch', '-i', filePath, '-p', 'yinfast']);
  if (result.exitCode !== 0) return null;

  const pitches = result.stdout.trim().split('\n')
    .map((l) => parseFloat(l.split('\t')[1] ?? ''))
    .filter((v) => !isNaN(v) && v > 20 && v < 5000);

  if (pitches.length === 0) return null;

  // Build chromagram
  const chroma = new Array(12).fill(0);
  for (const hz of pitches) {
    const midi = 12 * Math.log2(hz / 440) + 69;
    const note = Math.round(midi) % 12;
    if (note >= 0 && note < 12) chroma[note]++;
  }

  // Correlate with key profiles
  let bestKey = 'C major';
  let bestCorr = -Infinity;

  for (let root = 0; root < 12; root++) {
    const rotated = chroma.slice(root).concat(chroma.slice(0, root));
    const majCorr = correlate(rotated, MAJOR_PROFILE);
    const minCorr = correlate(rotated, MINOR_PROFILE);

    if (majCorr > bestCorr) { bestCorr = majCorr; bestKey = `${NOTE_NAMES[root]} major`; }
    if (minCorr > bestCorr) { bestCorr = minCorr; bestKey = `${NOTE_NAMES[root]} minor`; }
  }

  return bestKey;
}

function correlate(a: number[], b: number[]): number {
  const n = a.length;
  const meanA = a.reduce((s, v) => s + v, 0) / n;
  const meanB = b.reduce((s, v) => s + v, 0) / n;
  let num = 0, denA = 0, denB = 0;
  for (let i = 0; i < n; i++) {
    const da = a[i] - meanA, db = b[i] - meanB;
    num += da * db; denA += da * da; denB += db * db;
  }
  return denA === 0 || denB === 0 ? 0 : num / Math.sqrt(denA * denB);
}
