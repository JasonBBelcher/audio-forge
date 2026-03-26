import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AudioToMidiService, type AudioToMidiParams } from '../audio-to-midi.service';
import { homedir } from 'os';
import { join } from 'path';

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    existsSync: vi.fn(),
    readFileSync: vi.fn(),
    readdirSync: vi.fn(),
    statSync: vi.fn(),
  };
});

// Mock runProcess
vi.mock('../../../main/utils/process-runner.js', () => ({
  runProcess: vi.fn(),
}));

// Mock platform-detector
vi.mock('../../../main/utils/platform-detector.js', () => ({
  detectPlatform: vi.fn(() => ({
    hasNvidiaGpu: false,
  })),
  basicPitchModelSerialization: vi.fn(() => 'onnx'),
}));

// Mock @tonejs/midi
vi.mock('@tonejs/midi', () => ({
  Midi: vi.fn().mockImplementation(() => ({
    header: {
      tempos: [{ bpm: 120 }],
      timeSignatures: [{ timeSignature: [4, 4] }],
      format: 0,
    },
    tracks: [
      {
        notes: [{ midi: 60 }, { midi: 62 }],
      },
    ],
    duration: 5.0,
  })),
}));

import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { runProcess } from '../../../main/utils/process-runner.js';

describe('AudioToMidiService', () => {
  let service: AudioToMidiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioToMidiService();
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('isInstalled()', () => {
    it('returns true when basicPitchBin file exists', async () => {
      const expectedPath = join(homedir(), '.audioforge-venv', 'bin', 'basic-pitch');
      (existsSync as any).mockReturnValue(true);

      const result = await service.isInstalled();

      expect(result).toBe(true);
      expect(existsSync).toHaveBeenCalledWith(expectedPath);
      expect(existsSync).toHaveBeenCalledTimes(1);
    });

    it('returns false when basicPitchBin file does not exist', async () => {
      const expectedPath = join(homedir(), '.audioforge-venv', 'bin', 'basic-pitch');
      (existsSync as any).mockReturnValue(false);

      const result = await service.isInstalled();

      expect(result).toBe(false);
      expect(existsSync).toHaveBeenCalledWith(expectedPath);
    });

    it('does not call runProcess (pure file check)', async () => {
      (existsSync as any).mockReturnValue(true);

      await service.isInstalled();

      expect(runProcess).not.toHaveBeenCalled();
    });
  });

  describe('install()', () => {
    it('skips venv creation if it already exists', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath);
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      // Should call runProcess for basic-pitch, resampy, scipy packages (not for venv creation)
      const calls = (runProcess as any).mock.calls;
      const venvCall = calls.find((call: any[]) =>
        call[1] && call[1].includes && call[1].includes('venv')
      );
      expect(venvCall).toBeUndefined();
    });

    it('creates venv and calls pip to install packages when venv does not exist', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');

      (existsSync as any).mockReturnValue(false);
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      // Should call runProcess for venv creation, basic-pitch, resampy, scipy
      expect(runProcess).toHaveBeenCalled();

      // Check that basic-pitch[onnx] was installed
      const calls = (runProcess as any).mock.calls;
      const basicPitchCall = calls.find((call: any[]) =>
        call[1] && call[1].includes && call[1].includes('basic-pitch[onnx]')
      );
      expect(basicPitchCall).toBeDefined();
    });

    it('includes basic-pitch[onnx] in install args', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      const calls = (runProcess as any).mock.calls;
      const basicPitchCall = calls.find((call: any[]) =>
        call[1] && call[1].includes && call[1].includes('basic-pitch[onnx]')
      );
      expect(basicPitchCall).toBeDefined();
      expect(basicPitchCall[1]).toContain('basic-pitch[onnx]');
    });

    it('includes scipy<1.12 constraint in install args', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      const calls = (runProcess as any).mock.calls;
      const scipyCall = calls.find((call: any[]) =>
        call[1] && call[1].includes && call[1].includes('scipy<1.12')
      );
      expect(scipyCall).toBeDefined();
      expect(scipyCall[1]).toContain('scipy<1.12');
    });

    it('includes resampy upgrade with --upgrade flag', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      const calls = (runProcess as any).mock.calls;
      const resampyCall = calls.find((call: any[]) => {
        const args = call[1];
        return args && Array.isArray(args) && args.includes('--upgrade') &&
               args.some((arg: string) => arg.includes('resampy'));
      });
      expect(resampyCall).toBeDefined();
      expect(resampyCall[1]).toContain('--upgrade');
      expect(resampyCall[1].some((arg: string) => arg.includes('resampy'))).toBe(true);
    });

    it('rejects if basic-pitch[onnx] install exits non-zero', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);

      (runProcess as any).mockImplementation((_bin: string, args: string[]) => {
        if (args.includes('-m') && args.includes('venv')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('basic-pitch[onnx]')) {
          return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Install failed' });
        }
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      await expect(service.install()).rejects.toThrow('basic-pitch[onnx] install failed');
    });

    it('does not throw if resampy upgrade fails (non-fatal)', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);

      (runProcess as any).mockImplementation((_bin: string, args: string[]) => {
        if (args.includes('-m') && args.includes('venv')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('basic-pitch[onnx]')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('resampy') && args.includes('--upgrade')) {
          return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Resampy failed' });
        }
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      // Should not throw - resampy failure is non-fatal
      await expect(service.install()).resolves.toBeUndefined();
    });

    it('does not throw if scipy downgrade fails (non-fatal)', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);

      (runProcess as any).mockImplementation((_bin: string, args: string[]) => {
        if (args.includes('-m') && args.includes('venv')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('basic-pitch[onnx]')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('resampy')) {
          return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
        }
        if (args.includes('scipy')) {
          return Promise.resolve({ exitCode: 1, stdout: '', stderr: 'Scipy failed' });
        }
        return Promise.resolve({ exitCode: 0, stdout: '', stderr: '' });
      });

      // Should not throw - scipy failure is non-fatal
      await expect(service.install()).resolves.toBeUndefined();
    });

    it('upgrades onnxruntime-gpu on NVIDIA GPU systems', async () => {
      const venvPythonPath = join(homedir(), '.audioforge-venv', 'bin', 'python');
      (existsSync as any).mockImplementation((path: string) => path === venvPythonPath ? false : false);

      const { detectPlatform } = await vi.importMock('../../../main/utils/platform-detector.js');
      (detectPlatform as any).mockReturnValue({ hasNvidiaGpu: true });

      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });

      await service.install();

      const calls = (runProcess as any).mock.calls;
      const gpuCall = calls.find((call: any[]) =>
        call[1] && call[1].includes && call[1].includes('onnxruntime-gpu')
      );
      expect(gpuCall).toBeDefined();
    });
  });

  describe('convert()', () => {
    beforeEach(() => {
      (existsSync as any).mockReturnValue(true);
      (readFileSync as any).mockReturnValue(Buffer.from([]));
      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: '', stderr: '' });
    });

    it('spawns basic-pitch binary directly', async () => {
      const expectedBin = join(homedir(), '.audioforge-venv', 'bin', 'basic-pitch');

      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(runProcess).toHaveBeenCalledWith(
        expectedBin,
        expect.any(Array),
        expect.any(Object)
      );
    });

    it('includes --save-midi in args', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      const args = (runProcess as any).mock.calls[0][1];
      expect(args).toContain('--save-midi');
    });

    it('includes --model-serialization onnx in args', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      const args = (runProcess as any).mock.calls[0][1];
      expect(args).toContain('--model-serialization');
      const index = args.indexOf('--model-serialization');
      expect(args[index + 1]).toBe('onnx');
    });

    it('includes --no-melodia flag in args', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      const args = (runProcess as any).mock.calls[0][1];
      expect(args).toContain('--no-melodia');
    });

    it('passes outputDir and inputPath as positional args', async () => {
      const inputPath = '/path/to/audio.wav';
      const outputDir = '/output';

      await service.convert({
        inputPath,
        outputDir,
      });

      const args = (runProcess as any).mock.calls[0][1];
      expect(args[args.length - 2]).toBe(outputDir);
      expect(args[args.length - 1]).toBe(inputPath);
    });

    it('returns midiPath with correct subdirectory pattern', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        if (path === '/path/to/audio.wav') return true;
        return path.includes('audio_basic_pitch.mid');
      });

      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.midiPath).toBe('/output/audio/audio_basic_pitch.mid');
    });

    it('returns midiPath with correct flat pattern (older versions)', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        if (path === '/path/to/audio.wav') return true;
        if (path.includes('/output/audio/audio_basic_pitch.mid')) return false;
        if (path === '/output/audio_basic_pitch.mid') return true;
        return false;
      });

      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.midiPath).toBe('/output/audio_basic_pitch.mid');
    });

    it('returns noteCount from mocked Midi (2 notes)', async () => {
      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.noteCount).toBe(2);
    });

    it('returns durationSec from mocked Midi (5.0)', async () => {
      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.durationSec).toBe(5.0);
    });

    it('returns estimatedTempo from mocked Midi (120)', async () => {
      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.estimatedTempo).toBe(120);
    });

    it('rejects with error containing stderr when exit code is non-zero', async () => {
      (runProcess as any).mockResolvedValue({
        exitCode: 1,
        stdout: '',
        stderr: 'Conversion error',
      });

      await expect(
        service.convert({
          inputPath: '/path/to/audio.wav',
          outputDir: '/output',
        })
      ).rejects.toThrow('Conversion failed: Conversion error');
    });

    it('rejects with error containing stdout if stderr is empty', async () => {
      (runProcess as any).mockResolvedValue({
        exitCode: 1,
        stdout: 'Something went wrong',
        stderr: '',
      });

      await expect(
        service.convert({
          inputPath: '/path/to/audio.wav',
          outputDir: '/output',
        })
      ).rejects.toThrow('Conversion failed: Something went wrong');
    });

    it('passes --onset-threshold when provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
        onsetThreshold: 0.7,
      });

      const args = (runProcess as any).mock.calls[0][1];
      const index = args.indexOf('--onset-threshold');
      expect(index).toBeGreaterThan(-1);
      expect(args[index + 1]).toBe('0.7');
    });

    it('passes --frame-threshold when provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
        frameThreshold: 0.4,
      });

      const args = (runProcess as any).mock.calls[0][1];
      const index = args.indexOf('--frame-threshold');
      expect(index).toBeGreaterThan(-1);
      expect(args[index + 1]).toBe('0.4');
    });

    it('passes --minimum-note-length when provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
        minimumNoteLength: 100,
      });

      const args = (runProcess as any).mock.calls[0][1];
      const index = args.indexOf('--minimum-note-length');
      expect(index).toBeGreaterThan(-1);
      expect(args[index + 1]).toBe('100');
    });

    it('passes --minimum-frequency when provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
        minimumFrequency: 50.0,
      });

      const args = (runProcess as any).mock.calls[0][1];
      const index = args.indexOf('--minimum-frequency');
      expect(index).toBeGreaterThan(-1);
      expect(args[index + 1]).toBe('50');
    });

    it('passes --maximum-frequency when provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
        maximumFrequency: 2000.0,
      });

      const args = (runProcess as any).mock.calls[0][1];
      const index = args.indexOf('--maximum-frequency');
      expect(index).toBeGreaterThan(-1);
      expect(args[index + 1]).toBe('2000');
    });

    it('does not pass optional params when not provided', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      const args = (runProcess as any).mock.calls[0][1];
      expect(args).not.toContain('--onset-threshold');
      expect(args).not.toContain('--frame-threshold');
      expect(args).not.toContain('--minimum-note-length');
      expect(args).not.toContain('--minimum-frequency');
      expect(args).not.toContain('--maximum-frequency');
    });

    it('throws error if input file does not exist', async () => {
      (existsSync as any).mockReturnValue(false);

      await expect(
        service.convert({
          inputPath: '/nonexistent/audio.wav',
          outputDir: '/output',
        })
      ).rejects.toThrow('Input file does not exist');
    });

    it('throws error if MIDI output file is not found', async () => {
      (existsSync as any).mockImplementation((path: string) => {
        if (path === '/path/to/audio.wav') return true;
        if (path.includes('_basic_pitch.mid')) return false;
        // Return false for directory checks too
        return false;
      });

      // Mock readdirSync to return empty arrays (no MIDI files found)
      (readdirSync as any).mockReturnValue([]);

      (runProcess as any).mockResolvedValue({ exitCode: 0, stdout: 'Process output', stderr: '' });

      await expect(
        service.convert({
          inputPath: '/path/to/audio.wav',
          outputDir: '/output',
        })
      ).rejects.toThrow(/basic-pitch ran successfully but produced no MIDI file/);
    });

    it('includes timeout in process options', async () => {
      await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      const options = (runProcess as any).mock.calls[0][2];
      expect(options.timeout).toBe(1800000);
    });

    it('returns undefined for estimatedTempo when no tempos in header', async () => {
      const { Midi } = await vi.importMock('@tonejs/midi');
      (Midi as any).mockImplementation(() => ({
        header: {
          tempos: [],
          timeSignatures: [{ timeSignature: [4, 4] }],
          format: 0,
        },
        tracks: [
          {
            notes: [{ midi: 60 }],
          },
        ],
        duration: 5.0,
      }));

      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.estimatedTempo).toBeUndefined();
    });

    it('sums note counts across multiple tracks', async () => {
      const { Midi } = await vi.importMock('@tonejs/midi');
      (Midi as any).mockImplementation(() => ({
        header: {
          tempos: [{ bpm: 120 }],
          timeSignatures: [{ timeSignature: [4, 4] }],
          format: 0,
        },
        tracks: [
          {
            notes: [{ midi: 60 }, { midi: 62 }],
          },
          {
            notes: [{ midi: 64 }, { midi: 65 }, { midi: 67 }],
          },
        ],
        duration: 5.0,
      }));

      const result = await service.convert({
        inputPath: '/path/to/audio.wav',
        outputDir: '/output',
      });

      expect(result.noteCount).toBe(5);
    });
  });
});
