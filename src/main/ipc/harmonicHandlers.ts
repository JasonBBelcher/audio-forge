import { ipcMain } from 'electron';
import { CamelotService } from '../services/camelot.service.js';

export function registerHarmonicHandlers(
  ipcMain: typeof import('electron').ipcMain,
  camelotService: CamelotService
): void {
  ipcMain.handle('harmonic:getCompatibleKeys', (_event, key: string) => {
    return camelotService.getCompatibleKeys(key);
  });

  ipcMain.handle(
    'harmonic:findCompatibleAssets',
    (
      _event,
      key: string,
      assets: Array<{ id: number; key?: string; name: string }>
    ) => {
      return camelotService.findCompatibleAssets(key, assets);
    }
  );

  ipcMain.handle('harmonic:getCode', (_event, key: string) => {
    return camelotService.getCode(key);
  });
}
