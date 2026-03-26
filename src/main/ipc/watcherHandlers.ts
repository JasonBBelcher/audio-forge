import type { IpcMain, BrowserWindow } from 'electron';
import type { FolderWatcherService } from '../services/folder-watcher.service.js';
import type { SettingsService } from '../services/settings.service.js';

const SETTINGS_KEY = 'watcher.folders';

export function registerWatcherHandlers(
  ipcMain: IpcMain,
  folderWatcherService: FolderWatcherService,
  settingsService: SettingsService,
  mainWindow: BrowserWindow | null
): void {
  // Persist the updated folder list to settings
  function saveFolders(): void {
    settingsService.set(SETTINGS_KEY, folderWatcherService.getWatchedFolders());
  }

  ipcMain.handle('watcher:watchFolder', (_event, folderPath: string) => {
    folderWatcherService.watchFolder(folderPath);
    saveFolders();
    return { watching: true, path: folderPath };
  });

  ipcMain.handle('watcher:unwatchFolder', (_event, folderPath: string) => {
    folderWatcherService.unwatchFolder(folderPath);
    saveFolders();
    return { watching: false };
  });

  ipcMain.handle('watcher:getWatchedFolders', () => {
    return folderWatcherService.getWatchedFolders();
  });

  // Restore previously watched folders on startup
  const savedFolders = settingsService.get<string[]>(SETTINGS_KEY, []) ?? [];
  for (const folder of savedFolders) {
    try {
      folderWatcherService.watchFolder(folder);
    } catch (err) {
      console.warn(`Could not restore watch on ${folder}:`, err);
    }
  }

  // Notify renderer when a file is auto-imported by the watcher
  folderWatcherService.setOnFileAdded((assetId: number, filePath: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('library:fileAdded', { assetId, filePath });
    }
  });
}
