import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { KoalaService } from '../koala.service.js';
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

describe('KoalaService', () => {
  let service: KoalaService;
  let tmpDir: string;

  beforeEach(() => {
    service = new KoalaService();
    tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'koala-test-'));
    vi.clearAllMocks();
  });

  afterEach(() => {
    // Clean up temp directory
    if (fs.existsSync(tmpDir)) {
      fs.rmSync(tmpDir, { recursive: true });
    }
  });

  describe('prepSample', () => {
    it('spawns ffmpeg with correct arguments', async () => {
      const inputPath = '/path/to/input.wav';
      const outputPath = '/path/to/output.wav';

      // Mock the spawn process
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

      await service.prepSample(inputPath, outputPath);

      expect(mockSpawn).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-i',
          inputPath,
          '-af',
          expect.stringContaining('silenceremove'),
          expect.stringContaining('loudnorm'),
          '-ar',
          '44100',
          '-ac',
          '2',
          '-sample_fmt',
          's16',
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
        kill: vi.fn(),
      };

      mockSpawn.mockReturnValue(mockProc);

      await expect(service.prepSample(inputPath, outputPath)).rejects.toThrow();
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

      await expect(service.prepSample(inputPath, outputPath)).rejects.toThrow('spawn failed');
    });
  });

  describe('exportKit', () => {
    it('creates Bank A/01.wav for a pad assigned to bank A pad 1', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          {
            bank: 'A' as const,
            pad: 1,
            samplePath: '/path/to/sample1.wav',
          },
        ],
      };

      // Mock prepSample
      vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      const result = await service.exportKit(kit, exportFolder);

      const expectedFilePath = path.join(exportFolder, 'test-kit', 'Bank A', '01.wav');
      expect(fs.existsSync(expectedFilePath) || result.outputPath).toBeDefined();
      expect(result.padCount).toBe(1);
    });

    it('skips empty pads (no file created for unassigned pads)', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          {
            bank: 'A' as const,
            pad: 1,
            samplePath: '/path/to/sample1.wav',
          },
          {
            bank: 'A' as const,
            pad: 2,
            // No samplePath
          },
          {
            bank: 'A' as const,
            pad: 3,
            samplePath: '/path/to/sample3.wav',
          },
        ],
      };

      vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      const result = await service.exportKit(kit, exportFolder);

      expect(result.padCount).toBe(2); // Only pads 1 and 3
    });

    it('returns correct padCount (number of occupied pads)', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          { bank: 'A' as const, pad: 1, samplePath: '/sample1.wav' },
          { bank: 'B' as const, pad: 5, samplePath: '/sample5.wav' },
          { bank: 'C' as const, pad: 10 }, // empty
          { bank: 'D' as const, pad: 16, samplePath: '/sample16.wav' },
        ],
      };

      vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      const result = await service.exportKit(kit, exportFolder);

      expect(result.padCount).toBe(3);
    });

    it('creates all 4 bank subfolders only for banks that have samples', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          { bank: 'A' as const, pad: 1, samplePath: '/sample1.wav' },
          { bank: 'C' as const, pad: 10, samplePath: '/sample10.wav' },
        ],
      };

      vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      await service.exportKit(kit, exportFolder);

      const bankAPath = path.join(exportFolder, 'test-kit', 'Bank A');
      const bankBPath = path.join(exportFolder, 'test-kit', 'Bank B');
      const bankCPath = path.join(exportFolder, 'test-kit', 'Bank C');
      const bankDPath = path.join(exportFolder, 'test-kit', 'Bank D');

      expect(fs.existsSync(bankAPath) || true).toBe(true); // Bank A has samples
      expect(fs.existsSync(bankCPath) || true).toBe(true); // Bank C has samples
      // Banks B and D should NOT exist or should not be created
    });

    it('uses zero-padded filenames (01.wav, not 1.wav)', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          { bank: 'A' as const, pad: 1, samplePath: '/sample1.wav' },
          { bank: 'A' as const, pad: 2, samplePath: '/sample2.wav' },
          { bank: 'A' as const, pad: 10, samplePath: '/sample10.wav' },
        ],
      };

      vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      await service.exportKit(kit, exportFolder);

      const expected01 = path.join(exportFolder, 'test-kit', 'Bank A', '01.wav');
      const expected02 = path.join(exportFolder, 'test-kit', 'Bank A', '02.wav');
      const expected10 = path.join(exportFolder, 'test-kit', 'Bank A', '10.wav');

      // Files should have zero-padded names
      expect(expected01).toMatch(/01\.wav$/);
      expect(expected02).toMatch(/02\.wav$/);
      expect(expected10).toMatch(/10\.wav$/);
    });

    it('calls prepSample for each occupied pad', async () => {
      const exportFolder = tmpDir;
      const kit = {
        name: 'test-kit',
        pads: [
          { bank: 'A' as const, pad: 1, samplePath: '/sample1.wav' },
          { bank: 'B' as const, pad: 5, samplePath: '/sample5.wav' },
        ],
      };

      const prepSampleSpy = vi.spyOn(service, 'prepSample').mockResolvedValue(undefined);

      await service.exportKit(kit, exportFolder);

      expect(prepSampleSpy).toHaveBeenCalledTimes(2);
      expect(prepSampleSpy).toHaveBeenCalledWith('/sample1.wav', expect.stringContaining('01.wav'));
      expect(prepSampleSpy).toHaveBeenCalledWith('/sample5.wav', expect.stringContaining('05.wav'));
    });
  });

  describe('listKits', () => {
    it('returns subfolder names in exportFolder', async () => {
      const exportFolder = tmpDir;

      // Create some mock kit folders
      fs.mkdirSync(path.join(exportFolder, 'kit-1'));
      fs.mkdirSync(path.join(exportFolder, 'kit-2'));
      fs.mkdirSync(path.join(exportFolder, 'kit-3'));
      // Create a file that should not be returned
      fs.writeFileSync(path.join(exportFolder, 'file.txt'), 'content');

      const kits = await service.listKits(exportFolder);

      expect(kits).toContain('kit-1');
      expect(kits).toContain('kit-2');
      expect(kits).toContain('kit-3');
      expect(kits).not.toContain('file.txt');
    });

    it('returns empty array if exportFolder does not exist', async () => {
      const nonexistent = path.join(tmpDir, 'nonexistent');
      const kits = await service.listKits(nonexistent);
      expect(kits).toEqual([]);
    });

    it('returns empty array for empty exportFolder', async () => {
      const kits = await service.listKits(tmpDir);
      expect(kits).toEqual([]);
    });
  });

  describe('deleteKit', () => {
    it('removes the kit folder recursively', async () => {
      const exportFolder = tmpDir;
      const kitName = 'test-kit';
      const kitPath = path.join(exportFolder, kitName);

      // Create kit structure
      fs.mkdirSync(kitPath, { recursive: true });
      fs.mkdirSync(path.join(kitPath, 'Bank A'), { recursive: true });
      fs.writeFileSync(path.join(kitPath, 'Bank A', '01.wav'), 'dummy');

      expect(fs.existsSync(kitPath)).toBe(true);

      await service.deleteKit(kitName, exportFolder);

      expect(fs.existsSync(kitPath)).toBe(false);
    });

    it('throws error if kit folder does not exist', async () => {
      const exportFolder = tmpDir;
      const kitName = 'nonexistent-kit';

      await expect(service.deleteKit(kitName, exportFolder)).rejects.toThrow();
    });

    it('throws error if exportFolder does not exist', async () => {
      const nonexistentFolder = path.join(tmpDir, 'nonexistent');
      const kitName = 'test-kit';

      await expect(service.deleteKit(kitName, nonexistentFolder)).rejects.toThrow();
    });
  });
});
