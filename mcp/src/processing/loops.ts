import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

export interface LoopCandidate {
  start: number;
  end: number;
  bars: number;
  confidence: number;
}

export async function detectLoops(filePath: string, bpm?: number): Promise<LoopCandidate[]> {
  const result = await run(TOOL_PATHS.aubio, ['onset', '-i', filePath]);
  if (result.exitCode !== 0) throw new Error(`Onset detection failed: ${result.stderr}`);

  const onsets = result.stdout.trim().split('\n')
    .map((l) => parseFloat(l)).filter((v) => !isNaN(v));

  if (onsets.length < 4) return [];

  const estimatedBpm = bpm ?? 120;
  const beatLength = 60 / estimatedBpm;

  const candidates: LoopCandidate[] = [];

  for (const bars of [1, 2, 4, 8]) {
    const loopLength = beatLength * 4 * bars;
    for (let i = 0; i < onsets.length - 1; i++) {
      const start = onsets[i];
      const end = start + loopLength;
      const closestOnset = onsets.reduce((best, o) =>
        Math.abs(o - end) < Math.abs(best - end) ? o : best, onsets[0]);
      const deviation = Math.abs(closestOnset - end) / loopLength;
      const confidence = Math.max(0, 1 - deviation * 4);

      if (confidence > 0.5) {
        candidates.push({ start, end: closestOnset, bars, confidence: Math.round(confidence * 100) / 100 });
      }
    }
  }

  return candidates
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 10);
}

export async function extractLoop(filePath: string, start: number, end: number): Promise<string> {
  const name = basename(filePath, extname(filePath));
  const ext = extname(filePath);
  const output = join(MEDIA_DIR, `${name}_loop_${Math.round(start * 100)}${ext}`);

  const result = await run('ffmpeg', ['-y', '-i', filePath, '-ss', String(start), '-to', String(end), '-c', 'copy', output]);
  if (result.exitCode !== 0) throw new Error(`Loop extraction failed: ${result.stderr}`);

  return output;
}
