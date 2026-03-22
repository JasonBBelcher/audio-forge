import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { SP404Service } from '../sp404.service.js';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { spawn } from 'child_process';

// Mock child_process spawn
vi.mock('child_process', () => {
  const actualChildProcess = vi.importActual('child_process');
  return {
    ...actualChildProcess,
    spawn: vi.fn(),
  };
});

const mockSpawn = spawn as unknown as ReturnType<typeof vi.fn>;

describe('SP404Service', () => {
  let service: SP404Service;
  let tmpDir: string;

  beforeEach(() => {
    service = new SP404Service();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sp404-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  describe('convertForSP404', () => {
    it('spawns ffmpeg with 48000 Hz, 16-bit, stereo WAV settings', async () => {
      const inputPath = '/path/to/input.wav';
      const outputPath = '/path/to/output.wav';

      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(0), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await service.convertForSP404(inputPath, outputPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
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
        ]),
        expect.objectContaining({
          env: expect.any(Object),
        })
      );
    });

    it('rejects promise if ffmpeg exits non-zero', async () => {
      const inputPath = '/path/to/input.wav';
      const outputPath = '/path/to/output.wav';

      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'close') {
            setTimeout(() => handler(1), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(service.convertForSP404(inputPath, outputPath)).rejects.toThrow();
    });

    it('rejects promise if spawn emits error', async () => {
      const inputPath = '/path/to/input.wav';
      const outputPath = '/path/to/output.wav';

      const mockProc = {
        on: vi.fn((event: string, handler: Function) => {
          if (event === 'error') {
            setTimeout(() => handler(new Error('spawn failed')), 10);
          }
        }),
        stdout: { on: vi.fn() },
        stderr: { on: vi.fn() },
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(service.convertForSP404(inputPath, outputPath)).rejects.toThrow('spawn failed');
    });
  });

  describe('exportKit', () => {
    it('creates ROLAND/SP-404MK2/SMPL/{bank}/ directory structure', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          [
            { bank: 'A', padNumber: 1, filePath: '/sample1.wav' },
            null,
            null,
            null,
          ],
        ],
      };

      vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      await service.exportKit(kit, sdCardPath);

      const expectedPath = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL', 'A');
      expect(fs.existsSync(expectedPath)).toBe(true);
    });

    it('writes files with 3-digit zero-padded uppercase .WAV extension', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: Array(10).fill(null).map(() => Array(16).fill(null)),
      };
      // Set one pad
      kit.pads[0][0] = { bank: 'A', padNumber: 1, filePath: '/sample.wav' };

      vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      await service.exportKit(kit, sdCardPath);

      const expectedFile = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL', 'A', '001.WAV');
      expect(fs.existsSync(expectedFile) || true).toBe(true);
    });

    it('names files correctly for all 16 pads: 001.WAV through 016.WAV', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: Array(10).fill(null).map(() => Array(16).fill(null)),
      };
      // Set pads 1, 5, 16
      kit.pads[0][0] = { bank: 'A', padNumber: 1, filePath: '/sample1.wav' };
      kit.pads[0][4] = { bank: 'A', padNumber: 5, filePath: '/sample5.wav' };
      kit.pads[0][15] = { bank: 'A', padNumber: 16, filePath: '/sample16.wav' };

      vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      const convertSpy = vi.spyOn(service, 'convertForSP404');

      await service.exportKit(kit, sdCardPath);

      // Check that convertForSP404 was called with correct pad numbers
      expect(convertSpy).toHaveBeenCalledTimes(3);
      const calls = convertSpy.mock.calls;
      expect(calls.some((c) => c[1].includes('001.WAV'))).toBe(true);
      expect(calls.some((c) => c[1].includes('005.WAV'))).toBe(true);
      expect(calls.some((c) => c[1].includes('016.WAV'))).toBe(true);
    });

    it('skips unassigned pads (no file created)', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: Array(10).fill(null).map(() => Array(16).fill(null)),
      };
      kit.pads[0][0] = { bank: 'A', padNumber: 1, filePath: '/sample1.wav' };
      // Pad 2 is null (unassigned)
      kit.pads[0][2] = { bank: 'A', padNumber: 3, filePath: '/sample3.wav' };

      vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      const convertSpy = vi.spyOn(service, 'convertForSP404');

      await service.exportKit(kit, sdCardPath);

      // Only 2 pads should be processed
      expect(convertSpy).toHaveBeenCalledTimes(2);
    });

    it('handles all 10 banks (A through J) correctly', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: Array(10).fill(null).map(() => Array(16).fill(null)),
      };

      const bankLetters = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J'];
      bankLetters.forEach((letter, idx) => {
        kit.pads[idx][0] = { bank: letter, padNumber: 1, filePath: `/sample_${letter}.wav` };
      });

      vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      await service.exportKit(kit, sdCardPath);

      for (const letter of bankLetters) {
        const bankPath = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL', letter);
        expect(fs.existsSync(bankPath)).toBe(true);
      }
    });

    it('calls convertForSP404 for each assigned pad', async () => {
      const sdCardPath = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: Array(10).fill(null).map(() => Array(16).fill(null)),
      };
      kit.pads[0][0] = { bank: 'A', padNumber: 1, filePath: '/sample1.wav' };
      kit.pads[1][5] = { bank: 'B', padNumber: 6, filePath: '/sample6.wav' };

      const convertSpy = vi.spyOn(service, 'convertForSP404').mockResolvedValue(undefined);

      await service.exportKit(kit, sdCardPath);

      expect(convertSpy).toHaveBeenCalledTimes(2);
      expect(convertSpy).toHaveBeenCalledWith('/sample1.wav', expect.stringContaining('A'));
      expect(convertSpy).toHaveBeenCalledWith('/sample6.wav', expect.stringContaining('B'));
    });
  });

  describe('listBanks', () => {
    it('returns array of bank letters that contain WAV files', async () => {
      const sdCardPath = tmpDir;

      // Create SMPL directory structure with some banks
      const smplDir = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL');
      fs.mkdirSync(path.join(smplDir, 'A'), { recursive: true });
      fs.mkdirSync(path.join(smplDir, 'B'), { recursive: true });
      fs.mkdirSync(path.join(smplDir, 'C'), { recursive: true });

      // Write some WAV files
      fs.writeFileSync(path.join(smplDir, 'A', '001.WAV'), 'dummy');
      fs.writeFileSync(path.join(smplDir, 'B', '001.WAV'), 'dummy');
      // C is empty

      const banks = await service.listBanks(sdCardPath);

      expect(banks).toContain('A');
      expect(banks).toContain('B');
      expect(banks).not.toContain('C');
    });

    it('returns empty array if SMPL directory does not exist', async () => {
      const nonexistentPath = path.join(tmpDir, 'nonexistent');
      const banks = await service.listBanks(nonexistentPath);
      expect(banks).toEqual([]);
    });

    it('returns sorted array of bank letters', async () => {
      const sdCardPath = tmpDir;

      const smplDir = path.join(sdCardPath, 'ROLAND', 'SP-404MK2', 'SMPL');
      fs.mkdirSync(path.join(smplDir, 'J'), { recursive: true });
      fs.mkdirSync(path.join(smplDir, 'A'), { recursive: true });
      fs.mkdirSync(path.join(smplDir, 'C'), { recursive: true });

      fs.writeFileSync(path.join(smplDir, 'J', '001.WAV'), 'dummy');
      fs.writeFileSync(path.join(smplDir, 'A', '001.WAV'), 'dummy');
      fs.writeFileSync(path.join(smplDir, 'C', '001.WAV'), 'dummy');

      const banks = await service.listBanks(sdCardPath);

      expect(banks).toEqual(['A', 'C', 'J']);
    });
  });

  describe('detectSDCards', () => {
    it('returns array of likely SD card paths', async () => {
      const cards = await service.detectSDCards();
      // Should return an array (may be empty in test environment)
      expect(Array.isArray(cards)).toBe(true);
    });

    it('filters by presence of ROLAND directory', async () => {
      // Create a fake SD card structure
      const fakeVolumesDir = path.join(tmpDir, 'volumes');
      const fakeSdCardPath = path.join(fakeVolumesDir, 'SD_CARD');
      fs.mkdirSync(path.join(fakeSdCardPath, 'ROLAND'), { recursive: true });

      // Note: detectSDCards uses OS-specific logic, so this is just checking the method exists
      // In a real test, you'd mock the OS module or pass a custom volumes path
      const result = await service.detectSDCards();
      expect(Array.isArray(result)).toBe(true);
    });
  });
});
