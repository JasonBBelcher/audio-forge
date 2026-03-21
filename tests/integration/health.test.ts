import { describe, it, expect } from 'vitest';
import { HealthService } from '../../src/main/services/health.service.js';

/**
 * Integration test: HealthService against real system (no mocks).
 * Exercises actual CLI tool detection.
 */
describe('HealthService Integration (real system, no mocks)', () => {
  it('detects node as available', async () => {
    const health = new HealthService();
    const status = await health.checkTool('node');

    expect(status.available).toBe(true);
    expect(status.version).toMatch(/\d+\.\d+/);
  });

  it('detects ffmpeg availability on this system', async () => {
    const health = new HealthService();
    const status = await health.checkTool('ffmpeg');

    // ffmpeg should be installed on this dev machine
    expect(status.available).toBe(true);
  });

  it('getStatus returns complete health report', async () => {
    const health = new HealthService();
    const status = await health.getStatus();

    // Structure checks
    expect(Object.keys(status.tools).length).toBeGreaterThanOrEqual(6);
    expect(status.system.platform).toBe(process.platform);
    expect(status.system.memory).toBeGreaterThan(0);
  });

  it('handles multiple concurrent health checks', async () => {
    const health = new HealthService();

    const [s1, s2, s3] = await Promise.all([
      health.getStatus(),
      health.getStatus(),
      health.getStatus(),
    ]);

    // All should return consistent results
    expect(s1.system.platform).toBe(s2.system.platform);
    expect(s2.system.platform).toBe(s3.system.platform);
  });
});
