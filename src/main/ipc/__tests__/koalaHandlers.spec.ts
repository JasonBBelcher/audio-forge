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
      const exportFolder = '/export/folder';

      mockKoalaService.exportKit.mockResolvedValue({
        outputPath: '/export/folder/test-kit',
        padCount: 1,
      });

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      // Get the handler function
      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:exportKit'
      );
      const handler = handleCall[1];

      const result = await handler({}, kit, exportFolder);

      expect(mockKoalaService.exportKit).toHaveBeenCalledWith(kit, exportFolder);
      expect(result).toEqual({
        outputPath: '/export/folder/test-kit',
        padCount: 1,
      });
    });

    it('throws error when exportKit fails', async () => {
      const kit: KoalaKit = { name: 'test-kit', pads: [] };
      const exportFolder = '/export/folder';
      const error = new Error('Export failed');

      mockKoalaService.exportKit.mockRejectedValue(error);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:exportKit'
      );
      const handler = handleCall[1];

      await expect(handler({}, kit, exportFolder)).rejects.toThrow('Export failed');
    });
  });

  describe('koala:listKits handler', () => {
    it('delegates to koalaService.listKits', async () => {
      const exportFolder = '/export/folder';
      const expectedKits = ['kit-1', 'kit-2', 'kit-3'];

      mockKoalaService.listKits.mockResolvedValue(expectedKits);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:listKits'
      );
      const handler = handleCall[1];

      const result = await handler({}, exportFolder);

      expect(mockKoalaService.listKits).toHaveBeenCalledWith(exportFolder);
      expect(result).toEqual(expectedKits);
    });
  });

  describe('koala:deleteKit handler', () => {
    it('delegates to koalaService.deleteKit', async () => {
      const kitName = 'test-kit';
      const exportFolder = '/export/folder';

      mockKoalaService.deleteKit.mockResolvedValue(undefined);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:deleteKit'
      );
      const handler = handleCall[1];

      await handler({}, kitName, exportFolder);

      expect(mockKoalaService.deleteKit).toHaveBeenCalledWith(kitName, exportFolder);
    });

    it('throws error when deleteKit fails', async () => {
      const kitName = 'nonexistent-kit';
      const exportFolder = '/export/folder';
      const error = new Error('Kit not found');

      mockKoalaService.deleteKit.mockRejectedValue(error);

      registerKoalaHandlers(mockIpcMain as IpcMain, mockKoalaService as KoalaService);

      const handleCall = mockIpcMain.handle.mock.calls.find(
        (call: any[]) => call[0] === 'koala:deleteKit'
      );
      const handler = handleCall[1];

      await expect(handler({}, kitName, exportFolder)).rejects.toThrow('Kit not found');
    });
  });
});
