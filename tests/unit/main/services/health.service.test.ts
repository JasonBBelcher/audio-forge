import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService, ToolStatus, TOOL_INSTALLERS } from '../../../../src/main/services/health.service.js';

describe('HealthService', () => {
  let health: HealthService;

  beforeEach(() => {
    health = new HealthService();
  });

  it('checks for required CLI tools', async () => {
    const status = await health.getStatus();

    expect(status).toHaveProperty('tools');
    expect(status.tools).toHaveProperty('ffmpeg');
    expect(status.tools).toHaveProperty('ffprobe');
    expect(status.tools).toHaveProperty('yt-dlp');
    expect(status.tools).toHaveProperty('sox');
    expect(status.tools).toHaveProperty('demucs');
    expect(status.tools).toHaveProperty('aubio');
  });

  it('returns availability boolean for each tool', async () => {
    const status = await health.getStatus();

    for (const [name, tool] of Object.entries(status.tools)) {
      expect(tool).toHaveProperty('available');
      expect(typeof tool.available).toBe('boolean');
    }
  });

  it('returns version string for available tools', async () => {
    const status = await health.getStatus();

    // ffmpeg should be available on this system
    if (status.tools.ffmpeg.available) {
      expect(typeof status.tools.ffmpeg.version).toBe('string');
      expect(status.tools.ffmpeg.version!.length).toBeGreaterThan(0);
    }
  });

  it('includes system information', async () => {
    const status = await health.getStatus();

    expect(status).toHaveProperty('system');
    expect(status.system).toHaveProperty('platform');
    expect(status.system).toHaveProperty('arch');
    expect(status.system).toHaveProperty('memory');
    expect(typeof status.system.platform).toBe('string');
    expect(typeof status.system.memory).toBe('number');
  });

  it('checkTool returns status for a single tool', async () => {
    const result = await health.checkTool('node');

    expect(result.available).toBe(true);
    expect(result.version).toBeDefined();
  });

  it('checkTool returns unavailable for nonexistent tool', async () => {
    const result = await health.checkTool('nonexistent-tool-xyz-999');

    expect(result.available).toBe(false);
    expect(result.version).toBeUndefined();
  });
});

describe('TOOL_INSTALLERS', () => {
  it('has install commands for all optional tools', () => {
    expect(TOOL_INSTALLERS).toHaveProperty('sox');
    expect(TOOL_INSTALLERS).toHaveProperty('aubio');
    expect(TOOL_INSTALLERS).toHaveProperty('demucs');
    expect(TOOL_INSTALLERS).toHaveProperty('ffmpeg');
    expect(TOOL_INSTALLERS).toHaveProperty('yt-dlp');
  });

  it('each installer has command and args arrays', () => {
    for (const [, installer] of Object.entries(TOOL_INSTALLERS)) {
      const platform = process.platform as 'darwin' | 'linux' | 'win32';
      const entry = installer[platform] ?? installer['darwin'];
      expect(entry).toBeDefined();
      expect(typeof entry.command).toBe('string');
      expect(Array.isArray(entry.args)).toBe(true);
    }
  });
});

describe('HealthService.installTool', () => {
  let health: HealthService;

  beforeEach(() => {
    health = new HealthService();
  });

  it('rejects unknown tools', async () => {
    await expect(health.installTool('not-a-real-tool')).rejects.toThrow(
      /no installer/i
    );
  });

  it('rejects unsupported platforms gracefully', async () => {
    // Temporarily pretend we're on Windows (where some installers may not exist)
    const origPlatform = Object.getOwnPropertyDescriptor(process, 'platform');
    Object.defineProperty(process, 'platform', { value: 'win32', configurable: true });
    try {
      // demucs pip install should still work on win32
      const installer = TOOL_INSTALLERS['demucs']?.['win32'];
      expect(installer).toBeDefined();
    } finally {
      if (origPlatform) Object.defineProperty(process, 'platform', origPlatform);
    }
  });
});
