import { ipcMain } from 'electron';
import { LoopDetectorService, LoopPoint } from '../services/loop-detector.service.js';

export function registerLoopHandlers(
  ipcMain: typeof import('electron').ipcMain,
  loopDetectorService: LoopDetectorService
): void {
  ipcMain.handle(
    'loop:detect',
    async (_event, filePath: string, bpm?: number) => {
      return loopDetectorService.detectLoops(filePath, bpm);
    }
  );

  ipcMain.handle(
    'loop:extract',
    async (_event, filePath: string, loop: LoopPoint, outputPath?: string) => {
      return loopDetectorService.extractLoop(filePath, loop, outputPath);
    }
  );
}
