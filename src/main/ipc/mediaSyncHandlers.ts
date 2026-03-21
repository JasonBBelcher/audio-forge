import type { IpcMain } from 'electron';
import type { MediaSyncService } from '../services/media-sync.service.js';

export function registerMediaSyncHandlers(ipcMain: IpcMain, mediaSyncService: MediaSyncService): void {
  ipcMain.handle('media-sync:findOffset', (_event, refPath: string, targetPath: string) =>
    mediaSyncService.findOffset(refPath, targetPath)
  );

  ipcMain.handle(
    'media-sync:syncAudioWithVideo',
    (_event, videoPath: string, audioPath: string, offsetSec: number, outputPath: string) =>
      mediaSyncService.syncAudioWithVideo(videoPath, audioPath, offsetSec, outputPath)
  );

  ipcMain.handle(
    'media-sync:alignRecordings',
    (_event, refPath: string, targetPaths: string[], outputDir: string) =>
      mediaSyncService.alignRecordings(refPath, targetPaths, outputDir)
  );

  ipcMain.handle(
    'media-sync:autoSync',
    (_event, videoPath: string, audioPath: string, outputPath: string) =>
      mediaSyncService.autoSync(videoPath, audioPath, outputPath)
  );
}
