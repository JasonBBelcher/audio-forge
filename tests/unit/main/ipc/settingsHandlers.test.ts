import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerSettingsHandlers } from '../../../../src/main/ipc/settingsHandlers.js';

describe('Settings IPC Handlers', () => {
  let mockIpcMain: any;
  let mockSettingsService: any;
  let registeredHandlers: Map<string, Function>;

  beforeEach(() => {
    registeredHandlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        registeredHandlers.set(channel, handler);
      }),
    };

    mockSettingsService = {
      get: vi.fn().mockReturnValue(undefined),
      set: vi.fn(),
      getAll: vi.fn().mockReturnValue({}),
    };
  });

  it('registers settings:get handler', () => {
    registerSettingsHandlers(mockIpcMain, mockSettingsService);
    expect(registeredHandlers.has('settings:get')).toBe(true);
  });

  it('registers settings:set handler', () => {
    registerSettingsHandlers(mockIpcMain, mockSettingsService);
    expect(registeredHandlers.has('settings:set')).toBe(true);
  });

  it('registers settings:getAll handler', () => {
    registerSettingsHandlers(mockIpcMain, mockSettingsService);
    expect(registeredHandlers.has('settings:getAll')).toBe(true);
  });

  describe('settings:get handler', () => {
    it('calls settingsService.get with key', () => {
      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:get')!;

      handler(null, 'theme', 'dark');
      expect(mockSettingsService.get).toHaveBeenCalledWith('theme');
    });

    it('returns value from service', () => {
      mockSettingsService.get.mockReturnValue('light');

      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:get')!;

      const result = handler(null, 'theme', 'dark');
      expect(result).toBe('light');
    });

    it('returns defaultValue when service returns undefined', () => {
      mockSettingsService.get.mockReturnValue(undefined);

      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:get')!;

      const result = handler(null, 'nonexistent', 'default');
      expect(result).toBe('default');
    });
  });

  describe('settings:set handler', () => {
    it('calls settingsService.set with key and value', () => {
      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:set')!;

      handler(null, 'theme', 'light');
      expect(mockSettingsService.set).toHaveBeenCalledWith('theme', 'light');
    });

    it('accepts complex values', () => {
      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:set')!;

      const value = { defaultBpm: 120, theme: 'dark' };
      handler(null, 'user_preferences', value);
      expect(mockSettingsService.set).toHaveBeenCalledWith('user_preferences', value);
    });
  });

  describe('settings:getAll handler', () => {
    it('calls settingsService.getAll', () => {
      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:getAll')!;

      handler(null);
      expect(mockSettingsService.getAll).toHaveBeenCalled();
    });

    it('returns all settings from service', () => {
      const allSettings = { theme: 'dark', defaultBpm: 120 };
      mockSettingsService.getAll.mockReturnValue(allSettings);

      registerSettingsHandlers(mockIpcMain, mockSettingsService);
      const handler = registeredHandlers.get('settings:getAll')!;

      const result = handler(null);
      expect(result).toEqual(allSettings);
    });
  });
});
