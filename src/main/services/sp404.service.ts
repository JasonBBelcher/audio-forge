import { spawn } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { getEnhancedEnv } from '../utils/process-runner.js';

export interface SP404Pad {
  bank: string; // 'A' through 'J'
  padNumber: number; // 1–16
  filePath?: string; // source audio file path
}

export interface SP404Kit {
  name: string;
  pads: (SP404Pad | null)[][]; // [bank][pad] — 10 banks × 16 pads
}

export class SP404Service {
  /**
   * Convert a single audio file to 48kHz/16-bit stereo WAV for SP-404 MK2.
   * Uses ffmpeg with format: -ar 48000 -ac 2 -sample_fmt s16 -f wav
   */
  async convertForSP404(inputPath: string, outputPath: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const ffmpegArgs = [
        '-i',
        inputPath,
        '-ar',
        '48000',
        '-ac',
        '2',
        '-sample_fmt',
        's16',
        '-f',
        'wav',
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
   * Export a kit to the SD card SMPL directory.
   * Creates structure: {sdCardPath}/ROLAND/SP-404MK2/SMPL/{bank}/{NNN}.WAV
   * For each assigned pad, converts source audio to 48kHz/16-bit stereo WAV.
   * Creates directories as needed. Skips unassigned pads (null).
   */
  async exportKit(kit: SP404Kit, sdCardPath: string): Promise<void> {
    // Create base SMPL directory
    const smplPath = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL');

    if (!fs.existsSync(smplPath)) {
      fs.mkdirSync(smplPath, { recursive: true });
    }

    // Identify which banks have content
    const banksWithContent = new Set<string>();

    for (const bankPads of kit.pads) {
      for (const pad of bankPads) {
        if (pad && pad.filePath) {
          banksWithContent.add(pad.bank);
        }
      }
    }

    // Create bank directories for banks with samples
    for (const bank of banksWithContent) {
      const bankPath = path.join(smplPath, bank);
      if (!fs.existsSync(bankPath)) {
        fs.mkdirSync(bankPath, { recursive: true });
      }
    }

    // Process each pad
    const convertPromises: Promise<void>[] = [];

    for (const bankPads of kit.pads) {
      for (const pad of bankPads) {
        if (pad && pad.filePath) {
          const padNumberStr = String(pad.padNumber).padStart(3, '0');
          const outputPath = path.join(smplPath, pad.bank, `${padNumberStr}.WAV`);

          // Queue the conversion operation
          const convertPromise = this.convertForSP404(pad.filePath, outputPath);
          convertPromises.push(convertPromise);
        }
      }
    }

    // Wait for all conversions to complete
    await Promise.all(convertPromises);
  }

  /**
   * List existing banks by scanning {sdCardPath}/ROLAND/SP-404MK2/SMPL/
   * Returns array of bank letters (A-J) that have at least one WAV file.
   */
  async listBanks(sdCardPath: string): Promise<string[]> {
    const smplPath = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL');

    if (!fs.existsSync(smplPath)) {
      return [];
    }

    const bankDirs = fs.readdirSync(smplPath, { withFileTypes: true });
    const banksWithFiles: string[] = [];

    for (const entry of bankDirs) {
      if (entry.isDirectory()) {
        const bankPath = path.join(smplPath, entry.name);
        const files = fs.readdirSync(bankPath);
        const hasWavFiles = files.some((f) => f.toUpperCase().endsWith('.WAV'));
        if (hasWavFiles) {
          banksWithFiles.push(entry.name);
        }
      }
    }

    return banksWithFiles.sort();
  }

  /**
   * Detect likely SD card mount points on the current OS.
   * macOS: /Volumes/* — filter by presence of ROLAND/ directory
   * Windows: D:\, E:\, F:\ etc — filter by presence of ROLAND\
   * Linux: /mnt/*, /media/* — filter by presence of ROLAND/
   * Returns array of paths where ROLAND directory exists.
   */
  async detectSDCards(): Promise<string[]> {
    const platform = os.platform();
    const detectedPaths: string[] = [];

    try {
      if (platform === 'darwin') {
        // macOS: check /Volumes
        const volumesDir = '/Volumes';
        if (fs.existsSync(volumesDir)) {
          const entries = fs.readdirSync(volumesDir);
          for (const entry of entries) {
            const volumePath = path.join(volumesDir, entry);
            const rolandPath = path.join(volumePath, 'ROLAND');
            if (fs.existsSync(rolandPath)) {
              detectedPaths.push(volumePath);
            }
          }
        }
      } else if (platform === 'win32') {
        // Windows: check D: through Z:
        for (let i = 68; i <= 90; i++) {
          // 68 = 'D', 90 = 'Z'
          const driveLetter = String.fromCharCode(i);
          const drivePath = `${driveLetter}:`;
          const rolandPath = path.join(drivePath, 'ROLAND');
          try {
            if (fs.existsSync(rolandPath)) {
              detectedPaths.push(drivePath);
            }
          } catch (e) {
            // Drive may not exist; continue
          }
        }
      } else if (platform === 'linux') {
        // Linux: check /mnt and /media
        const mountPaths = ['/mnt', '/media'];
        for (const mountBase of mountPaths) {
          if (fs.existsSync(mountBase)) {
            const entries = fs.readdirSync(mountBase);
            for (const entry of entries) {
              const mountPath = path.join(mountBase, entry);
              const rolandPath = path.join(mountPath, 'ROLAND');
              try {
                if (fs.existsSync(rolandPath)) {
                  detectedPaths.push(mountPath);
                }
              } catch (e) {
                // May not have read access; continue
              }
            }
          }
        }
      }
    } catch (error) {
      // Silently fail if detection doesn't work
      console.error('Error detecting SD cards:', error);
    }

    return detectedPaths;
  }
}
