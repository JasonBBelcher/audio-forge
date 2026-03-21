import type { IpcMain } from 'electron';
import type { SettingsService } from '../services/settings.service.js';

export function registerSettingsHandlers(ipcMain: IpcMain, settingsService: SettingsService): void {
  ipcMain.handle('settings:get', (_event, key: string, defaultValue?: unknown) => {
    const value = settingsService.get(key);
    return value !== undefined ? value : defaultValue;
  });

  ipcMain.handle('settings:set', (_event, key: string, value: unknown) => {
    settingsService.set(key, value);
  });

  ipcMain.handle('settings:getAll', () => {
    return settingsService.getAll();
  });
}
