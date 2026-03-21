import { describe, it, expect, beforeEach, vi, type MockedFunction } from 'vitest';

// ── Mock Web APIs ─────────────────────────────────────────────────────────────

const mockStop = vi.fn();
const mockStart = vi.fn();
const mockMediaRecorder = vi.fn().mockImplementation(() => ({
  start: mockStart,
  stop: mockStop,
  state: 'inactive',
  ondataavailable: null,
  onstop: null,
}));
(mockMediaRecorder as any).isTypeSupported = vi.fn().mockReturnValue(true);

const mockGetUserMedia = vi.fn();
// navigator is read-only in node; use defineProperty
Object.defineProperty(global, 'navigator', {
  value: { mediaDevices: { getUserMedia: mockGetUserMedia } },
  writable: true,
  configurable: true,
});
global.MediaRecorder = mockMediaRecorder as any;
global.AudioContext = vi.fn().mockImplementation(() => ({
  decodeAudioData: vi.fn().mockResolvedValue({ duration: 3.5, numberOfChannels: 2 }),
  state: 'running',
  resume: vi.fn(),
  createGain: vi.fn().mockReturnValue({ gain: { value: 1 }, connect: vi.fn() }),
  destination: {},
  currentTime: 0,
})) as any;

// ── Tests ─────────────────────────────────────────────────────────────────────

describe('RecordingService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  it('is not recording initially', async () => {
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    expect(svc.isRecording()).toBe(false);
  });

  it('requests microphone permission on start', async () => {
    mockGetUserMedia.mockResolvedValue({ getTracks: () => [] });
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('track-1');
    expect(mockGetUserMedia).toHaveBeenCalledWith({ audio: true, video: false });
  });

  it('sets isRecording to true after start', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('track-1');
    expect(svc.isRecording()).toBe(true);
  });

  it('sets isRecording to false after stop', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('track-1');
    svc.stop();
    expect(svc.isRecording()).toBe(false);
  });

  it('throws if start called while already recording', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('track-1');
    await expect(svc.start('track-2')).rejects.toThrow('Already recording');
  });

  it('throws if getUserMedia is denied', async () => {
    mockGetUserMedia.mockRejectedValue(new Error('Permission denied'));
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await expect(svc.start('track-1')).rejects.toThrow('Permission denied');
    expect(svc.isRecording()).toBe(false);
  });

  it('stops all stream tracks on stop', async () => {
    const mockTrackStop = vi.fn();
    const mockStream = { getTracks: () => [{ stop: mockTrackStop }, { stop: mockTrackStop }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('track-1');
    svc.stop();
    expect(mockTrackStop).toHaveBeenCalledTimes(2);
  });

  it('getTrackId returns current recording track', async () => {
    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    await svc.start('my-track');
    expect(svc.getTrackId()).toBe('my-track');
  });

  it('getTrackId returns null when not recording', async () => {
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    expect(svc.getTrackId()).toBeNull();
  });

  it('calls onComplete callback when recording finishes', async () => {
    const onComplete = vi.fn();
    let recorderInstance: any;
    mockMediaRecorder.mockImplementation(() => {
      recorderInstance = {
        start: mockStart,
        stop: vi.fn().mockImplementation(function(this: any) {
          // Simulate data available + stop
          setTimeout(() => {
            this.ondataavailable?.({ data: new Blob(['audio'], { type: 'audio/webm' }) });
            this.onstop?.();
          }, 10);
        }),
        state: 'inactive',
        ondataavailable: null,
        onstop: null,
      };
      return recorderInstance;
    });

    const mockStream = { getTracks: () => [{ stop: vi.fn() }] };
    mockGetUserMedia.mockResolvedValue(mockStream);
    const { RecordingService } = await import('../recordingService');
    const svc = new RecordingService();
    svc.onComplete = onComplete;
    await svc.start('track-1');
    svc.stop();
    await new Promise(r => setTimeout(r, 50));
    expect(onComplete).toHaveBeenCalledWith('track-1', expect.any(Blob));
  });
});
