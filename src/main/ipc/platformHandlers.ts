import type { IpcMain } from 'electron';
import type { PlatformService } from '../services/platform.service.js';
import { OAuthService } from '../services/oauth.service.js';

const SOUNDCLOUD_CONFIG = {
  clientId: process.env.SOUNDCLOUD_CLIENT_ID ?? 'your_soundcloud_client_id',
  authUrl: 'https://secure.soundcloud.com/connect',
  tokenUrl: 'https://secure.soundcloud.com/oauth2/token',
  redirectUri: 'http://localhost:3847/callback',
  scopes: ['non-expiring'],
};

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

  ipcMain.handle('platforms:soundcloud:connect', async () => {
    const oauthService = new OAuthService();
    try {
      const { code, codeVerifier } = await oauthService.startFlow(SOUNDCLOUD_CONFIG);
      const token = await oauthService.exchangeCode(SOUNDCLOUD_CONFIG, code, codeVerifier);
      return { success: true, token };
    } catch (err: any) {
      return { success: false, error: err.message };
    } finally {
      oauthService.stopServer();
    }
  });
}
