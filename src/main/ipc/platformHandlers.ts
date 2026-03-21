import type { IpcMain } from 'electron';
import type { PlatformService } from '../services/platform.service.js';

export function registerPlatformHandlers(ipcMain: IpcMain, platformService: PlatformService): void {
  ipcMain.handle('platforms:list', () => {
    return platformService.listIntegrations();
  });

  ipcMain.handle('platforms:register', (_event, config: object) => {
    return platformService.registerIntegration(config as any);
  });

  ipcMain.handle('platforms:getHistory', (_event, platformId: string) => {
    return platformService.getPublishHistory(platformId);
  });
}
