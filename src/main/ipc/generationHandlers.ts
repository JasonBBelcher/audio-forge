import { ipcMain } from 'electron';
import type { GenerationService } from '../services/generation.service.js';
import type { QueueService } from '../services/queue.service.js';

export function registerGenerationHandlers(
  ipcMain: typeof import('electron').ipcMain,
  generationService: GenerationService,
  queueService: QueueService
): void {
  ipcMain.handle('generation:listModels', async () => {
    return generationService.listModels();
  });

  ipcMain.handle('generation:isInstalled', async (_event, modelId: string) => {
    return generationService.isModelInstalled(modelId);
  });

  ipcMain.handle('generation:install', async (_event, modelId: string) => {
    const jobId = queueService.enqueue('install-model', { modelId });
    return { jobId };
  });

  ipcMain.handle(
    'generation:generate',
    async (_event, params: { modelId: string; prompt: string; durationSec: number; seed?: number; steps?: number; guidance?: number; outputDir: string }) => {
      const jobId = queueService.enqueue('generate-audio', params);
      return { jobId };
    }
  );
}
