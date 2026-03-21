import type { IpcMain } from 'electron';
import type { HealthService } from '../services/health.service.js';

export function registerHealthHandlers(ipcMain: IpcMain, healthService: HealthService): void {
  ipcMain.handle('health:getStatus', async () => {
    return healthService.getStatus();
  });
}
