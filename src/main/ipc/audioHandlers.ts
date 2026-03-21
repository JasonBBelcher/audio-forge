import type { IpcMain } from 'electron';
import type { AudioService } from '../services/audio.service.js';

export function registerAudioHandlers(ipcMain: IpcMain, audioService: AudioService): void {
  ipcMain.handle('audio:convertFormat', async (_event, filePath: string, outputPath: string, options?: object) => {
    const format = outputPath.split('.').pop() || 'wav';
    return audioService.convertFormat(filePath, format, options as any);
  });

  ipcMain.handle('audio:trim', async (_event, filePath: string, outputPath: string, startSec: number, endSec: number) => {
    return audioService.trim(filePath, startSec, endSec);
  });

  ipcMain.handle('audio:normalize', async (_event, filePath: string, outputPath: string, options?: object) => {
    const targetLUFS = (options as any)?.targetLUFS ?? -14;
    return audioService.normalize(filePath, targetLUFS);
  });

  ipcMain.handle('audio:separateStems', async (_event, filePath: string, options?: object) => {
    return audioService.separateStems(filePath, options as any);
  });

  ipcMain.handle('audio:fullAnalysis', async (_event, filePath: string) => {
    return audioService.fullAnalysis(filePath);
  });

  ipcMain.handle('audio:getMetadata', async (_event, filePath: string) => {
    return audioService.getMetadata(filePath);
  });

  ipcMain.handle('audio:analyzeWaveform', async (_event, filePath: string) => {
    return audioService.analyzeWaveform(filePath);
  });

  ipcMain.handle('audio:analyzeBPM', async (_event, filePath: string) => {
    return audioService.analyzeBPM(filePath);
  });

  ipcMain.handle('audio:analyzeKey', async (_event, filePath: string) => {
    return audioService.analyzeKey(filePath);
  });
}
