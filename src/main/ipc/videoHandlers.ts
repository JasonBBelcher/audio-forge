import type { IpcMain } from 'electron';
import type { VideoService } from '../services/video.service.js';

export function registerVideoHandlers(ipcMain: IpcMain, videoService: VideoService): void {
  ipcMain.handle('video:getMetadata', (_event, filePath: string) => {
    return videoService.getMetadata(filePath);
  });

  ipcMain.handle('video:extractAudio', (_event, filePath: string, options?: object) => {
    return videoService.extractAudio(filePath, options);
  });
}
