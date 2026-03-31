import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import type { AudioFormat } from '../constants.js';

export async function convertFormat(inputPath: string, format: AudioFormat): Promise<string> {
  const name = basename(inputPath, extname(inputPath));
  const outputPath = join(MEDIA_DIR, `${name}_converted.${format}`);

  const args = ['-y', '-i', inputPath];

  // Format-specific encoding
  switch (format) {
    case 'mp3': args.push('-codec:a', 'libmp3lame', '-b:a', '320k'); break;
    case 'flac': args.push('-codec:a', 'flac'); break;
    case 'aac': case 'm4a': args.push('-codec:a', 'aac', '-b:a', '256k'); break;
    case 'ogg': args.push('-codec:a', 'libvorbis', '-q:a', '8'); break;
    case 'aiff': args.push('-codec:a', 'pcm_s16be'); break;
    case 'wav': args.push('-codec:a', 'pcm_s16le'); break;
  }

  args.push(outputPath);
  const result = await run('ffmpeg', args);
  if (result.exitCode !== 0) throw new Error(`Format conversion failed: ${result.stderr}`);

  return outputPath;
}
