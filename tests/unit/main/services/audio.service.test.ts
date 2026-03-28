import { describe, it, expect, vi, beforeEach } from 'vitest';
import { AudioService, AnalysisResult } from '../../../../src/main/services/audio.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('AudioService', () => {
  let audio: AudioService;

  beforeEach(() => {
    audio = new AudioService();
    vi.clearAllMocks();
  });

  it('detects BPM using aubio', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    // aubio tempo outputs beat timestamps (seconds) one per line.
    // Intervals of 0.5 s → avg interval = 0.5 → 60/0.5 = 120 BPM.
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '0.500\n1.000\n1.500\n2.000\n2.500\n3.000',
      stderr: '',
      exitCode: 0,
    });

    const result = await audio.analyzeBPM('/path/to/audio.wav');

    expect(result.bpm).toBeDefined();
    expect(typeof result.bpm).toBe('number');
    expect(result.bpm).toBe(120);
  });

  it('detects key using aubio', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    // aubio pitch outputs "timestamp hz" lines; service runs Krumhansl-Schmuckler.
    // Repeated middle C (261.63 Hz) strongly biases toward C major.
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '0.000 261.626\n0.011 261.626\n0.023 261.626\n0.034 261.626\n0.046 261.626',
      stderr: '',
      exitCode: 0,
    });

    const result = await audio.analyzeKey('/path/to/audio.wav');

    expect(result.key).toBeDefined();
    expect(typeof result.key).toBe('string');
  });

  it('analyzes waveform peaks via ffmpeg', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '0.5\n0.7\n0.9\n0.6',
      stderr: '',
      exitCode: 0,
    });

    const peaks = await audio.analyzeWaveform('/path/to/audio.wav');

    expect(Array.isArray(peaks)).toBe(true);
    expect(peaks.length).toBeGreaterThan(0);
  });

  it('extracts metadata via ffprobe', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: {
          duration: '180.5',
          size: '1024000',
        },
        streams: [
          {
            codec_type: 'audio',
            sample_rate: '48000',
            channels: 2,
          },
        ],
      }),
      stderr: '',
      exitCode: 0,
    });

    const metadata = await audio.getMetadata('/path/to/audio.wav');

    expect(metadata).toHaveProperty('duration');
    expect(metadata).toHaveProperty('sampleRate');
    expect(metadata).toHaveProperty('channels');
  });

  it('converts audio format via ffmpeg', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await audio.convertFormat('/path/input.wav', 'mp3', {
      bitrate: '192k',
    });

    expect(typeof output).toBe('string');
    expect(output).toContain('.mp3');
  });

  it('trims audio with fade handles', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await audio.trim('/path/audio.wav', 10, 50);

    expect(typeof output).toBe('string');
    expect(output).toBeTruthy();
  });

  it('normalizes audio loudness to LUFS target', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await audio.normalize('/path/audio.wav', -14);

    expect(typeof output).toBe('string');
    expect(output).toBeTruthy();
  });

  it('separates stems via demucs', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: 'Separating...',
      stderr: '',
      exitCode: 0,
    });

    const result = await audio.separateStems('/path/audio.wav', {
      model: 'demucs',
      stems: 4,
    });

    expect(result).toHaveProperty('vocals');
    expect(result).toHaveProperty('drums');
  });

  it('handles stem separation errors gracefully', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockRejectedValueOnce(new Error('GPU not available'));

    await expect(
      audio.separateStems('/path/audio.wav', { model: 'demucs' })
    ).rejects.toThrow();
  });

  it('fullAnalysis combines multiple analyses', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');

    // Mock sequential calls
    vi.mocked(runProcess)
      .mockResolvedValueOnce({ stdout: '120.0', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({ stdout: 'A minor', stderr: '', exitCode: 0 })
      .mockResolvedValueOnce({
        stdout: JSON.stringify({
          format: { duration: '180.5' },
          streams: [{ sample_rate: '48000', channels: 2 }],
        }),
        stderr: '',
        exitCode: 0,
      });

    const result = await audio.fullAnalysis('/path/audio.wav');

    expect(result).toHaveProperty('bpm');
    expect(result).toHaveProperty('key');
    expect(result).toHaveProperty('duration');
  });
});
