import { describe, it, expect, vi, beforeEach } from 'vitest';
import path from 'path';

// Mock electron's app module
vi.mock('electron', () => ({
  app: {
    getPath: vi.fn((name: string) => {
      if (name === 'userData') return '/mock/userData';
      return `/mock/${name}`;
    }),
  },
}));

// Set process.resourcesPath for tests
const originalResourcesPath = process.resourcesPath;

describe('getAppPaths', () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it('returns all required path properties', async () => {
    const { getAppPaths } = await import('../../../../src/main/utils/paths.js');
    const paths = getAppPaths();

    expect(paths).toHaveProperty('userData');
    expect(paths).toHaveProperty('media');
    expect(paths).toHaveProperty('database');
    expect(paths).toHaveProperty('logs');
    expect(paths).toHaveProperty('temp');
    expect(paths).toHaveProperty('resources');
    expect(paths).toHaveProperty('bin');
  });

  it('derives media, database, logs, temp from userData', async () => {
    const { getAppPaths } = await import('../../../../src/main/utils/paths.js');
    const paths = getAppPaths();

    expect(paths.userData).toBe('/mock/userData');
    expect(paths.media).toBe(path.join('/mock/userData', 'media'));
    expect(paths.database).toBe(path.join('/mock/userData', 'audioforge.db'));
    expect(paths.logs).toBe(path.join('/mock/userData', 'logs'));
    expect(paths.temp).toBe(path.join('/mock/userData', 'temp'));
  });

  it('uses process.resourcesPath for resources and bin when available', async () => {
    Object.defineProperty(process, 'resourcesPath', { value: '/app/resources', configurable: true });
    const { getAppPaths } = await import('../../../../src/main/utils/paths.js');
    const paths = getAppPaths();

    expect(paths.resources).toBe('/app/resources');
    expect(paths.bin).toBe(path.join('/app/resources', 'bin'));

    // Restore
    Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
  });

  it('falls back to relative path when process.resourcesPath is undefined', async () => {
    Object.defineProperty(process, 'resourcesPath', { value: undefined, configurable: true });
    const { getAppPaths } = await import('../../../../src/main/utils/paths.js');
    const paths = getAppPaths();

    // Should contain 'resources' in the fallback path
    expect(paths.resources).toContain('resources');
    expect(paths.bin).toContain('bin');

    Object.defineProperty(process, 'resourcesPath', { value: originalResourcesPath, configurable: true });
  });

  it('returns AppPaths interface shape', async () => {
    const { getAppPaths } = await import('../../../../src/main/utils/paths.js');
    const paths = getAppPaths();

    // All values should be strings
    for (const [key, value] of Object.entries(paths)) {
      expect(typeof value).toBe('string');
    }
  });
});
