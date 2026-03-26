import type { IpcMain, WebContents } from 'electron';
import type { HealthService } from '../services/health.service.js';
import { detectPlatform } from '../utils/platform-detector.js';

export function registerHealthHandlers(
  ipcMain: IpcMain,
  healthService: HealthService,
  getWebContents?: () => WebContents | undefined
): void {
  ipcMain.handle('health:getPlatform', () => detectPlatform());

  ipcMain.handle('health:getStatus', async () => {
    return healthService.getStatus();
  });

  ipcMain.handle('health:installTool', async (_event, tool: string) => {
    await healthService.installTool(tool, (line) => {
      getWebContents?.()?.send('health:installProgress', { tool, line });
    });
    // Return fresh status after install
    return healthService.checkTool(tool);
  });
}
