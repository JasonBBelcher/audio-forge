import { describe, it, expect, vi, beforeEach } from 'vitest';
import { HealthService, ToolStatus } from '../../../../src/main/services/health.service.js';

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
