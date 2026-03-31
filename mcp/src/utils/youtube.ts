import { run } from './process-runner.js';
import { YOUTUBE_DIR } from '../constants.js';
import { join } from 'path';
import { mkdirSync } from 'fs';

export interface VideoInfo {
  title: string;
  duration: number;
  uploader: string;
  thumbnail: string;
}

export async function getVideoInfo(url: string): Promise<VideoInfo> {
  const result = await run('yt-dlp', ['--dump-json', '--no-download', url], 30_000);
  if (result.exitCode !== 0) throw new Error(`yt-dlp info failed: ${result.stderr}`);

  const data = JSON.parse(result.stdout) as Record<string, unknown>;
  return {
    title: (data.title ?? 'Unknown') as string,
    duration: (data.duration ?? 0) as number,
    uploader: (data.uploader ?? 'Unknown') as string,
    thumbnail: (data.thumbnail ?? '') as string,
  };
}

export async function downloadAudio(url: string, format: string = 'wav'): Promise<string> {
  mkdirSync(YOUTUBE_DIR, { recursive: true });

  const outputTemplate = join(YOUTUBE_DIR, '%(title)s.%(ext)s');
  const args = [
    '-x',
    '--audio-format', format,
    '--audio-quality', '0',
    '-o', outputTemplate,
    '--no-playlist',
    url,
  ];

  const result = await run('yt-dlp', args, 300_000);
  if (result.exitCode !== 0) throw new Error(`YouTube download failed: ${result.stderr}`);

  const destMatch = result.stdout.match(/Destination:\s*(.+)/);
  const mergeMatch = result.stdout.match(/\[ExtractAudio\].*?:\s*(.+)/);
  return mergeMatch?.[1]?.trim() ?? destMatch?.[1]?.trim() ?? join(YOUTUBE_DIR, 'downloaded.' + format);
}
