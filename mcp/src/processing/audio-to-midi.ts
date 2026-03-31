import { run } from '../utils/process-runner.js';
import { TOOL_PATHS, MEDIA_DIR } from '../constants.js';
import { join, basename, extname } from 'path';
import { existsSync } from 'fs';

export interface MidiConversionResult {
  midi_path: string;
  note_count: number;
}

export async function audioToMidi(
  inputPath: string,
  options: { onset_threshold?: number; frame_threshold?: number } = {}
): Promise<MidiConversionResult> {
  const name = basename(inputPath, extname(inputPath));
  const outputDir = join(MEDIA_DIR, 'midi');
  const midiPath = join(outputDir, `${name}.mid`);

  const args = [inputPath, outputDir];

  if (options.onset_threshold !== undefined) {
    args.push('--onset-threshold', String(options.onset_threshold));
  }
  if (options.frame_threshold !== undefined) {
    args.push('--frame-threshold', String(options.frame_threshold));
  }

  const result = await run(TOOL_PATHS.basicPitch, args, 300_000);
  if (result.exitCode !== 0) throw new Error(`Audio-to-MIDI failed: ${result.stderr}`);

  if (!existsSync(midiPath)) throw new Error(`MIDI file not created at: ${midiPath}`);

  const noteMatch = result.stdout.match(/(\d+)\s*notes?/i);
  const noteCount = noteMatch ? parseInt(noteMatch[1], 10) : 0;

  return { midi_path: midiPath, note_count: noteCount };
}
