import type { IpcMain, WebContents } from 'electron';
import type { HealthService, HealthStatus } from '../services/health.service.js';
import type { SettingsService } from '../services/settings.service.js';
import { detectPlatform } from '../utils/platform-detector.js';

const CACHE_KEY = 'health.status.cache';
const CACHE_TTL_MS = 60 * 60 * 1000; // 1 hour

interface HealthCache {
  status: HealthStatus;
  timestamp: number;
}

export function registerHealthHandlers(
  ipcMain: IpcMain,
  healthService: HealthService,
  getWebContents?: () => WebContents | undefined,
  settingsService?: SettingsService
): void {
  ipcMain.handle('health:getPlatform', () => detectPlatform());

  ipcMain.handle('health:getStatus', async () => {
    const cached = settingsService?.get<HealthCache>(CACHE_KEY);
    const cacheValid = cached && Date.now() - cached.timestamp < CACHE_TTL_MS;

    if (cacheValid) {
      // Return cached result immediately; refresh in background
      healthService.getStatus().then((freshStatus) => {
        settingsService?.set(CACHE_KEY, { status: freshStatus, timestamp: Date.now() });
        getWebContents?.()?.send('health:statusUpdate', freshStatus);
      }).catch(() => {});
      return cached.status;
    }

    // No valid cache — perform fresh check (first run or cache expired)
    const freshStatus = await healthService.getStatus();
    settingsService?.set(CACHE_KEY, { status: freshStatus, timestamp: Date.now() });
    return freshStatus;
  });

  ipcMain.handle('health:installTool', async (_event, tool: string) => {
    await healthService.installTool(tool, (line) => {
      getWebContents?.()?.send('health:installProgress', { tool, line });
    });
    // Refresh cache after install
    const freshStatus = await healthService.checkTool(tool);
    const cached = settingsService?.get<HealthCache>(CACHE_KEY);
    if (cached) {
      cached.status.tools[tool] = freshStatus;
      cached.timestamp = Date.now();
      settingsService?.set(CACHE_KEY, cached);
    }
    return freshStatus;
  });
}
