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

  ipcMain.handle('audio:fadeIn', async (_event, filePath: string, durationSec: number, outputPath?: string) => {
    return audioService.fadeIn(filePath, durationSec, outputPath);
  });

  ipcMain.handle('audio:fadeOut', async (_event, filePath: string, durationSec: number, outputPath?: string) => {
    return audioService.fadeOut(filePath, durationSec, outputPath);
  });

  ipcMain.handle('audio:reverse', async (_event, filePath: string, outputPath?: string) => {
    return audioService.reverse(filePath, outputPath);
  });

  ipcMain.handle('audio:pitchShift', async (_event, filePath: string, semitones: number, outputPath?: string) => {
    return audioService.pitchShift(filePath, semitones, outputPath);
  });

  ipcMain.handle('audio:timeStretch', async (_event, filePath: string, factor: number, outputPath?: string) => {
    return audioService.timeStretch(filePath, factor, outputPath);
  });

  ipcMain.handle('audio:silenceRemove', async (_event, filePath: string, thresholdDb?: number, outputPath?: string) => {
    return audioService.silenceRemove(filePath, thresholdDb, outputPath);
  });

  ipcMain.handle('audio:getDuration', async (_event, filePath: string) => {
    return audioService.getDuration(filePath);
  });
}
