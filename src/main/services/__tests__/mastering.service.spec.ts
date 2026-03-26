import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EventEmitter } from 'events';
import { MasteringService, type MasteringParams } from '../mastering.service';

// Mock child_process
vi.mock('child_process');

// Mock getEnhancedEnv
vi.mock('../../utils/process-runner.js', () => ({
  getEnhancedEnv: vi.fn(() => process.env)
}));

import { spawn } from 'child_process';

/**
 * Helper to create a fake process object that emits stdout, stderr, and close events.
 * Simulates the EventEmitter-based spawn result.
 */
function makeFakeProcess(
  stdoutData: string = '',
  stderrData: string = '',
  exitCode: number = 0,
  shouldError: boolean = false,
  errorMessage: string = ''
) {
  const proc = new EventEmitter() as any;
  proc.stdout = new EventEmitter();
  proc.stderr = new EventEmitter();

  // Emit data and close asynchronously to allow promise handling
  setImmediate(() => {
    if (shouldError) {
      proc.emit('error', new Error(errorMessage));
    } else {
      if (stdoutData) {
        proc.stdout.emit('data', Buffer.from(stdoutData));
      }
      if (stderrData) {
        proc.stderr.emit('data', Buffer.from(stderrData));
      }
      proc.emit('close', exitCode);
    }
  });

  return proc;
}

describe('MasteringService', () => {
  let service: MasteringService;

  beforeEach(() => {
    service = new MasteringService();
    vi.clearAllMocks();
  });

  describe('analyze()', () => {
    it('should parse loudnorm JSON from stderr and return LUFS, peak, and LRA', async () => {
      const loudnormJson = '[loudnorm@0x7f1234567890] {"input_i" : "-18.5","input_tp" : "-3.2","input_lra" : "6.1"}';

      const fakeProc = makeFakeProcess('', loudnormJson, 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      expect(result).toEqual({
        inputLufs: -18.5,
        inputPeakDb: -3.2,
        inputDynamicRange: 6.1
      });
    });

    it('should return fallback values when ffmpeg exits with non-zero code', async () => {
      const fakeProc = makeFakeProcess('', 'error output', 1);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      expect(result).toEqual({
        inputLufs: -23,
        inputPeakDb: -1,
        inputDynamicRange: 8
      });
    });

    it('should return fallback values when JSON is absent from stderr', async () => {
      const stderrData = 'Some error output without JSON';
      const fakeProc = makeFakeProcess('', stderrData, 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      expect(result).toEqual({
        inputLufs: -23,
        inputPeakDb: -1,
        inputDynamicRange: 8
      });
    });

    it('should return fallback values when JSON is malformed', async () => {
      const loudnormData = '[loudnorm@0x7f1234567890] {"input_i" : "not a number", malformed}';

      const fakeProc = makeFakeProcess('', loudnormData, 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      expect(result).toEqual({
        inputLufs: -23,
        inputPeakDb: -1,
        inputDynamicRange: 8
      });
    });

    it('should call ffmpeg with loudnorm filter and -f null - arguments', async () => {
      const fakeProc = makeFakeProcess('', '[loudnorm@0x123] {"input_i":"-23"}', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.analyze('/path/to/audio.wav');

      expect(spawn).toHaveBeenCalledWith(
        'ffmpeg',
        [
          '-i',
          '/path/to/audio.wav',
          '-af',
          'loudnorm=I=-23:TP=-2:LRA=7:print_format=json',
          '-f',
          'null',
          '-'
        ],
        expect.objectContaining({
          stdio: ['ignore', 'pipe', 'pipe']
        })
      );
    });

    it('should reject with error message when spawn emits error event', async () => {
      const fakeProc = makeFakeProcess('', '', 0, true, 'ffmpeg not found');
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await expect(service.analyze('/path/to/audio.wav')).rejects.toThrow(
        /Analysis process failed: ffmpeg not found/
      );
    });

    it('should handle multiple data events concatenating stderr', async () => {
      const part1 = '[loudnorm@0x123] {"input_i": "-18.5",';
      const part2 = '"input_tp": "-3.2","input_lra": "6.1"}';

      const fakeProc = new EventEmitter() as any;
      fakeProc.stdout = new EventEmitter();
      fakeProc.stderr = new EventEmitter();

      setImmediate(() => {
        fakeProc.stderr.emit('data', Buffer.from(part1));
        fakeProc.stderr.emit('data', Buffer.from(part2));
        fakeProc.emit('close', 0);
      });

      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      expect(result).toEqual({
        inputLufs: -18.5,
        inputPeakDb: -3.2,
        inputDynamicRange: 6.1
      });
    });

    it('should use default fallback values for missing JSON properties', async () => {
      const loudnormJson = '[loudnorm@0x123] {}';

      const fakeProc = makeFakeProcess('', loudnormJson, 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const result = await service.analyze('/path/to/audio.wav');

      // When JSON properties are missing, parseFloat(undefined ?? defaultValue) is used
      expect(result).toEqual({
        inputLufs: -23,
        inputPeakDb: -1,
        inputDynamicRange: 8
      });
    });
  });

  describe('master()', () => {
    const defaultParams: MasteringParams = {
      inputPath: '/input/audio.wav',
      outputPath: '/output/mastered.wav',
      eq: {
        lowFreq: 100,
        lowGain: 3,
        midFreq: 1000,
        midGain: 2,
        midWidth: 1,
        highFreq: 10000,
        highGain: 2
      },
      compressor: {
        threshold: -20,
        ratio: 4,
        attack: 5,
        release: 50,
        makeupGain: 10
      },
      targetLufs: -14,
      ceilingDbtp: -1
    };

    it('should build filter chain including loudnorm and alimiter', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3]; // -af argument value

      expect(filterChainArg).toContain('loudnorm=I=-14:TP=-1:LRA=11');
      expect(filterChainArg).toContain('alimiter=level_in=1:level_out=1:limit=');
      expect(filterChainArg).toContain(':attack=5:release=50');
    });

    it('should include equalizer for low band when lowGain is non-zero', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      expect(filterChainArg).toContain('equalizer=f=100:width_type=h:width=50:g=3');
    });

    it('should skip equalizer for low band when lowGain <= 0.1dB', async () => {
      const params = {
        ...defaultParams,
        eq: { ...defaultParams.eq, lowGain: 0.05 }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Should not include low band equalizer
      expect(filterChainArg).not.toMatch(/equalizer=f=100:width_type=h/);
    });

    it('should include equalizer for mid band when midGain is non-zero', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      expect(filterChainArg).toContain('equalizer=f=1000:width_type=o:width=1:g=2');
    });

    it('should skip equalizer for mid band when midGain <= 0.1dB', async () => {
      const params = {
        ...defaultParams,
        eq: { ...defaultParams.eq, midGain: 0.05 }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Should not include mid band equalizer
      expect(filterChainArg).not.toMatch(/equalizer=f=1000:width_type=o/);
    });

    it('should include equalizer for high band when highGain is non-zero', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      expect(filterChainArg).toContain('equalizer=f=10000:width_type=h:width=5000:g=2');
    });

    it('should skip equalizer for high band when highGain <= 0.1dB', async () => {
      const params = {
        ...defaultParams,
        eq: { ...defaultParams.eq, highGain: 0.05 }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Should not include high band equalizer
      expect(filterChainArg).not.toMatch(/equalizer=f=10000:width_type=h/);
    });

    it('should include acompressor when ratio > 1.1', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      expect(filterChainArg).toContain('acompressor=threshold=-20dB:ratio=4:attack=5:release=50:makeup=10dB');
    });

    it('should skip acompressor when ratio <= 1.1', async () => {
      const params = {
        ...defaultParams,
        compressor: { ...defaultParams.compressor, ratio: 1.0 }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      expect(filterChainArg).not.toContain('acompressor');
    });

    it('should pass -y flag and outputPath to ffmpeg args', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const args = callArgs[1];

      expect(args).toContain('-y');
      expect(args).toContain('/output/mastered.wav');
    });

    it('should resolve on exit code 0', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await expect(service.master(defaultParams)).resolves.toBeUndefined();
    });

    it('should reject with stderr content on non-zero exit code', async () => {
      const stderrContent = 'ffmpeg error: invalid codec';
      const fakeProc = makeFakeProcess('', stderrContent, 1);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const promise = service.master(defaultParams);
      await expect(promise).rejects.toThrow(/Mastering failed/);
      await expect(promise).rejects.toThrow(/invalid codec/);
    });

    it('should reject when spawn emits error event', async () => {
      const fakeProc = makeFakeProcess('', '', 0, true, 'spawn ENOENT');
      vi.mocked(spawn).mockReturnValue(fakeProc);

      const promise = service.master(defaultParams);
      await expect(promise).rejects.toThrow(/Mastering process failed/);
      await expect(promise).rejects.toThrow(/spawn ENOENT/);
    });

    it('should calculate alimiter linear ceiling correctly for -1dBTP', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // -1dBTP: 10^(-1/20) ≈ 0.8913
      const expectedLinearCeiling = Math.pow(10, -1 / 20);
      const limitPattern = new RegExp(`alimiter=level_in=1:level_out=1:limit=${expectedLinearCeiling.toFixed(4)}`);

      // Check that the limit value is approximately correct
      expect(filterChainArg).toMatch(/alimiter=level_in=1:level_out=1:limit=0\.89/);
    });

    it('should calculate alimiter linear ceiling correctly for -3dBTP', async () => {
      const params = { ...defaultParams, ceilingDbtp: -3 };
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // -3dBTP: 10^(-3/20) ≈ 0.7079
      expect(filterChainArg).toMatch(/alimiter=level_in=1:level_out=1:limit=0\.70/);
    });

    it('should handle multiple stderr data events', async () => {
      const fakeProc = new EventEmitter() as any;
      fakeProc.stdout = new EventEmitter();
      fakeProc.stderr = new EventEmitter();

      setImmediate(() => {
        fakeProc.stderr.emit('data', Buffer.from('error part 1 '));
        fakeProc.stderr.emit('data', Buffer.from('error part 2'));
        fakeProc.emit('close', 1);
      });

      vi.mocked(spawn).mockReturnValue(fakeProc);

      await expect(service.master(defaultParams)).rejects.toThrow(/error part 1 error part 2/);
    });

    it('should include input and output paths in ffmpeg args', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const args = callArgs[1];

      expect(args).toContain('-i');
      expect(args).toContain('/input/audio.wav');
      expect(args).toContain('-af');
      expect(args).toContain('/output/mastered.wav');
    });

    it('should join multiple EQ filters with comma separator', async () => {
      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(defaultParams);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Should contain all three EQ filters separated by commas
      const eqMatches = filterChainArg.match(/equalizer/g);
      expect(eqMatches).toHaveLength(3);
    });

    it('should handle all gains being below threshold (no EQ applied)', async () => {
      const params = {
        ...defaultParams,
        eq: {
          lowFreq: 100,
          lowGain: 0.05,
          midFreq: 1000,
          midGain: 0.05,
          midWidth: 1,
          highFreq: 10000,
          highGain: 0.05
        }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Should not contain equalizer filters
      expect(filterChainArg).not.toContain('equalizer');
      // Should still contain loudnorm and alimiter
      expect(filterChainArg).toContain('loudnorm');
      expect(filterChainArg).toContain('alimiter');
    });

    it('should handle negative gains properly', async () => {
      const params = {
        ...defaultParams,
        eq: {
          lowFreq: 100,
          lowGain: -3,
          midFreq: 1000,
          midGain: -2,
          midWidth: 1,
          highFreq: 10000,
          highGain: -2
        }
      };

      const fakeProc = makeFakeProcess('', '', 0);
      vi.mocked(spawn).mockReturnValue(fakeProc);

      await service.master(params);

      const callArgs = vi.mocked(spawn).mock.calls[0];
      const filterChainArg = callArgs[1]?.[3];

      // Negative gains should be included (abs > 0.1)
      expect(filterChainArg).toContain('equalizer=f=100:width_type=h:width=50:g=-3');
      expect(filterChainArg).toContain('equalizer=f=1000:width_type=o:width=1:g=-2');
      expect(filterChainArg).toContain('equalizer=f=10000:width_type=h:width=5000:g=-2');
    });
  });
});
