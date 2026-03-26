import type { IpcMain } from 'electron';
import { dialog } from 'electron';
import { join, extname, basename } from 'path';
import type { MasteringService } from '../services/mastering.service.js';

export function registerMasteringHandlers(
  ipcMain: IpcMain,
  masteringService: MasteringService,
  mediaDir: string
): void {
  ipcMain.handle('mastering:analyze', (_event, filePath: string) => {
    return masteringService.analyze(filePath);
  });

  ipcMain.handle('mastering:master', async (_event, params) => {
    return masteringService.master(params);
  });

  ipcMain.handle('mastering:showSaveDialog', async (_event, inputPath: string) => {
    const ext = extname(inputPath);
    const base = basename(inputPath, ext);
    const defaultPath = join(mediaDir, `${base}_mastered${ext}`);
    const result = await dialog.showSaveDialog({
      defaultPath,
      filters: [
        { name: 'WAV Audio', extensions: ['wav'] },
        { name: 'FLAC Audio', extensions: ['flac'] },
        { name: 'MP3 Audio', extensions: ['mp3'] },
      ],
    });
    return result;
  });
}
