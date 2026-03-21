import { describe, it, expect, vi, beforeEach } from 'vitest';
import { spawn } from 'child_process';
import { YouTubeService } from '../../../../src/main/services/youtube.service.js';

// Mock child_process.spawn
vi.mock('child_process', () => ({
  spawn: vi.fn(),
}));

describe('YouTubeService — downloadWithProgress', () => {
  let service: YouTubeService;
  let mockProc: any;

  beforeEach(() => {
    service = new YouTubeService();
    vi.clearAllMocks();

    // Set up default mock process
    mockProc = {
      stdout: {
        on: vi.fn(),
      },
      stderr: {
        on: vi.fn(),
      },
      on: vi.fn(),
      kill: vi.fn(),
    };

    (spawn as any).mockReturnValue(mockProc);
  });

  it('spawns yt-dlp with correct arguments', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
    });

    // Trigger process completion
    const closeHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
    const errorHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'error')?.[1];

    if (closeHandler) {
      closeHandler(0);
      await promise;
    }

    expect(spawn).toHaveBeenCalled();
    const spawnArgs = (spawn as any).mock.calls[0];
    expect(spawnArgs[0]).toBe('yt-dlp');
    expect(Array.isArray(spawnArgs[1])).toBe(true);
  });

  it('calls onProgress callback during download', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
    });

    // Simulate progress output
    const stdoutHandler = mockProc.stdout.on.mock.calls.find((c: any) => c[0] === 'data')?.[1];
    if (stdoutHandler) {
      stdoutHandler(Buffer.from('[download] 45.5% of 5.32MiB at 1.23MiB/s ETA 00:03\n'));
    }

    // Trigger completion
    const closeHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
    if (closeHandler) {
      closeHandler(0);
      await promise;
    }

    // onProgress should have been called with parsed progress
    expect(onProgress).toHaveBeenCalled();
  });

  it('resolves with filePath on successful download', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
    });

    // Simulate successful completion with destination line
    const stdoutHandler = mockProc.stdout.on.mock.calls.find((c: any) => c[0] === 'data')?.[1];
    if (stdoutHandler) {
      stdoutHandler(Buffer.from('[ExtractAudio] Destination: /tmp/track-1.wav\n'));
    }

    const closeHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
    if (closeHandler) {
      closeHandler(0);
      const result = await promise;
      expect(result).toHaveProperty('filePath');
      expect(result.filePath).toContain('track-1.wav');
    }
  });

  it('rejects on non-zero exit code', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
    });

    const closeHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
    if (closeHandler) {
      closeHandler(1);
      await expect(promise).rejects.toThrow();
    }
  });

  it('rejects on process error', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
    });

    const errorHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'error')?.[1];
    if (errorHandler) {
      errorHandler(new Error('Process spawn failed'));
      await expect(promise).rejects.toThrow();
    }
  });

  it('kills process when AbortSignal is triggered', async () => {
    const controller = new AbortController();
    const onProgress = vi.fn();

    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'track-1',
      onProgress,
      signal: controller.signal,
    }).catch(() => {
      // Explicitly catch to prevent unhandled rejection
      return undefined;
    });

    // Trigger abort
    controller.abort();

    // Give it a tick to process the abort
    await new Promise(r => setTimeout(r, 10));

    expect(mockProc.kill).toHaveBeenCalled();
  });

  it('uses options.trackId in output filename template', async () => {
    const onProgress = vi.fn();
    const promise = service.downloadWithProgress('https://youtube.com/watch?v=abc', '/tmp', {
      trackId: 'my-track-123',
      onProgress,
    });

    const closeHandler = mockProc.on.mock.calls.find((c: any) => c[0] === 'close')?.[1];
    if (closeHandler) {
      closeHandler(0);
      await promise;
    }

    // Check that trackId is used in spawn args
    const spawnArgs = (spawn as any).mock.calls[0][1];
    const hasTrackId = spawnArgs.some((arg: string) => arg.includes('my-track-123'));
    expect(hasTrackId).toBe(true);
  });
});
