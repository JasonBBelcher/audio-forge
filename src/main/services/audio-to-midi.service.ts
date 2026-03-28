import { Midi } from '@tonejs/midi';
import { homedir } from 'os';
import { join } from 'path';
import { basename, extname } from 'path';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { runProcess, type RunProcessOptions } from '../utils/process-runner.js';
import { detectPlatform, basicPitchModelSerialization } from '../utils/platform-detector.js';

export interface AudioToMidiParams {
  inputPath: string;
  outputDir: string;
  onsetThreshold?: number;    // 0.0–1.0, default 0.5
  frameThreshold?: number;    // 0.0–1.0, default 0.3
  minimumNoteLength?: number; // ms, default 58
  minimumFrequency?: number;  // Hz, default 32.7 (C1)
  maximumFrequency?: number;  // Hz, default 1975.5 (B6)
  inferOnsets?: boolean;      // default true
}

export interface AudioToMidiResult {
  midiPath: string;
  noteCount: number;
  durationSec: number;
  estimatedTempo?: number;
}

export class AudioToMidiService {
  // basic-pitch CLI lives in the audioforge venv
  private readonly basicPitchBin = join(homedir(), '.audioforge-venv', 'bin', 'basic-pitch');
  private readonly pipBin = join(homedir(), '.audioforge-venv', 'bin', 'pip');
  private readonly pythonBin = join(homedir(), '.audioforge-venv', 'bin', 'python');

  /**
   * Check if basic_pitch is installed — just verifies the CLI binary exists.
   * Avoids spawning a Python subprocess (which can fail in Electron's env
   * due to missing env vars even when the package is actually present).
   */
  async isInstalled(): Promise<boolean> {
    return existsSync(this.basicPitchBin);
  }

  /**
   * Install basic_pitch with its ONNX extra so that onnxruntime is always
   * installed alongside it. Calling this when already fully installed is safe
   * — pip will report "Requirement already satisfied" and exit quickly.
   *
   * For NVIDIA GPUs we subsequently upgrade to onnxruntime-gpu so inference
   * uses CUDA acceleration. On Apple Silicon / CPU-only machines the standard
   * onnxruntime wheel (installed by the [onnx] extra) is sufficient.
   */
  async install(): Promise<void> {
    const venvDir = join(homedir(), '.audioforge-venv');

    // Create the venv from the system Python 3 if it doesn't exist yet.
    if (!existsSync(join(venvDir, 'bin', 'python'))) {
      const pythonCandidates = ['python3.12', 'python3.11', 'python3.10', 'python3', 'python'];
      let created = false;
      for (const py of pythonCandidates) {
        const r = await runProcess(py, ['-m', 'venv', venvDir]);
        if (r.exitCode === 0) { created = true; break; }
      }
      if (!created) {
        throw new Error('Could not create Python virtual environment. Please install Python 3.10+.');
      }
    }

    // setuptools must be present before anything else — pkg_resources (used by
    // older resampy) lives there, and some build backends need it too.
    await runProcess(this.pipBin, ['install', '--upgrade', 'setuptools', 'wheel']);

    // Install basic-pitch with the [onnx] extra — this pulls in onnxruntime at
    // the exact version basic-pitch requires, avoiding the TensorFlow add_slot
    // conflict and the separate onnxruntime version mismatch.
    const bpResult = await runProcess(this.pipBin, ['install', 'basic-pitch[onnx]']);
    if (bpResult.exitCode !== 0) {
      throw new Error(`basic-pitch[onnx] install failed: ${bpResult.stderr || bpResult.stdout}`);
    }

    // basic-pitch 0.3.x pins resampy<0.4.3 which uses pkg_resources — a module
    // no longer bundled in Python 3.12+ venvs. Upgrade to 0.4.3+ which switched
    // to importlib.metadata. The API is backward-compatible for our use.
    const resampyResult = await runProcess(this.pipBin, ['install', '--upgrade', 'resampy>=0.4.3']);
    if (resampyResult.exitCode !== 0) {
      console.warn(`resampy upgrade failed: ${resampyResult.stderr}`);
    }

    // basic-pitch 0.3.x calls scipy.signal.gaussian which was removed in
    // SciPy 1.12. Force-reinstall the last compatible release so a previously
    // installed newer version gets downgraded.
    const scipyResult = await runProcess(this.pipBin, [
      'install', '--force-reinstall', 'scipy==1.11.4',
    ]);
    if (scipyResult.exitCode !== 0) {
      console.warn(`scipy pin failed: ${scipyResult.stderr}`);
    }

    // On NVIDIA GPU machines, upgrade to the CUDA-accelerated runtime.
    const platform = detectPlatform();
    if (platform.hasNvidiaGpu) {
      const gpuResult = await runProcess(this.pipBin, ['install', '--upgrade', 'onnxruntime-gpu']);
      if (gpuResult.exitCode !== 0) {
        // Non-fatal — CPU onnxruntime will still work, just slower.
        console.warn(`onnxruntime-gpu upgrade failed (will use CPU): ${gpuResult.stderr}`);
      }
    }
  }

  /**
   * Convert an audio file to MIDI using the basic-pitch CLI.
   *
   * basic-pitch creates a subdirectory named after the input file:
   *   outputDir/{inputBasename}/{inputBasename}_basic_pitch.mid
   */
  async convert(params: AudioToMidiParams): Promise<AudioToMidiResult> {
    if (!existsSync(params.inputPath)) {
      throw new Error('Input file does not exist');
    }

    const inputBasename = basename(params.inputPath, extname(params.inputPath));

    const platform = detectPlatform();
    const modelSerialization = basicPitchModelSerialization(platform);

    // Build CLI args — positional: output_dir audio_path
    const args: string[] = [
      '--save-midi',
      '--model-serialization', modelSerialization,
      '--no-melodia',
    ];

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

    // Positional args at the end
    args.push(params.outputDir, params.inputPath);

    const processOptions: RunProcessOptions = { timeout: 1800000 }; // 30 min
    const result = await runProcess(this.basicPitchBin, args, processOptions);

    if (result.exitCode !== 0) {
      throw new Error(`Conversion failed: ${result.stderr || result.stdout}`);
    }

    // basic-pitch output location varies by version:
    //   v0.3+  → {outputDir}/{stem}/{stem}_basic_pitch.mid  (subdirectory)
    //   older  → {outputDir}/{stem}_basic_pitch.mid          (flat)
    // Search both, then fall back to a recursive scan so version differences
    // and filenames with spaces never cause a false "not created" error.
    const midiPath = this.findMidiOutput(params.outputDir, inputBasename);
    if (!midiPath) {
      throw new Error(
        `basic-pitch ran successfully but produced no MIDI file under ${params.outputDir}. ` +
        `stdout: ${result.stdout.slice(-500)}`
      );
    }

    // Parse the MIDI to extract metadata
    const midiBuffer = readFileSync(midiPath);
    const midi = new Midi(midiBuffer);

    const noteCount = midi.tracks.reduce((sum, track) => sum + track.notes.length, 0);
    const durationSec = midi.duration;
    const tempos = midi.header.tempos;
    const estimatedTempo = tempos?.length > 0 ? tempos[0].bpm : undefined;

    return { midiPath, noteCount, durationSec, estimatedTempo };
  }

  /**
   * Locate the MIDI file basic-pitch wrote for `stem` somewhere inside `dir`.
   *
   * Checks the two known layouts first (fast), then falls back to a full
   * recursive scan so that version differences or exotic stems never cause a
   * false "not created" error.
   */
  private findMidiOutput(dir: string, stem: string): string | undefined {
    const suffix = '_basic_pitch.mid';

    // Layout 1 — subdirectory (basic-pitch ≥ 0.3)
    const withSubdir = join(dir, stem, `${stem}${suffix}`);
    if (existsSync(withSubdir)) return withSubdir;

    // Layout 2 — flat (older builds)
    const flat = join(dir, `${stem}${suffix}`);
    if (existsSync(flat)) return flat;

    // Fallback — recursive scan for any file ending with _basic_pitch.mid
    return this.scanForMidi(dir, suffix);
  }

  /** Recursively searches `dir` for the first file whose name ends with `suffix`. */
  private scanForMidi(dir: string, suffix: string): string | undefined {
    let entries: string[];
    try {
      entries = readdirSync(dir);
    } catch {
      return undefined;
    }
    for (const entry of entries) {
      const full = join(dir, entry);
      try {
        if (statSync(full).isDirectory()) {
          const found = this.scanForMidi(full, suffix);
          if (found) return found;
        } else if (entry.endsWith(suffix)) {
          return full;
        }
      } catch {
        // skip unreadable entries
      }
    }
    return undefined;
  }
}
