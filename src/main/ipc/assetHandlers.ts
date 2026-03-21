import type { IpcMain } from 'electron';
import type { FileService } from '../services/file.service.js';

export function registerAssetHandlers(ipcMain: IpcMain, fileService: FileService): void {
  ipcMain.handle('assets:list', () => {
    return fileService.listAssets();
  });

  ipcMain.handle('assets:search', (_event, query: string) => {
    return fileService.searchAssets(query);
  });

  ipcMain.handle('assets:delete', (_event, id: number) => {
    return fileService.deleteAsset(id);
  });

  ipcMain.handle('assets:import', (_event, filePath: string) => {
    return fileService.importAsset(filePath);
  });
}
