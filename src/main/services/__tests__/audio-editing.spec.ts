import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { AudioService } from '../audio.service.js';
import { runProcess } from '../../utils/process-runner.js';

// Mock runProcess
vi.mock('../../utils/process-runner.js', () => ({
  runProcess: vi.fn(),
  getEnhancedEnv: vi.fn((extra) => ({ ...process.env, ...extra })),
}));

const mockRunProcess = runProcess as unknown as ReturnType<typeof vi.fn>;

describe('AudioService - Wave Editing', () => {
  let service: AudioService;

  beforeEach(() => {
    service = new AudioService();
    vi.clearAllMocks();
  });

  describe('fadeIn', () => {
    it('spawns ffmpeg with afade=t=in filter and correct duration', async () => {
      const inputPath = '/path/to/input.wav';
      const durationSec = 2;

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.fadeIn(inputPath, durationSec);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-i',
          inputPath,
          '-filter:a',
          'afade=t=in:ss=0:d=2',
          '-y',
          result,
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with _fadein suffix', async () => {
      const inputPath = '/path/to/input.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.fadeIn(inputPath, 1);

      expect(result).toMatch(/_fadein\.wav$/);
      expect(result).toContain('/path/to/input_fadein.wav');
    });

    it('accepts custom outputPath parameter', async () => {
      const inputPath = '/path/to/input.wav';
      const customOutput = '/custom/output.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.fadeIn(inputPath, 1, customOutput);

      expect(result).toBe(customOutput);
      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([customOutput]),
        expect.any(Object)
      );
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      await expect(service.fadeIn('/path/to/input.wav', 1)).rejects.toThrow();
    });
  });

  describe('fadeOut', () => {
    it('calls ffprobe to get duration before applying fadeOut', async () => {
      const inputPath = '/path/to/input.wav';
      const durationSec = 2;

      mockRunProcess
        .mockResolvedValueOnce({
          stdout: '10.5',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

      await service.fadeOut(inputPath, durationSec);

      // First call should be ffprobe
      expect(mockRunProcess).toHaveBeenNthCalledWith(
        1,
        'ffprobe',
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('spawns ffmpeg with afade=t=out at correct start time', async () => {
      const inputPath = '/path/to/input.wav';
      const fadeDuration = 2;
      const totalDuration = 10;

      mockRunProcess
        .mockResolvedValueOnce({
          stdout: totalDuration.toString(),
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.fadeOut(inputPath, fadeDuration);

      const expectedStartTime = totalDuration - fadeDuration; // 8
      expect(mockRunProcess).toHaveBeenNthCalledWith(
        2,
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          `afade=t=out:st=${expectedStartTime}:d=${fadeDuration}`,
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with _fadeout suffix', async () => {
      mockRunProcess
        .mockResolvedValueOnce({
          stdout: '10',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: '',
          exitCode: 0,
        });

      const result = await service.fadeOut('/path/to/input.wav', 1);

      expect(result).toMatch(/_fadeout\.wav$/);
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess
        .mockResolvedValueOnce({
          stdout: '10',
          stderr: '',
          exitCode: 0,
        })
        .mockResolvedValueOnce({
          stdout: '',
          stderr: 'ffmpeg error',
          exitCode: 1,
        });

      await expect(service.fadeOut('/path/to/input.wav', 1)).rejects.toThrow();
    });
  });

  describe('reverse', () => {
    it('spawns ffmpeg with areverse filter', async () => {
      const inputPath = '/path/to/input.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.reverse(inputPath);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          'areverse',
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with _reversed suffix', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.reverse('/path/to/input.wav');

      expect(result).toMatch(/_reversed\.wav$/);
    });

    it('accepts custom outputPath parameter', async () => {
      const customOutput = '/custom/output.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.reverse('/path/to/input.wav', customOutput);

      expect(result).toBe(customOutput);
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      await expect(service.reverse('/path/to/input.wav')).rejects.toThrow();
    });
  });

  describe('pitchShift', () => {
    it('spawns ffmpeg with correct pitch ratio for positive semitones', async () => {
      const inputPath = '/path/to/input.wav';
      const semitones = 12; // One octave up

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.pitchShift(inputPath, semitones);

      // 2^(12/12) = 2
      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          expect.stringContaining('2'),
        ]),
        expect.any(Object)
      );
    });

    it('spawns ffmpeg with correct pitch ratio for negative semitones', async () => {
      const inputPath = '/path/to/input.wav';
      const semitones = -12; // One octave down

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.pitchShift(inputPath, semitones);

      // 2^(-12/12) = 0.5
      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          expect.stringContaining('0.5'),
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with pitch offset', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pitchShift('/path/to/input.wav', 5);

      expect(result).toMatch(/_pitch\+5st\.wav$/);
    });

    it('generates correct default output filename with negative pitch offset', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pitchShift('/path/to/input.wav', -3);

      expect(result).toMatch(/_pitch-3st\.wav$/);
    });

    it('accepts custom outputPath parameter', async () => {
      const customOutput = '/custom/output.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.pitchShift('/path/to/input.wav', 5, customOutput);

      expect(result).toBe(customOutput);
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      await expect(service.pitchShift('/path/to/input.wav', 5)).rejects.toThrow();
    });
  });

  describe('timeStretch', () => {
    it('spawns ffmpeg with atempo=0.5 for factor 2 (slower)', async () => {
      const inputPath = '/path/to/input.wav';
      const factor = 2; // Half speed = slower

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.timeStretch(inputPath, factor);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          'atempo=0.5',
        ]),
        expect.any(Object)
      );
    });

    it('spawns ffmpeg with atempo=2 for factor 0.5 (faster)', async () => {
      const inputPath = '/path/to/input.wav';
      const factor = 0.5; // Double speed = faster

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.timeStretch(inputPath, factor);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          'atempo=2',
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with stretch factor', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.timeStretch('/path/to/input.wav', 1.5);

      expect(result).toMatch(/_stretch1\.5x\.wav$/);
    });

    it('accepts custom outputPath parameter', async () => {
      const customOutput = '/custom/output.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.timeStretch('/path/to/input.wav', 2, customOutput);

      expect(result).toBe(customOutput);
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      await expect(service.timeStretch('/path/to/input.wav', 2)).rejects.toThrow();
    });
  });

  describe('silenceRemove', () => {
    it('spawns ffmpeg with silenceremove filter chain with default threshold', async () => {
      const inputPath = '/path/to/input.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.silenceRemove(inputPath);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          '-filter:a',
          expect.stringContaining('silenceremove'),
          expect.stringContaining('-50'),
        ]),
        expect.any(Object)
      );
    });

    it('accepts custom threshold parameter', async () => {
      const inputPath = '/path/to/input.wav';
      const customThreshold = -60;

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      await service.silenceRemove(inputPath, customThreshold);

      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffmpeg',
        expect.arrayContaining([
          expect.stringContaining('-60'),
        ]),
        expect.any(Object)
      );
    });

    it('generates correct default output filename with _trimmed suffix', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.silenceRemove('/path/to/input.wav');

      expect(result).toMatch(/_trimmed\.wav$/);
    });

    it('accepts custom outputPath parameter', async () => {
      const customOutput = '/custom/output.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.silenceRemove('/path/to/input.wav', -50, customOutput);

      expect(result).toBe(customOutput);
    });

    it('rejects on ffmpeg failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      await expect(service.silenceRemove('/path/to/input.wav')).rejects.toThrow();
    });
  });

  describe('getDuration', () => {
    it('calls ffprobe and returns duration as number', async () => {
      const inputPath = '/path/to/input.wav';

      mockRunProcess.mockResolvedValue({
        stdout: '10.5',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.getDuration(inputPath);

      expect(result).toBe(10.5);
      expect(mockRunProcess).toHaveBeenCalledWith(
        'ffprobe',
        expect.arrayContaining([
          '-v',
          'error',
          '-show_entries',
          'format=duration',
          '-of',
          'default=noprint_wrappers=1:nokey=1',
          inputPath,
        ]),
        expect.any(Object)
      );
    });

    it('parses numeric output from ffprobe', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '42.123\n',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.getDuration('/path/to/input.wav');

      expect(typeof result).toBe('number');
      expect(result).toBe(42.123);
    });

    it('rejects on ffprobe failure', async () => {
      mockRunProcess.mockResolvedValue({
        stdout: '',
        stderr: 'ffprobe error',
        exitCode: 1,
      });

      await expect(service.getDuration('/path/to/input.wav')).rejects.toThrow();
    });
  });
});
