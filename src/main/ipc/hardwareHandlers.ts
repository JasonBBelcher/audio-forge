import type { IpcMain } from 'electron';
import type { AdapterRegistry } from '../services/hardware-adapter.js';

export function registerHardwareHandlers(ipcMain: IpcMain, registry: AdapterRegistry): void {
  ipcMain.handle('hardware:list', () => registry.listAdapters());

  ipcMain.handle('hardware:getStatus', (_event, id: string) => registry.getStatus(id));

  ipcMain.handle('hardware:initialize', (_event, id: string) => registry.initialize(id));

  ipcMain.handle('hardware:teardown', (_event, id: string) => registry.teardown(id));
}
