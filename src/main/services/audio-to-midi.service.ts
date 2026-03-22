import { Midi } from '@tonejs/midi';
import { homedir } from 'os';
import { join } from 'path';
import { basename, extname } from 'path';
import { existsSync, readFileSync } from 'fs';
import { runProcess, type RunProcessOptions } from '../utils/process-runner.js';

export interface AudioToMidiParams {
  inputPath: string;
  outputDir: string;
  onsetThreshold?: number;    // 0.0–1.0, default 0.5
  frameThreshold?: number;    // 0.0–1.0, default 0.3
  minimumNoteLength?: number; // ms, default 58
  minimumFrequency?: number;  // Hz, default 32.7 (C1)
  maximumFrequency?: number;  // Hz, default 1975.5 (B6)
  inferOnsets?: boolean;      // default true
  maxPolyphony?: number;      // default 88
}

export interface AudioToMidiResult {
  midiPath: string;
  noteCount: number;
  durationSec: number;
  estimatedTempo?: number;
}

export class AudioToMidiService {
  private pythonPath: string;

  constructor() {
    // Path to python in the Claude venv
    this.pythonPath = join(homedir(), '.claude', 'venv', 'bin', 'python');
  }

  /**
   * Check if basic_pitch is installed in the venv
   */
  async isInstalled(): Promise<boolean> {
    try {
      const result = await runProcess(this.pythonPath, [
        '-c',
        'import basic_pitch; print("OK")',
      ]);
      return result.exitCode === 0;
    } catch {
      return false;
    }
  }

  /**
   * Install basic_pitch via pip
   */
  async install(): Promise<void> {
    const pipPath = join(homedir(), '.claude', 'venv', 'bin', 'pip');
    const result = await runProcess(pipPath, ['install', 'basic_pitch']);

    if (result.exitCode !== 0) {
      throw new Error(`Installation failed: ${result.stderr}`);
    }
  }

  /**
   * Convert an audio file to MIDI using Basic Pitch.
   * Spawns: python -m basic_pitch {outputDir} {inputPath} [options]
   * Basic Pitch outputs a .mid file in outputDir named after the input file.
   */
  async convert(params: AudioToMidiParams): Promise<AudioToMidiResult> {
    // Validate input file exists
    if (!existsSync(params.inputPath)) {
      throw new Error('Input file does not exist');
    }

    // Build command args
    const args = ['basic_pitch', params.outputDir, params.inputPath];

    // Add optional parameters
    if (params.onsetThreshold !== undefined) {
      args.push('--onset-threshold', params.onsetThreshold.toString());
    }

    if (params.frameThreshold !== undefined) {
      args.push('--frame-threshold', params.frameThreshold.toString());
    }

    if (params.minimumNoteLength !== undefined) {
      args.push('--minimum-note-length', params.minimumNoteLength.toString());
    }

    if (params.minimumFrequency !== undefined) {
      args.push('--minimum-frequency', params.minimumFrequency.toString());
    }

    if (params.maximumFrequency !== undefined) {
      args.push('--maximum-frequency', params.maximumFrequency.toString());
    }

    if (params.inferOnsets === false) {
      args.push('--no-infer-onsets');
    }

    if (params.maxPolyphony !== undefined) {
      args.push('--max-polyphony', params.maxPolyphony.toString());
    }

    // Spawn process with 30-minute timeout for conversion
    const processOptions: RunProcessOptions = {
      timeout: 1800000, // 30 minutes
    };

    const result = await runProcess(this.pythonPath, ['-m', ...args], processOptions);

    if (result.exitCode !== 0) {
      throw new Error(`Audio to MIDI conversion failed: ${result.stderr}`);
    }

    // Determine output MIDI path
    const inputBasename = basename(params.inputPath, extname(params.inputPath));
    const midiPath = join(params.outputDir, `${inputBasename}_basic_pitch.mid`);

    // Parse MIDI file to extract metadata
    const midiBuffer = readFileSync(midiPath);
    const midi = new Midi(midiBuffer);

    // Count total notes across all tracks
    const noteCount = midi.tracks.reduce((sum, track) => sum + track.notes.length, 0);

    // Get duration from MIDI
    const durationSec = midi.duration;

    // Get estimated tempo
    const tempos = midi.header.tempos;
    const estimatedTempo = tempos && tempos.length > 0 ? tempos[0].bpm : undefined;

    return {
      midiPath,
      noteCount,
      durationSec,
      estimatedTempo,
    };
  }
}
