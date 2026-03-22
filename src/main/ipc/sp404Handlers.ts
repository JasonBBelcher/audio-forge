import type { IpcMain } from 'electron';
import type { SP404Service, SP404Kit } from '../services/sp404.service.js';

export function registerSP404Handlers(ipcMain: IpcMain, sp404Service: SP404Service): void {
  ipcMain.handle('sp404:exportKit', async (_event, kit: SP404Kit, sdCardPath: string) => {
    return sp404Service.exportKit(kit, sdCardPath);
  });

  ipcMain.handle('sp404:listBanks', async (_event, sdCardPath: string) => {
    return sp404Service.listBanks(sdCardPath);
  });

  ipcMain.handle('sp404:detectSDCards', async (_event) => {
    return sp404Service.detectSDCards();
  });
}
