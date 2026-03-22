import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LoopDetectorService, LoopPoint } from '../../../../src/main/services/loop-detector.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('LoopDetectorService', () => {
  let loopDetector: LoopDetectorService;

  beforeEach(() => {
    loopDetector = new LoopDetectorService();
    vi.clearAllMocks();
  });

  describe('detectLoops', () => {
    it('calculates correct 1-bar duration with known BPM', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      // Mock ffprobe call for duration
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 120);

      expect(result.loops).toBeDefined();
      expect(Array.isArray(result.loops)).toBe(true);
      expect(result.suggestedBpm).toBe(120);
    });

    it('returns loop candidates at 1, 2, 4, 8 bar lengths', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      // Mock ffprobe call for duration
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 120);

      // Bar duration at 120 BPM = 60/120 * 4 = 2 seconds
      // 1-bar: 2s, 2-bar: 4s, 4-bar: 8s, 8-bar: 16s
      const durations = result.loops.map((l) => l.durationSec);

      expect(durations).toContain(2); // 1-bar
      expect(durations).toContain(4); // 2-bar
      expect(durations).toContain(8); // 4-bar
      expect(durations).toContain(16); // 8-bar
    });

    it('spawns aubio onset to estimate tempo if BPM not provided', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');

      // First call: aubio tempo detection
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '120.0',
        stderr: '',
        exitCode: 0,
      });

      // Second call: ffprobe for duration
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav');

      // Should have detected loops without explicit BPM
      expect(result.loops).toBeDefined();
      expect(result.loops.length).toBeGreaterThan(0);
    });

    it('returns total duration in result', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 120);

      expect(result.totalDuration).toBeDefined();
      expect(typeof result.totalDuration).toBe('number');
    });

    it('sets confidence on loop points', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 120);

      result.loops.forEach((loop) => {
        expect(loop.confidence).toBeDefined();
        expect(typeof loop.confidence).toBe('number');
        expect(loop.confidence).toBeGreaterThanOrEqual(0);
        expect(loop.confidence).toBeLessThanOrEqual(1);
      });
    });

    it('starts all loops at time 0', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 120);

      result.loops.forEach((loop) => {
        expect(loop.startSec).toBe(0);
      });
    });
  });

  describe('extractLoop', () => {
    it('calls ffmpeg with -ss and -t arguments', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const loop: LoopPoint = {
        startSec: 0,
        endSec: 8,
        durationSec: 8,
        confidence: 0.9,
        bpm: 120,
      };

      await loopDetector.extractLoop('/path/to/audio.wav', loop, '/path/to/output.wav');

      expect(vi.mocked(runProcess)).toHaveBeenCalled();
      const callArgs = vi.mocked(runProcess).mock.calls[0];
      const args = callArgs[1] as string[];

      // Should have -ss and -t arguments
      expect(args).toContain('-ss');
      expect(args).toContain('0');
      expect(args).toContain('-t');
      expect(args).toContain('8');
    });

    it('applies crossfade filter with afade', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const loop: LoopPoint = {
        startSec: 0,
        endSec: 8,
        durationSec: 8,
        confidence: 0.9,
        bpm: 120,
      };

      await loopDetector.extractLoop('/path/to/audio.wav', loop, '/path/to/output.wav');

      const callArgs = vi.mocked(runProcess).mock.calls[0];
      const args = callArgs[1] as string[];

      // Should have -af (audio filter) with afade
      expect(args.join(' ')).toMatch(/afade/);
    });

    it('returns output path', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const loop: LoopPoint = {
        startSec: 0,
        endSec: 8,
        durationSec: 8,
        confidence: 0.9,
        bpm: 120,
      };

      const outputPath = '/path/to/output.wav';
      const result = await loopDetector.extractLoop('/path/to/audio.wav', loop, outputPath);

      expect(result).toBe(outputPath);
    });

    it('generates default output path if none provided', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '',
        stderr: '',
        exitCode: 0,
      });

      const loop: LoopPoint = {
        startSec: 0,
        endSec: 8,
        durationSec: 8,
        confidence: 0.9,
        bpm: 120,
      };

      const result = await loopDetector.extractLoop('/path/to/audio.wav', loop);

      expect(result).toBeDefined();
      expect(typeof result).toBe('string');
      expect(result).toMatch(/\.wav$/);
      expect(result).toMatch(/loop/);
    });

    it('throws error if ffmpeg fails', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '',
        stderr: 'ffmpeg error',
        exitCode: 1,
      });

      const loop: LoopPoint = {
        startSec: 0,
        endSec: 8,
        durationSec: 8,
        confidence: 0.9,
        bpm: 120,
      };

      await expect(loopDetector.extractLoop('/path/to/audio.wav', loop)).rejects.toThrow();
    });
  });

  describe('edge cases', () => {
    it('handles very short audio (< 1 second)', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '0.5',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/short.wav', 120);

      expect(result).toBeDefined();
      expect(result.loops).toBeDefined();
    });

    it('handles very high BPM (200+)', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 200);

      expect(result.loops).toBeDefined();
      expect(result.suggestedBpm).toBe(200);
    });

    it('handles very low BPM (40)', async () => {
      const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
      vi.mocked(runProcess).mockResolvedValueOnce({
        stdout: '60.0',
        stderr: '',
        exitCode: 0,
      });

      const result = await loopDetector.detectLoops('/path/to/audio.wav', 40);

      expect(result.loops).toBeDefined();
      expect(result.suggestedBpm).toBe(40);
    });
  });
});
