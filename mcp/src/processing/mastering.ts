import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

export interface MasteringParams {
  eq_low_gain?: number;
  eq_mid_gain?: number;
  eq_high_gain?: number;
  comp_threshold?: number;
  comp_ratio?: number;
  target_lufs?: number;
}

export async function analyzeLoudness(filePath: string): Promise<{ lufs: number; peak_db: number; dynamic_range: number }> {
  const result = await run('ffmpeg', ['-i', filePath, '-af', 'loudnorm=print_format=json', '-f', 'null', '-']);
  const json = result.stderr.match(/\{[\s\S]*\}/);
  if (!json) throw new Error('Could not parse loudness data');
  const data = JSON.parse(json[0]) as Record<string, unknown>;
  return {
    lufs: parseFloat(data.input_i as string),
    peak_db: parseFloat(data.input_tp as string),
    dynamic_range: parseFloat(data.input_lra as string),
  };
}

export async function masterAudio(inputPath: string, params: MasteringParams = {}): Promise<string> {
  const name = basename(inputPath, extname(inputPath));
  const output = join(MEDIA_DIR, `${name}_mastered.wav`);

  const filters: string[] = [];

  // 3-band EQ
  const lowGain = params.eq_low_gain ?? 0;
  const midGain = params.eq_mid_gain ?? 0;
  const highGain = params.eq_high_gain ?? 0;
  if (lowGain || midGain || highGain) {
    filters.push(`equalizer=f=100:t=h:w=200:g=${lowGain}`);
    filters.push(`equalizer=f=1000:t=h:w=1000:g=${midGain}`);
    filters.push(`equalizer=f=8000:t=h:w=4000:g=${highGain}`);
  }

  // Compressor
  const threshold = params.comp_threshold ?? -20;
  const ratio = params.comp_ratio ?? 4;
  filters.push(`acompressor=threshold=${threshold}dB:ratio=${ratio}:attack=10:release=200`);

  // Loudness normalization
  const targetLufs = params.target_lufs ?? -14;
  filters.push(`loudnorm=I=${targetLufs}:TP=-1.0:LRA=11`);

  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filters.join(','), output]);
  if (result.exitCode !== 0) throw new Error(`Mastering failed: ${result.stderr}`);
  return output;
}
