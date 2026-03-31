import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

export type StemModel = 'htdemucs' | 'htdemucs_ft';

export interface StemResult {
  vocals: string;
  drums: string;
  bass: string;
  other: string;
}

export async function separateStems(inputPath: string, model: StemModel = 'htdemucs'): Promise<StemResult> {
  const outputDir = join(MEDIA_DIR, 'stems');
  const name = basename(inputPath, extname(inputPath));

  const result = await run(TOOL_PATHS.demucs, [
    '-n', model,
    '-o', outputDir,
    inputPath,
  ], 600_000);

  if (result.exitCode !== 0) throw new Error(`Stem separation failed: ${result.stderr}`);

  const stemDir = join(outputDir, model, name);
  const stems: StemResult = {
    vocals: join(stemDir, 'vocals.wav'),
    drums: join(stemDir, 'drums.wav'),
    bass: join(stemDir, 'bass.wav'),
    other: join(stemDir, 'other.wav'),
  };

  for (const [stem, path] of Object.entries(stems)) {
    if (!existsSync(path)) throw new Error(`Missing stem file: ${stem} at ${path}`);
  }

  return stems;
}
