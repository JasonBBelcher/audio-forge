import { describe, it, expect, vi, beforeEach } from 'vitest';
import { VideoService } from '../../../../src/main/services/video.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('VideoService', () => {
  let video: VideoService;

  beforeEach(() => {
    video = new VideoService();
    vi.clearAllMocks();
  });

  it('extracts audio from video', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.extractAudio('/path/video.mp4', { format: 'wav' });

    expect(typeof output).toBe('string');
    expect(output).toContain('.wav');
  });

  it('replaces audio track in video', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.replaceAudio('/path/video.mp4', '/path/audio.wav');

    expect(typeof output).toBe('string');
    expect(output.endsWith('.mp4')).toBe(true);
  });

  it('extracts metadata from video', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: JSON.stringify({
        format: {
          duration: '120.5',
          size: '1024000',
        },
        streams: [
          {
            codec_type: 'video',
            width: 1920,
            height: 1080,
            duration: '120.5',
          },
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

    const metadata = await video.getMetadata('/path/video.mp4');

    expect(metadata).toHaveProperty('duration');
    expect(metadata).toHaveProperty('width');
    expect(metadata).toHaveProperty('height');
  });

  it('generates thumbnail images at intervals', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.generateThumbnails('/path/video.mp4', { count: 10 });

    expect(typeof output).toBe('string');
    expect(output).toContain('thumbnail');
  });

  it('trims video file', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.trim('/path/video.mp4', 10, 60);

    expect(typeof output).toBe('string');
    expect(output.endsWith('.mp4')).toBe(true);
  });

  it('converts video format', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.convertFormat('/path/video.mov', 'mp4');

    expect(typeof output).toBe('string');
    expect(output.endsWith('.mp4')).toBe(true);
  });

  it('merges multiple video files', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: '',
      stderr: '',
      exitCode: 0,
    });

    const output = await video.merge(['/path/v1.mp4', '/path/v2.mp4']);

    expect(typeof output).toBe('string');
    expect(output.endsWith('.mp4')).toBe(true);
  });
});
