import { run } from '../utils/process-runner.js';
import { VENV_BIN, MEDIA_DIR } from '../constants.js';
import { join } from 'path';
import { existsSync } from 'fs';

export interface GenerationParams {
  prompt: string;
  duration?: number;
  seed?: number;
  steps?: number;
}

export async function generateAudio(params: GenerationParams): Promise<string> {
  const { prompt, duration = 10, seed, steps = 100 } = params;
  const timestamp = Date.now();
  const safeName = prompt.slice(0, 40).replace(/[^a-zA-Z0-9]/g, '_');
  const outputPath = join(MEDIA_DIR, `generated_${safeName}_${timestamp}.wav`);

  const pythonPath = join(VENV_BIN, 'python');
  const args = [
    '-m', 'stable_audio_tools.generate',
    '--prompt', prompt,
    '--duration', String(duration),
    '--steps', String(steps),
    '--output', outputPath,
  ];

  if (seed !== undefined) args.push('--seed', String(seed));

  const result = await run(pythonPath, args, 600_000);
  if (result.exitCode !== 0) throw new Error(`Audio generation failed: ${result.stderr}`);
  if (!existsSync(outputPath)) throw new Error('Generated audio file not created');

  return outputPath;
}

export async function isModelInstalled(): Promise<boolean> {
  try {
    const pythonPath = join(VENV_BIN, 'python');
    const result = await run(pythonPath, ['-c', 'import stable_audio_tools'], 10_000);
    return result.exitCode === 0;
  } catch {
    return false;
  }
}
