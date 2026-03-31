import { run } from '../utils/process-runner.js';
import { existsSync, mkdirSync, readdirSync } from 'fs';
import { join, basename, extname } from 'path';

const SP404_SAMPLE_RATE = 48000;
const SP404_BIT_DEPTH = 16;
const SP404_CHANNELS = 2;

export interface PadAssignment {
  pad: number;
  asset_path: string;
}

export async function exportKit(
  sdCardPath: string,
  bank: string,
  pads: PadAssignment[]
): Promise<string[]> {
  const bankDir = join(sdCardPath, 'ROLAND', 'SP-404MKII', 'SAMPLE', bank.toUpperCase());
  mkdirSync(bankDir, { recursive: true });

  const exported: string[] = [];

  for (const { pad, asset_path } of pads) {
    const padName = String(pad + 1).padStart(4, '0');
    const outputPath = join(bankDir, `${padName}.WAV`);

    const result = await run('ffmpeg', [
      '-y', '-i', asset_path,
      '-ar', String(SP404_SAMPLE_RATE),
      '-ac', String(SP404_CHANNELS),
      '-sample_fmt', `s${SP404_BIT_DEPTH}`,
      '-codec:a', 'pcm_s16le',
      outputPath,
    ]);

    if (result.exitCode !== 0) throw new Error(`SP-404 export failed for pad ${pad}: ${result.stderr}`);
    exported.push(outputPath);
  }

  return exported;
}

export function detectSDCards(): string[] {
  const volumesDir = '/Volumes';
  if (!existsSync(volumesDir)) return [];

  return readdirSync(volumesDir)
    .map((v) => join(volumesDir, v))
    .filter((v) => existsSync(join(v, 'ROLAND', 'SP-404MKII')));
}
