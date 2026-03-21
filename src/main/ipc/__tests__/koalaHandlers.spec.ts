import { describe, it, expect, beforeEach, vi } from 'vitest';
import { registerKoalaHandlers } from '../koalaHandlers.js';
import type { IpcMain } from 'electron';
import type { KoalaService } from '../../services/koala.service.js';
import type { KoalaKit } from '../../services/koala.service.js';

describe('koalaHandlers', () => {
  let mockIpcMain: any;
  let mockKoalaService: any;

  beforeEach(() => {
    mockIpcMain = {
      handle: vi.fn(),
    };

    mockKoalaService = {
      exportKit: vi.fn(),
      listKits: vi.fn(),
      deleteKit: vi.fn(),
    };

    vi.clearAllMocks();
  });

  describe('registerKoalaHandlers', () => {
    it('registers koala:exportKit handler', () => {
      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'koala:exportKit',
        expect.any(Function)
      );
    });

    it('registers koala:listKits handler', () => {
      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'koala:listKits',
        expect.any(Function)
      );
    });

    it('registers koala:deleteKit handler', () => {
      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      expect(mockIpcMain.handle).toHaveBeenCalledWith(
        'koala:deleteKit',
        expect.any(Function)
      );
    });
  });

  describe('koala:exportKit handler', () => {
    it('delegates to koalaService.exportKit', async () => {
      const kit: KoalaKit = {
        name: 'test-kit',
        pads: [
          { bank: 'A', pad: 1, samplePath: '/path/to/sample.wav' },
        ],
      };
      const syncFolder = '/sync/folder';

      mockKoalaService.exportKit.mockResolvedValue({
        outputPath: '/sync/folder/test-kit',
        padCount: 1,
      });

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      // Get the handler function
      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:exportKit'
      );
      const handler = handleCall[1];

      const result = await handler({}, kit, syncFolder);

      expect(mockKoalaService.exportKit).toHaveBeenCalledWith(kit, syncFolder);
      expect(result).toEqual({
        outputPath: '/sync/folder/test-kit',
        padCount: 1,
      });
    });

    it('throws error when exportKit fails', async () => {
      const kit: KoalaKit = { name: 'test-kit', pads: [] };
      const syncFolder = '/sync/folder';
      const error = new Error('Export failed');

      mockKoalaService.exportKit.mockRejectedValue(error);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:exportKit'
      );
      const handler = handleCall[1];

      await expect(handler({}, kit, syncFolder)).rejects.toThrow('Export failed');
    });
  });

  describe('koala:listKits handler', () => {
    it('delegates to koalaService.listKits', async () => {
      const syncFolder = '/sync/folder';
      const expectedKits = ['kit-1', 'kit-2', 'kit-3'];

      mockKoalaService.listKits.mockResolvedValue(expectedKits);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:listKits'
      );
      const handler = handleCall[1];

      const result = await handler({}, syncFolder);

      expect(mockKoalaService.listKits).toHaveBeenCalledWith(syncFolder);
      expect(result).toEqual(expectedKits);
    });
  });

  describe('koala:deleteKit handler', () => {
    it('delegates to koalaService.deleteKit', async () => {
      const kitName = 'test-kit';
      const syncFolder = '/sync/folder';

      mockKoalaService.deleteKit.mockResolvedValue(undefined);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:deleteKit'
      );
      const handler = handleCall[1];

      await handler({}, kitName, syncFolder);

      expect(mockKoalaService.deleteKit).toHaveBeenCalledWith(kitName, syncFolder);
    });

    it('throws error when deleteKit fails', async () => {
      const kitName = 'nonexistent-kit';
      const syncFolder = '/sync/folder';
      const error = new Error('Kit not found');

      mockKoalaService.deleteKit.mockRejectedValue(error);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:deleteKit'
      );
      const handler = handleCall[1];

      await expect(handler({}, kitName, syncFolder)).rejects.toThrow('Kit not found');
    });
  });
});
