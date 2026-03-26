import type { IpcMain } from 'electron';
import { shell } from 'electron';
import { readdirSync, statSync } from 'fs';
import { extname, join } from 'path';
import type { FileService } from '../services/file.service.js';
import type { AnalysisPipelineService } from '../services/analysis-pipeline.service.js';
import type { QueueService } from '../services/queue.service.js';

const AUDIO_EXTENSIONS = new Set(['.wav', '.mp3', '.flac', '.aiff', '.aif', '.ogg', '.m4a', '.aac']);

function scanFolderRecursive(folderPath: string, results: string[] = []): string[] {
  try {
    const entries = readdirSync(folderPath, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue; // skip hidden files
      const fullPath = join(folderPath, entry.name);
      if (entry.isDirectory()) {
        scanFolderRecursive(fullPath, results);
      } else if (AUDIO_EXTENSIONS.has(extname(entry.name).toLowerCase())) {
        results.push(fullPath);
      }
    }
  } catch {
    // Skip unreadable directories
  }
  return results;
}

export function registerFileHandlers(
  ipcMain: IpcMain,
  fileService: FileService,
  analysisPipelineService: AnalysisPipelineService,
  queueService: QueueService
): void {
  // files:showOpenDialog, files:showSaveDialog, files:writeFile,
  // files:getMediaDir, files:readAsArrayBuffer are registered in main.ts
  // where mainWindow and getAppPaths() are in scope.

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

  ipcMain.handle('files:list', async () => {
    return fileService.listFiles();
  });

  ipcMain.handle('files:search', async (_event, query: string) => {
    return fileService.searchFiles(query);
  });

  ipcMain.handle('files:delete', async (_event, assetId: number) => {
    return fileService.deleteAsset(assetId);
  });

  ipcMain.handle('files:scanFolder', (_event, folderPath: string) => {
    return scanFolderRecursive(folderPath);
  });

  ipcMain.handle('files:revealInFinder', (_event, filePath: string) => {
    shell.showItemInFolder(filePath);
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
