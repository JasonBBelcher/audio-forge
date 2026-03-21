import { describe, it, expect, beforeEach, vi } from 'vitest';
import { audioBufferToWav, ExportService } from '../exportService';

// ── Mock OfflineAudioContext ──────────────────────────────────────────────────

function makeMockAudioBuffer(channels = 2, length = 44100, sampleRate = 44100) {
  const channelData = Array.from({ length: channels }, () => new Float32Array(length).fill(0.5));
  return {
    numberOfChannels: channels,
    length,
    sampleRate,
    getChannelData: vi.fn((ch: number) => channelData[ch]),
    duration: length / sampleRate,
  };
}

const mockRenderedBuffer = makeMockAudioBuffer();

const mockOfflineCtx = {
  createBufferSource: vi.fn(() => ({
    buffer: null as any,
    connect: vi.fn(),
    start: vi.fn(),
  })),
  createGain: vi.fn(() => ({
    gain: { value: 1 },
    connect: vi.fn(),
  })),
  destination: {},
  startRendering: vi.fn().mockResolvedValue(mockRenderedBuffer),
};

global.OfflineAudioContext = vi.fn(() => mockOfflineCtx) as any;

// ── Mock window.audioforge bridge ─────────────────────────────────────────────

const mockAudioforge = {
  files: {
    showSaveDialog: vi.fn().mockResolvedValue({ canceled: false, filePath: '/tmp/mix.wav' }),
    writeFile: vi.fn().mockResolvedValue(undefined),
  },
};
(global as any).window = { audioforge: mockAudioforge };

// ── audioBufferToWav ──────────────────────────────────────────────────────────

describe('audioBufferToWav', () => {
  it('returns an ArrayBuffer', () => {
    const buf = makeMockAudioBuffer(2, 100, 44100);
    const result = audioBufferToWav(buf as any);
    expect(result).toBeInstanceOf(ArrayBuffer);
  });

  it('starts with RIFF header magic', () => {
    const buf = makeMockAudioBuffer(2, 100, 44100);
    const result = audioBufferToWav(buf as any);
    const view = new DataView(result);
    const riff = String.fromCharCode(view.getUint8(0), view.getUint8(1), view.getUint8(2), view.getUint8(3));
    expect(riff).toBe('RIFF');
  });

  it('contains WAVE format identifier', () => {
    const buf = makeMockAudioBuffer(2, 100, 44100);
    const result = audioBufferToWav(buf as any);
    const view = new DataView(result);
    const wave = String.fromCharCode(view.getUint8(8), view.getUint8(9), view.getUint8(10), view.getUint8(11));
    expect(wave).toBe('WAVE');
  });

  it('encodes correct sample rate in header', () => {
    const buf = makeMockAudioBuffer(2, 100, 48000);
    const result = audioBufferToWav(buf as any);
    const view = new DataView(result);
    expect(view.getUint32(24, true)).toBe(48000);
  });

  it('encodes correct channel count in header', () => {
    const buf = makeMockAudioBuffer(1, 100, 44100);
    const result = audioBufferToWav(buf as any);
    const view = new DataView(result);
    expect(view.getUint16(22, true)).toBe(1);
  });

  it('produces correct total byte length (header + PCM data)', () => {
    const channels = 2;
    const length = 100;
    const buf = makeMockAudioBuffer(channels, length, 44100);
    const result = audioBufferToWav(buf as any);
    // 44-byte header + samples * channels * 2 bytes (16-bit)
    expect(result.byteLength).toBe(44 + length * channels * 2);
  });

  it('handles mono audio', () => {
    const buf = makeMockAudioBuffer(1, 50, 44100);
    const result = audioBufferToWav(buf as any);
    const view = new DataView(result);
    expect(view.getUint16(22, true)).toBe(1);
    expect(result.byteLength).toBe(44 + 50 * 1 * 2);
  });
});

// ── ExportService.renderMix ───────────────────────────────────────────────────

describe('ExportService.renderMix', () => {
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExportService();
  });

  it('returns an AudioBuffer', async () => {
    const tracks = [{ id: 't1', volume: 1, muted: false }];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(makeMockAudioBuffer()) };
    const result = await service.renderMix(tracks as any, mockEngine as any, 1);
    expect(result).toBeDefined();
    expect(result.numberOfChannels).toBeDefined();
  });

  it('creates OfflineAudioContext with correct duration', async () => {
    const tracks = [{ id: 't1', volume: 1, muted: false }];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(makeMockAudioBuffer()) };
    await service.renderMix(tracks as any, mockEngine as any, 5);
    expect(global.OfflineAudioContext).toHaveBeenCalledWith(
      expect.any(Number), // channels
      expect.any(Number), // length = sampleRate * duration
      expect.any(Number)  // sampleRate
    );
  });

  it('skips muted tracks', async () => {
    const tracks = [
      { id: 't1', volume: 1, muted: true },
      { id: 't2', volume: 0.8, muted: false },
    ];
    const mockBuffer = makeMockAudioBuffer();
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(mockBuffer) };
    await service.renderMix(tracks as any, mockEngine as any, 1);
    // createBufferSource should only be called for non-muted tracks with buffers
    expect(mockOfflineCtx.createBufferSource).toHaveBeenCalledTimes(1);
  });

  it('skips tracks with no audio buffer', async () => {
    const tracks = [
      { id: 'empty', volume: 1, muted: false },
    ];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(null) };
    await service.renderMix(tracks as any, mockEngine as any, 1);
    expect(mockOfflineCtx.createBufferSource).not.toHaveBeenCalled();
  });

  it('calls startRendering on the OfflineAudioContext', async () => {
    const tracks = [{ id: 't1', volume: 1, muted: false }];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(makeMockAudioBuffer()) };
    await service.renderMix(tracks as any, mockEngine as any, 1);
    expect(mockOfflineCtx.startRendering).toHaveBeenCalled();
  });
});

// ── ExportService.exportProject ───────────────────────────────────────────────

describe('ExportService.exportProject', () => {
  let service: ExportService;

  beforeEach(() => {
    vi.clearAllMocks();
    service = new ExportService();
  });

  it('returns canceled: true when save dialog is canceled', async () => {
    mockAudioforge.files.showSaveDialog.mockResolvedValueOnce({ canceled: true, filePath: '' });
    const result = await service.exportProject({
      projectName: 'Test',
      tracks: [],
      audioEngine: { getTrackBuffer: vi.fn().mockReturnValue(null) } as any,
      duration: 0,
    });
    expect(result.canceled).toBe(true);
  });

  it('calls files.writeFile with WAV data when path is chosen', async () => {
    const tracks = [{ id: 't1', volume: 1, muted: false }];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(makeMockAudioBuffer()) };
    await service.exportProject({
      projectName: 'My Mix',
      tracks: tracks as any,
      audioEngine: mockEngine as any,
      duration: 1,
    });
    expect(mockAudioforge.files.writeFile).toHaveBeenCalledWith(
      '/tmp/mix.wav',
      expect.any(Uint8Array)
    );
  });

  it('returns success: true after successful write', async () => {
    const tracks = [{ id: 't1', volume: 1, muted: false }];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(makeMockAudioBuffer()) };
    const result = await service.exportProject({
      projectName: 'My Mix',
      tracks: tracks as any,
      audioEngine: mockEngine as any,
      duration: 1,
    });
    expect(result.success).toBe(true);
    expect(result.filePath).toBe('/tmp/mix.wav');
  });

  it('calls showSaveDialog with WAV filter and project name as default', async () => {
    const tracks: any[] = [];
    const mockEngine = { getTrackBuffer: vi.fn().mockReturnValue(null) };
    mockAudioforge.files.showSaveDialog.mockResolvedValueOnce({ canceled: false, filePath: '/tmp/out.wav' });
    await service.exportProject({
      projectName: 'Cool Track',
      tracks,
      audioEngine: mockEngine as any,
      duration: 0,
    });
    expect(mockAudioforge.files.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        defaultPath: expect.stringContaining('Cool Track'),
        filters: expect.arrayContaining([
          expect.objectContaining({ extensions: expect.arrayContaining(['wav']) }),
        ]),
      })
    );
  });
});
