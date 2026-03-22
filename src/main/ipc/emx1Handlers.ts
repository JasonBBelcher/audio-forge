import type { IpcMain } from 'electron';
import type { EMX1Service, EMX1Pattern } from '../services/emx1.service.js';

export function registerEMX1Handlers(ipcMain: IpcMain, emx1Service: EMX1Service): void {
  ipcMain.handle('emx1:listPorts', () => {
    return emx1Service.listPorts();
  });

  ipcMain.handle('emx1:connect', (_event, inputPort: string | number, outputPort: string | number) => {
    emx1Service.connect(inputPort, outputPort);
  });

  ipcMain.handle('emx1:disconnect', () => {
    emx1Service.disconnect();
  });

  ipcMain.handle('emx1:requestDump', async () => {
    const sysex = await emx1Service.requestPatternDump();
    return Array.from(sysex);
  });

  ipcMain.handle('emx1:parseDump', (_event, sysexBytes: number[]) => {
    const sysex = Buffer.from(sysexBytes);
    return emx1Service.parsePatternDump(sysex);
  });

  ipcMain.handle('emx1:selectPattern', (_event, patternNumber: number) => {
    emx1Service.selectPattern(patternNumber);
  });

  ipcMain.handle('emx1:exportMidi', async (_event, pattern: EMX1Pattern, outputPath: string) => {
    return emx1Service.exportPatternAsMidi(pattern, outputPath);
  });

  ipcMain.handle('emx1:sendStart', () => {
    emx1Service.sendStart();
  });

  ipcMain.handle('emx1:sendStop', () => {
    emx1Service.sendStop();
  });

  ipcMain.handle('emx1:isConnected', () => {
    return emx1Service.isConnected();
  });
}
