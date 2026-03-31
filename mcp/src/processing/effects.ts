import { run } from '../utils/process-runner.js';
import { MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';

function outPath(input: string, suffix: string): string {
  const name = basename(input, extname(input));
  const ext = extname(input);
  return join(MEDIA_DIR, `${name}_${suffix}${ext}`);
}

export async function trimAudio(inputPath: string, start: number, end: number): Promise<string> {
  const output = outPath(inputPath, 'trimmed');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-ss', String(start), '-to', String(end), '-c', 'copy', output]);
  if (result.exitCode !== 0) throw new Error(`Trim failed: ${result.stderr}`);
  return output;
}

export async function normalizeAudio(inputPath: string, targetLufs = -14): Promise<string> {
  const output = outPath(inputPath, 'normalized');
  const filter = `loudnorm=I=${targetLufs}:TP=-1.5:LRA=11`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Normalize failed: ${result.stderr}`);
  return output;
}

export async function applyFade(inputPath: string, fadeIn = 0, fadeOut = 0): Promise<string> {
  const output = outPath(inputPath, 'faded');
  const filters: string[] = [];
  if (fadeIn > 0) filters.push(`afade=t=in:d=${fadeIn}`);
  if (fadeOut > 0) filters.push(`areverse,afade=t=in:d=${fadeOut},areverse`);
  if (filters.length === 0) throw new Error('At least one fade duration required');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filters.join(','), output]);
  if (result.exitCode !== 0) throw new Error(`Fade failed: ${result.stderr}`);
  return output;
}

export async function reverseAudio(inputPath: string): Promise<string> {
  const output = outPath(inputPath, 'reversed');
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', 'areverse', output]);
  if (result.exitCode !== 0) throw new Error(`Reverse failed: ${result.stderr}`);
  return output;
}

export async function pitchShift(inputPath: string, semitones: number): Promise<string> {
  const output = outPath(inputPath, 'pitched');
  const rate = Math.pow(2, semitones / 12);
  const filter = `asetrate=44100*${rate},aresample=44100`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Pitch shift failed: ${result.stderr}`);
  return output;
}

export async function timeStretch(inputPath: string, rate: number): Promise<string> {
  const output = outPath(inputPath, 'stretched');
  const filter = `atempo=${rate}`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Time stretch failed: ${result.stderr}`);
  return output;
}

export async function removeSilence(inputPath: string, thresholdDb = -40): Promise<string> {
  const output = outPath(inputPath, 'desilenced');
  const filter = `silenceremove=start_periods=1:start_threshold=${thresholdDb}dB:stop_periods=-1:stop_threshold=${thresholdDb}dB`;
  const result = await run('ffmpeg', ['-y', '-i', inputPath, '-af', filter, output]);
  if (result.exitCode !== 0) throw new Error(`Silence removal failed: ${result.stderr}`);
  return output;
}
