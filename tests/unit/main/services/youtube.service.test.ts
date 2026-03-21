import { describe, it, expect, vi, beforeEach } from 'vitest';
import { YouTubeService, VideoInfo } from '../../../../src/main/services/youtube.service.js';

// Mock runProcess
vi.mock('../../../../src/main/utils/process-runner.js', () => ({
  runProcess: vi.fn(),
}));

describe('YouTubeService', () => {
  let youtube: YouTubeService;

  beforeEach(() => {
    youtube = new YouTubeService();
    vi.clearAllMocks();
  });

  it('parses video info from yt-dlp JSON output', async () => {
    const mockInfo = {
      id: 'dQw4w9WgXcQ',
      title: 'Rick Astley - Never Gonna Give You Up',
      duration: 212,
      uploader: 'Rick Astley',
      formats: [
        { format_id: '18', format: '18 - 360p', ext: 'mp4' },
        { format_id: '22', format: '22 - 720p', ext: 'mp4' },
      ],
    };

    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: JSON.stringify(mockInfo),
      stderr: '',
      exitCode: 0,
    });

    const info = await youtube.getInfo('https://www.youtube.com/watch?v=dQw4w9WgXcQ');

    expect(info).toHaveProperty('id');
    expect(info).toHaveProperty('title');
    expect(info).toHaveProperty('duration');
    expect(info).toHaveProperty('formats');
  });

  it('extracts available formats', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({
      stdout: JSON.stringify({
        id: 'test',
        title: 'Test',
        formats: [
          { format_id: '18', ext: 'mp4', height: 360 },
          { format_id: '22', ext: 'mp4', height: 720 },
        ],
      }),
      stderr: '',
      exitCode: 0,
    });

    const info = await youtube.getInfo('https://youtube.com/watch?v=test');
    expect(info.formats?.length).toBeGreaterThanOrEqual(1);
  });

  it('validates YouTube URLs', () => {
    const validUrls = [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123',
      'https://www.youtube.com/watch?v=abc123&t=10s',
    ];

    for (const url of validUrls) {
      expect(() => youtube.validateUrl(url)).not.toThrow();
    }
  });

  it('rejects invalid URLs', () => {
    expect(() => youtube.validateUrl('https://example.com')).toThrow();
    expect(() => youtube.validateUrl('not-a-url')).toThrow();
  });

  it('constructs download command with format selection', () => {
    const cmd = youtube.buildDownloadCommand('https://youtube.com/watch?v=test', {
      format: '22',
      output: '/path/to/output.mp4',
    });

    expect(cmd.command).toBe('yt-dlp');
    expect(cmd.args).toContain('-f');
    expect(cmd.args).toContain('22');
    expect(cmd.args).toContain('-o');
  });

  it('parses progress from yt-dlp stderr', () => {
    const line = '[download] 45.5% of 5.32MiB at 1.23MiB/s ETA 00:03';
    const progress = youtube.parseProgress(line);
    expect(progress).toBeDefined();
    if (progress) {
      expect(progress.percent).toBeCloseTo(45.5, 0);
    }
  });

  it('returns undefined progress for non-progress lines', () => {
    const line = '[info] Downloaded video info';
    const progress = youtube.parseProgress(line);
    expect(progress).toBeUndefined();
  });

  it('parseProgress extracts all fields correctly', () => {
    const line = '[download] 12.3% of 8.00MiB at 512KiB/s ETA 01:02';
    const progress = youtube.parseProgress(line);
    expect(progress).toBeDefined();
    expect(progress!.percent).toBeCloseTo(12.3, 1);
    expect(progress!.filesize).toBe('8.00MiB');
    expect(progress!.speed).toBe('512KiB/s');
    expect(progress!.eta).toBe('01:02');
  });

  it('parseProgress returns undefined for 100% complete line without ETA', () => {
    const line = '[download] 100% of 5.32MiB';
    const progress = youtube.parseProgress(line);
    expect(progress).toBeUndefined();
  });

  it('parseProgress handles empty string', () => {
    expect(youtube.parseProgress('')).toBeUndefined();
  });

  it('throws on non-YouTube URL in getInfo', async () => {
    await expect(youtube.getInfo('https://vimeo.com/123')).rejects.toThrow();
  });

  it('throws when yt-dlp exits non-zero', async () => {
    const { runProcess } = await import('../../../../src/main/utils/process-runner.js');
    vi.mocked(runProcess).mockResolvedValueOnce({ stdout: '', stderr: 'error', exitCode: 1 });
    await expect(youtube.getInfo('https://youtube.com/watch?v=abc')).rejects.toThrow();
  });

  it('buildDownloadCommand includes audioOnly flags', () => {
    const cmd = youtube.buildDownloadCommand('https://youtube.com/watch?v=test', { audioOnly: true });
    expect(cmd.args).toContain('-x');
    expect(cmd.args).toContain('--audio-format');
    expect(cmd.args).toContain('wav');
  });

  it('buildDownloadCommand throws on invalid URL', () => {
    expect(() => youtube.buildDownloadCommand('https://notyt.com/video')).toThrow();
  });
});
