import type { IpcMain } from 'electron';
import type { PlatformService } from '../services/platform.service.js';

export function registerPlatformHandlers(ipcMain: IpcMain, platformService: PlatformService): void {
  ipcMain.handle('platforms:list', () => {
    return platformService.listIntegrations();
  });

  ipcMain.handle('platforms:register', (_event, config: Record<string, string>) => {
    // clientId / clientSecret / redirectUri are optional at registration time —
    // they are filled in after the OAuth flow completes.
    return platformService.registerIntegration({
      name: config.name ?? 'Unknown',
      clientId: config.clientId ?? '',
      clientSecret: config.clientSecret ?? '',
      redirectUri: config.redirectUri ?? 'http://localhost:3847/callback',
    });
  });

  ipcMain.handle('platforms:getHistory', (_event, platformId: string) => {
    return platformService.getPublishHistory(platformId);
  });
}
