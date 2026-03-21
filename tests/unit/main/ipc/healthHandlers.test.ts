import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerHealthHandlers } from '../../../../src/main/ipc/healthHandlers.js';

describe('Health IPC Handlers', () => {
  let mockIpcMain: any;
  let mockHealthService: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    registeredHandlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
    };

    mockHealthService = {
      getStatus: vi.fn().mockResolvedValue({
        tools: {
          ffmpeg: { available: true, version: '4.2' },
        },
        system: {
          platform: 'darwin',
          arch: 'x64',
          memory: 16000000000,
        },
      }),
    };
  });

  it('registers health:getStatus handler', () => {
    registerHealthHandlers(mockIpcMain, mockHealthService);
    expect(registeredHandlers.has('health:getStatus')).toBe(true);
  });

  describe('health:getStatus handler', () => {
    it('calls healthService.getStatus', async () => {
      registerHealthHandlers(mockIpcMain, mockHealthService);
      const handler = registeredHandlers.get('health:getStatus')!;

      await handler();
      expect(mockHealthService.getStatus).toHaveBeenCalled();
    });

    it('returns health status from service', async () => {
      const healthStatus = {
        tools: { ffmpeg: { available: true } },
        system: { platform: 'darwin', arch: 'x64', memory: 16000000000 },
      };
      mockHealthService.getStatus.mockResolvedValue(healthStatus);

      registerHealthHandlers(mockIpcMain, mockHealthService);
      const handler = registeredHandlers.get('health:getStatus')!;

      const result = await handler();
      expect(result).toEqual(healthStatus);
    });
  });
});
