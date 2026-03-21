import type { IpcMain } from 'electron';
import type { SyncService } from '../services/sync.service.js';

export function registerSyncHandlers(ipcMain: IpcMain, syncService: SyncService): void {
  ipcMain.handle('sync:listSessions', (_event, projectId: string) => {
    return syncService.listSyncSessions(projectId);
  });

  ipcMain.handle('sync:initialize', (_event, projectId: string, backend: string) => {
    return syncService.initializeSync(projectId, backend);
  });

  ipcMain.handle('sync:getStatus', (_event, projectId: string) => {
    return syncService.getSyncStatus(projectId);
  });
}
