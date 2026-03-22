import type { IpcMain } from 'electron';
import type { KoalaService, KoalaKit } from '../services/koala.service.js';

export function registerKoalaHandlers(ipcMain: IpcMain, koalaService: KoalaService): void {
  ipcMain.handle('koala:exportKit', async (_event, kit: KoalaKit, exportFolder: string) => {
    return koalaService.exportKit(kit, exportFolder);
  });

  ipcMain.handle('koala:listKits', async (_event, exportFolder: string) => {
    return koalaService.listKits(exportFolder);
  });

  ipcMain.handle('koala:deleteKit', async (_event, kitName: string, exportFolder: string) => {
    return koalaService.deleteKit(kitName, exportFolder);
  });

  ipcMain.handle('koala:openInFinder', async (_event, folderPath: string) => {
    const { shell } = await import('electron');
    await shell.openPath(folderPath);
    return { opened: true };
  });
}
