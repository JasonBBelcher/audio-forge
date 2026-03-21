import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { getEnhancedEnv } from '../utils/process-runner.js';

export interface KoalaPad {
  bank: 'A' | 'B' | 'C' | 'D';
  pad: number; // 1–16
  samplePath?: string; // absolute path to source WAV
}

export interface KoalaKit {
  name: string;
  bpm?: number;
  pads: KoalaPad[];
}

export interface ExportKitResult {
  outputPath: string;
  padCount: number;
}

export class KoalaService {
  /**
   * Prepares a sample for Koala: normalize, convert to 44100 Hz stereo 16-bit WAV,
   * and trim leading/trailing silence. Uses ffmpeg in a single invocation.
   */
  async prepSample(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i',
        inputPath,
        '-af',
        'silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,areverse,silenceremove=start_periods=1:start_silence=0.02:start_threshold=-50dB,areverse,loudnorm=I=-16:TP=-1:LRA=11',
        '-ar',
        '44100',
        '-ac',
        '2',
        '-sample_fmt',
        's16',
        outputPath,
        '-y',
      ];

      const proc = spawn('ffmpeg', ffmpegArgs, {
        env: getEnhancedEnv(),
      });

      let settled = false;

      const settle = (fn: () => void) => {
        if (!settled) {
          settled = true;
          fn();
        }
      };

      proc.stdout.on('data', () => {
        // Consume stdout to prevent buffer issues
      });

      proc.stderr.on('data', () => {
        // Consume stderr to prevent buffer issues
      });

      proc.on('error', (err) => {
        settle(() => reject(err));
      });

      proc.on('close', (code) => {
        if (code === 0) {
          settle(() => resolve());
        } else {
          settle(() => reject(new Error(`ffmpeg exited with code ${code}`)));
        }
      });
    });
  }

  /**
   * Exports a Koala kit to the sync folder with the structure:
   * {syncFolder}/{kitName}/Bank A/01.wav ... 16.wav
   * {syncFolder}/{kitName}/Bank B/01.wav ... 16.wav
   * {syncFolder}/{kitName}/Bank C/01.wav ... 16.wav
   * {syncFolder}/{kitName}/Bank D/01.wav ... 16.wav
   *
   * Empty pads (no samplePath) are skipped (no file written).
   */
  async exportKit(kit: KoalaKit, syncFolder: string): Promise<ExportKitResult> {
    const kitPath = path.join(syncFolder, kit.name);

    // Create kit root directory
    if (!fs.existsSync(kitPath)) {
      fs.mkdirSync(kitPath, { recursive: true });
    }

    // Track which banks have content
    const banksWithContent = new Set<string>();

    // Create bank directories for banks that have samples
    for (const pad of kit.pads) {
      if (pad.samplePath) {
        banksWithContent.add(`Bank ${pad.bank}`);
      }
    }

    // Create directories for banks with content
    for (const bankDir of banksWithContent) {
      const bankPath = path.join(kitPath, bankDir);
      if (!fs.existsSync(bankPath)) {
        fs.mkdirSync(bankPath, { recursive: true });
      }
    }

    // Process each pad
    let padCount = 0;
    const prepPromises: Promise<void>[] = [];

    for (const pad of kit.pads) {
      if (pad.samplePath) {
        padCount++;
        const bankDir = `Bank ${pad.bank}`;
        const padNumber = String(pad.pad).padStart(2, '0');
        const outputPath = path.join(kitPath, bankDir, `${padNumber}.wav`);

        // Queue the prepSample operation
        const prepPromise = this.prepSample(pad.samplePath, outputPath);
        prepPromises.push(prepPromise);
      }
    }

    // Wait for all samples to be processed
    await Promise.all(prepPromises);

    return {
      outputPath: kitPath,
      padCount,
    };
  }

  /**
   * Lists all kit folders (subfolders) in the sync folder.
   * Returns kit names, excluding files.
   */
  async listKits(syncFolder: string): Promise<string[]> {
    if (!fs.existsSync(syncFolder)) {
      return [];
    }

    const entries = fs.readdirSync(syncFolder, { withFileTypes: true });
    const kits = entries
      .filter((entry) => entry.isDirectory())
      .map((entry) => entry.name)
      .sort();

    return kits;
  }

  /**
   * Deletes a kit folder and all its contents recursively.
   */
  async deleteKit(kitName: string, syncFolder: string): Promise<void> {
    if (!fs.existsSync(syncFolder)) {
      throw new Error(`Sync folder does not exist: ${syncFolder}`);
    }

    const kitPath = path.join(syncFolder, kitName);

    if (!fs.existsSync(kitPath)) {
      throw new Error(`Kit not found: ${kitName}`);
    }

    // Remove the kit directory recursively
    fs.rmSync(kitPath, { recursive: true, force: true });
  }
}
