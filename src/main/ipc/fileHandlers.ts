import type { IpcMain } from 'electron';
import { readFileSync } from 'fs';
import type { FileService } from '../services/file.service.js';
import type { AnalysisPipelineService } from '../services/analysis-pipeline.service.js';
import type { QueueService } from '../services/queue.service.js';

export function registerFileHandlers(
  ipcMain: IpcMain,
  fileService: FileService,
  analysisPipelineService: AnalysisPipelineService,
  queueService: QueueService
): void {
  // files:showOpenDialog, files:showSaveDialog, files:writeFile are registered
  // in main.ts where mainWindow is in scope for proper dialog parenting.

  ipcMain.handle('files:getMediaDir', async () => {
    return { success: true };
  });

  ipcMain.handle('files:readAsArrayBuffer', async (_event, filePath: string) => {
    const fileContent = readFileSync(filePath);
    return fileContent.buffer;
  });

  ipcMain.handle('files:import', async (_event, filePaths: string[]) => {
    const results = [];

    for (const filePath of filePaths) {
      try {
        // 1. Add file to library
        const asset = await fileService.importFile(filePath);

        // 2. Enqueue analysis job
        const jobId = queueService.enqueue('analyze-audio', {
          assetId: asset.id,
          filePath: asset.file_path,
        });

        results.push({
          asset,
          jobId,
          status: 'pending',
        });
      } catch (error) {
        results.push({
          error: (error as Error).message,
          filePath,
          status: 'failed',
        });
      }
    }

    return results;
  });

  ipcMain.handle('files:analyzeAll', async () => {
    try {
      const jobId = queueService.enqueue('analyze-audio-all', {});
      return { jobId, status: 'queued' };
    } catch (error) {
      return { error: (error as Error).message, status: 'failed' };
    }
  });
}
