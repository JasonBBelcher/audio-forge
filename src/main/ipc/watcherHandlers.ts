import type { IpcMain, BrowserWindow } from 'electron';
import type { FolderWatcherService } from '../services/folder-watcher.service.js';

export function registerWatcherHandlers(
  ipcMain: IpcMain,
  folderWatcherService: FolderWatcherService,
  mainWindow: BrowserWindow | null
): void {
  ipcMain.handle('watcher:watchFolder', (_event, folderPath: string) => {
    folderWatcherService.watchFolder(folderPath);
    return { watching: true, path: folderPath };
  });

  ipcMain.handle('watcher:unwatchFolder', (_event, folderPath: string) => {
    folderWatcherService.unwatchFolder(folderPath);
    return { watching: false };
  });

  ipcMain.handle('watcher:getWatchedFolders', () => {
    return folderWatcherService.getWatchedFolders();
  });

  // Set callback to emit events to renderer when files are added
  folderWatcherService.setOnFileAdded((assetId: number, filePath: string) => {
    if (mainWindow) {
      mainWindow.webContents.send('library:fileAdded', { assetId, filePath });
    }
  });
}
