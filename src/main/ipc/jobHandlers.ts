import type { IpcMain } from 'electron';
import type { QueueService } from '../services/queue.service.js';

export function registerJobHandlers(ipcMain: IpcMain, queueService: QueueService): void {
  ipcMain.handle('jobs:list', (_event, status?: string) => {
    const filter = status ? { status } : {};
    return queueService.listJobs(filter);
  });

  ipcMain.handle('jobs:getStatus', (_event, id: string) => {
    return queueService.getJob(id);
  });

  ipcMain.handle('jobs:cancel', (_event, id: string) => {
    return queueService.cancel(id);
  });

  ipcMain.handle('jobs:retry', (_event, id: string) => {
    return queueService.retry(id);
  });
}
