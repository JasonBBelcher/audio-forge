import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHealthHandlers } from '../../../../src/main/ipc/healthHandlers.js';

const MOCK_STATUS = {
  tools: {
    ffmpeg: { available: true, version: '4.2' },
  },
  system: {
    platform: 'darwin',
    arch: 'x64',
    memory: 16000000000,
  },
};

describe('Health IPC Handlers', () => {
  let mockIpcMain: any;
  let mockHealthService: any;
  let mockSettingsService: any;
  let mockWebContents: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    registeredHandlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
    };
    mockHealthService = {
      getStatus: vi.fn().mockResolvedValue(MOCK_STATUS),
      checkTool: vi.fn().mockResolvedValue({ available: true, version: '1.0' }),
    };
    mockWebContents = { send: vi.fn() };
    mockSettingsService = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
    };
  });

  it('registers health:getStatus handler', () => {
    registerHealthHandlers(mockIpcMain, mockHealthService);
    expect(registeredHandlers.has('health:getStatus')).toBe(true);
  });

  describe('health:getStatus handler — no cache', () => {
    it('calls healthService.getStatus when no cache exists', async () => {
      registerHealthHandlers(mockIpcMain, mockHealthService, undefined, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();
      expect(mockHealthService.getStatus).toHaveBeenCalled();
    });

    it('returns health status from service on first run', async () => {
      registerHealthHandlers(mockIpcMain, mockHealthService, undefined, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      const result = await handler();
      expect(result).toEqual(MOCK_STATUS);
    });

    it('saves result to settings cache after first run', async () => {
      registerHealthHandlers(mockIpcMain, mockHealthService, undefined, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();
      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'health.status.cache',
        expect.objectContaining({ status: MOCK_STATUS, timestamp: expect.any(Number) })
      );
    });
  });

  describe('health:getStatus handler — with valid cache', () => {
    it('returns cached status immediately without calling getStatus synchronously', async () => {
      const cachedStatus = { ...MOCK_STATUS, tools: { ffmpeg: { available: true, version: '3.0' } } };
      mockSettingsService.get.mockReturnValue({ status: cachedStatus, timestamp: Date.now() });

      // Make getStatus slow to confirm we don't await it
      let resolveGetStatus!: () => void;
      const slowPromise = new Promise<typeof MOCK_STATUS>((res) => {
        resolveGetStatus = () => res(MOCK_STATUS);
      });
      mockHealthService.getStatus.mockReturnValue(slowPromise);

      registerHealthHandlers(mockIpcMain, mockHealthService, () => mockWebContents, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      const result = await handler();
      expect(result).toEqual(cachedStatus);

      // Clean up dangling promise
      resolveGetStatus();
    });

    it('pushes fresh status via health:statusUpdate after background refresh', async () => {
      mockSettingsService.get.mockReturnValue({ status: MOCK_STATUS, timestamp: Date.now() });

      registerHealthHandlers(mockIpcMain, mockHealthService, () => mockWebContents, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();

      // Wait for the background refresh microtask to complete
      await new Promise((r) => setTimeout(r, 10));

      expect(mockWebContents.send).toHaveBeenCalledWith('health:statusUpdate', MOCK_STATUS);
    });

    it('updates settings cache after background refresh', async () => {
      mockSettingsService.get.mockReturnValue({ status: MOCK_STATUS, timestamp: Date.now() });

      registerHealthHandlers(mockIpcMain, mockHealthService, () => mockWebContents, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();
      await new Promise((r) => setTimeout(r, 10));

      expect(mockSettingsService.set).toHaveBeenCalledWith(
        'health.status.cache',
        expect.objectContaining({ status: MOCK_STATUS })
      );
    });
  });

  describe('health:getStatus handler — stale cache', () => {
    it('performs fresh check when cache is older than 1 hour', async () => {
      const staleTimestamp = Date.now() - 2 * 60 * 60 * 1000; // 2 hours ago
      mockSettingsService.get.mockReturnValue({ status: MOCK_STATUS, timestamp: staleTimestamp });

      registerHealthHandlers(mockIpcMain, mockHealthService, undefined, mockSettingsService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();
      expect(mockHealthService.getStatus).toHaveBeenCalled();
    });
  });

  describe('without settings service', () => {
    it('still works and returns health status', async () => {
      registerHealthHandlers(mockIpcMain, mockHealthService);
      const handler = registeredHandlers.get('health:getStatus')!;

      const result = await handler();
      expect(result).toEqual(MOCK_STATUS);
    });
  });
});
