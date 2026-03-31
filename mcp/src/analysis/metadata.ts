import { run } from '../utils/process-runner.js';
import { statSync } from 'fs';

export interface AudioMetadata {
  duration: number;
  sample_rate: number;
  channels: number;
  codec: string;
  bitrate: number;
  file_size: number;
}

export async function getAudioMetadata(filePath: string): Promise<AudioMetadata> {
  const result = await run('ffprobe', [
    '-v', 'quiet',
    '-print_format', 'json',
    '-show_format',
    '-show_streams',
    filePath,
  ]);

  if (result.exitCode !== 0) throw new Error(`ffprobe failed: ${result.stderr}`);

  const data = JSON.parse(result.stdout) as Record<string, unknown>;
  const streams = (data.streams ?? []) as Record<string, unknown>[];
  const stream = streams.find((s) => s.codec_type === 'audio');
  const format = data.format ?? {};
  const stat = statSync(filePath);

  return {
    duration: parseFloat((format as Record<string, unknown>).duration as string ?? stream?.duration as string ?? '0'),
    sample_rate: parseInt((stream?.sample_rate ?? '0') as string, 10),
    channels: (stream?.channels as number) ?? 0,
    codec: (stream?.codec_name as string) ?? 'unknown',
    bitrate: parseInt((format as Record<string, unknown>).bit_rate as string ?? '0', 10),
    file_size: stat.size,
  };
}
