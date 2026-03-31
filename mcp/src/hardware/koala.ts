import { run } from '../utils/process-runner.js';
import { mkdirSync } from 'fs';
import { join } from 'path';
import { MEDIA_DIR } from '../constants.js';

const KOALA_SAMPLE_RATE = 44100;

export interface KoalaPad {
  pad: number;
  asset_path: string;
}

export async function exportKoalaKit(name: string, pads: KoalaPad[]): Promise<string> {
  const kitDir = join(MEDIA_DIR, 'koala', name);
  mkdirSync(kitDir, { recursive: true });

  for (const { pad, asset_path } of pads) {
    const padName = String(pad + 1).padStart(2, '0');
    const outputPath = join(kitDir, `pad_${padName}.wav`);

    await run('ffmpeg', [
      '-y', '-i', asset_path,
      '-ar', String(KOALA_SAMPLE_RATE),
      '-ac', '2',
      '-codec:a', 'pcm_s16le',
      outputPath,
    ]);
  }

  return kitDir;
}
