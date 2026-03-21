import type { IpcMain } from 'electron';
import { dialog } from 'electron';
import fs from 'fs';
import type { FileService } from '../services/file.service.js';
import type { AnalysisPipelineService } from '../services/analysis-pipeline.service.js';
import type { QueueService } from '../services/queue.service.js';

export function registerFileHandlers(
  ipcMain: IpcMain,
  fileService: FileService,
  analysisPipelineService: AnalysisPipelineService,
  queueService: QueueService
): void {
  ipcMain.handle('files:showOpenDialog', async (_event, options: Electron.OpenDialogOptions) => {
    return dialog.showOpenDialog(options);
  });

  ipcMain.handle('files:showSaveDialog', async (_event, options: Electron.SaveDialogOptions) => {
    return dialog.showSaveDialog(options);
  });

  ipcMain.handle('files:getMediaDir', async () => {
    // Media dir path is available through fileService if needed
    // For now, just return a success indicator
    return { success: true };
  });

  ipcMain.handle('files:readAsArrayBuffer', async (_event, filePath: string) => {
    const fileContent = fs.readFileSync(filePath);
    return fileContent.buffer;
  });

  ipcMain.handle('files:writeFile', async (_event, filePath: string, data: Uint8Array) => {
    fs.writeFileSync(filePath, Buffer.from(data));
    return { success: true };
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
