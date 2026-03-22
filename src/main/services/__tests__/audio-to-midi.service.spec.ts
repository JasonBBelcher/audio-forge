import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Readable } from 'stream';
import path from 'path';
import { AudioToMidiService, type AudioToMidiParams, type AudioToMidiResult } from '../audio-to-midi.service';

// Mock runProcess before importing the service
vi.mock('../../../main/utils/process-runner.js', () => ({
  runProcess: vi.fn(),
  getEnhancedEnv: vi.fn((extra) => ({ ...process.env, ...extra })),
}));

// Mock @tonejs/midi
vi.mock('@tonejs/midi', () => ({
  Midi: vi.fn().mockImplementation((buffer: Buffer) => ({
    header: {
      tempos: [{ bpm: 120 }],
      timeSignatures: [{ timeSignature: [4, 4] }],
      format: 0,
    },
    tracks: [
      { notes: [{ midi: 60 }, { midi: 62 }, { midi: 64 }, { midi: 65 }] },
    ],
    duration: 10.5,
  })),
}));

// Mock fs
vi.mock('fs', async () => {
  const actual = await vi.importActual<typeof import('fs')>('fs');
  return {
    ...actual,
    readFileSync: vi.fn((filePath: string) => {
      return Buffer.from([0x4d, 0x54, 0x68, 0x64]); // MThd header
    }),
    existsSync: vi.fn((filePath: string) => true),
  };
});

import { runProcess } from '../../../main/utils/process-runner';

describe('AudioToMidiService', () => {
  let service: AudioToMidiService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new AudioToMidiService();
  });

  describe('isInstalled', () => {
    it('should return true if basic_pitch is installed', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.isInstalled();

      expect(result).toBe(true);
      const calls = mockRunProcess.mock.calls;
      expect(calls[0][0]).toContain('python');
      expect(calls[0][1]).toEqual(['-c', 'import basic_pitch; print("OK")']);
    });

    it('should return false if basic_pitch is not installed', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: '',
        stderr: 'No module named basic_pitch',
        exitCode: 1,
      });

      const result = await service.isInstalled();

      expect(result).toBe(false);
    });
  });

  describe('install', () => {
    it('should spawn pip install basic_pitch', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Successfully installed basic_pitch',
        stderr: '',
        exitCode: 0,
      });

      await service.install();

      const calls = mockRunProcess.mock.calls;
      expect(calls[0][0]).toContain('pip');
      expect(calls[0][1]).toEqual(['install', 'basic_pitch']);
    });

    it('should throw error if pip install fails', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Error: Failed to install',
        exitCode: 1,
      });

      await expect(service.install()).rejects.toThrow('Installation failed');
    });
  });

  describe('convert', () => {
    const defaultParams: AudioToMidiParams = {
      inputPath: '/test/audio.wav',
      outputDir: '/test/output',
    };

    it('should spawn python -m basic_pitch with input and output paths', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.convert(defaultParams);

      expect(mockRunProcess).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        expect.arrayContaining(['basic_pitch', '/test/output', '/test/audio.wav']),
        expect.any(Object)
      );
      expect(result.midiPath).toBe('/test/output/audio_basic_pitch.mid');
    });

    it('should pass onset-threshold parameter when provided', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      await service.convert({
        ...defaultParams,
        onsetThreshold: 0.7,
      });

      expect(mockRunProcess).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        expect.arrayContaining(['--onset-threshold', '0.7']),
        expect.any(Object)
      );
    });

    it('should pass frame-threshold parameter when provided', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      await service.convert({
        ...defaultParams,
        frameThreshold: 0.4,
      });

      expect(mockRunProcess).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        expect.arrayContaining(['--frame-threshold', '0.4']),
        expect.any(Object)
      );
    });

    it('should pass minimum-note-length parameter when provided', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      await service.convert({
        ...defaultParams,
        minimumNoteLength: 100,
      });

      expect(mockRunProcess).toHaveBeenCalledWith(
        expect.stringContaining('python'),
        expect.arrayContaining(['--minimum-note-length', '100']),
        expect.any(Object)
      );
    });

    it('should include all optional parameters', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      await service.convert({
        inputPath: '/test/audio.wav',
        outputDir: '/test/output',
        onsetThreshold: 0.6,
        frameThreshold: 0.35,
        minimumNoteLength: 75,
        minimumFrequency: 50,
        maximumFrequency: 2000,
        inferOnsets: false,
        maxPolyphony: 64,
      });

      const callArgs = mockRunProcess.mock.calls[0];
      expect(callArgs[1]).toContain('--onset-threshold');
      expect(callArgs[1]).toContain('0.6');
      expect(callArgs[1]).toContain('--frame-threshold');
      expect(callArgs[1]).toContain('0.35');
      expect(callArgs[1]).toContain('--minimum-note-length');
      expect(callArgs[1]).toContain('75');
      expect(callArgs[1]).toContain('--minimum-frequency');
      expect(callArgs[1]).toContain('50');
      expect(callArgs[1]).toContain('--maximum-frequency');
      expect(callArgs[1]).toContain('2000');
    });

    it('should return correct MIDI path based on input basename', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.convert({
        inputPath: '/path/to/mysong.mp3',
        outputDir: '/out',
      });

      expect(result.midiPath).toBe('/out/mysong_basic_pitch.mid');
    });

    it('should parse noteCount from MIDI file', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.convert(defaultParams);

      expect(result.noteCount).toBe(4); // 4 notes in mocked MIDI
    });

    it('should parse durationSec from MIDI file', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.convert(defaultParams);

      expect(result.durationSec).toBe(10.5);
    });

    it('should extract estimatedTempo from MIDI file', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      const result = await service.convert(defaultParams);

      expect(result.estimatedTempo).toBe(120);
    });

    it('should throw error if conversion process fails with non-zero exit code', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: '',
        stderr: 'Error processing audio',
        exitCode: 1,
      });

      await expect(service.convert(defaultParams)).rejects.toThrow(
        'Audio to MIDI conversion failed'
      );
    });

    it('should throw error if conversion process is rejected', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockRejectedValueOnce(new Error('Process error'));

      await expect(service.convert(defaultParams)).rejects.toThrow('Process error');
    });

    it('should throw error if input file does not exist', async () => {
      const { existsSync } = await import('fs');
      const mockExistsSync = vi.mocked(existsSync);
      mockExistsSync.mockReturnValueOnce(false);

      await expect(service.convert(defaultParams)).rejects.toThrow(
        'Input file does not exist'
      );
    });

    it('should call runProcess with timeout option', async () => {
      const mockRunProcess = vi.mocked(runProcess);
      mockRunProcess.mockResolvedValueOnce({
        stdout: 'Progress: 100% Done',
        stderr: '',
        exitCode: 0,
      });

      await service.convert(defaultParams);

      expect(mockRunProcess).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Array),
        expect.objectContaining({
          timeout: expect.any(Number),
        })
      );
    });
  });
});
