import type { IpcMain } from 'electron';
import type { KoalaService, KoalaKit } from '../services/koala.service.js';

export function registerKoalaHandlers(ipcMain: IpcMain, koalaService: KoalaService): void {
  ipcMain.handle('koala:exportKit', async (_event, kit: KoalaKit, syncFolder: string) => {
    return koalaService.exportKit(kit, syncFolder);
  });

  ipcMain.handle('koala:listKits', async (_event, syncFolder: string) => {
    return koalaService.listKits(syncFolder);
  });

  ipcMain.handle('koala:deleteKit', async (_event, kitName: string, syncFolder: string) => {
    return koalaService.deleteKit(kitName, syncFolder);
  });
}
