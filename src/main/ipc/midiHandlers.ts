import { ipcMain, dialog, BrowserWindow } from 'electron';
import type { MidiFilesService } from '../services/midi-files.service.js';

export function registerMidiHandlers(ipcMain: any, midiService: MidiFilesService, mainWindow: BrowserWindow | null) {
  ipcMain.handle('midi:import', async (_e: any, filePaths: string[]) => {
    const results = [];
    for (const filePath of filePaths) {
      try {
        const result = midiService.importMidi(filePath);
        results.push(result);
      } catch (error: any) {
        console.error(`Failed to import MIDI file ${filePath}:`, error);
      }
    }
    return results;
  });

  ipcMain.handle('midi:list', async () => {
    return midiService.listMidi();
  });

  ipcMain.handle('midi:delete', async (_e: any, id: number) => {
    midiService.deleteMidi(id);
  });

  ipcMain.handle('midi:linkToAsset', async (_e: any, midiId: number, assetId: number) => {
    midiService.linkToAsset(midiId, assetId);
  });

  ipcMain.handle('midi:unlinkFromAsset', async (_e: any, midiId: number, assetId: number) => {
    midiService.unlinkFromAsset(midiId, assetId);
  });

  ipcMain.handle('midi:getForAsset', async (_e: any, assetId: number) => {
    return midiService.getMidiForAsset(assetId);
  });

  ipcMain.handle('midi:getAssetsForMidi', async (_e: any, midiId: number) => {
    return midiService.getAssetsForMidi(midiId);
  });

  ipcMain.handle('midi:updateTags', async (_e: any, midiId: number, tags: string[]) => {
    midiService.updateTags(midiId, tags);
  });

  ipcMain.handle('midi:showImportDialog', async () => {
    if (!mainWindow) {
      return { canceled: true, filePaths: [] };
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      filters: [
        { name: 'MIDI Files', extensions: ['mid', 'midi'] },
        { name: 'All Files', extensions: ['*'] },
      ],
      properties: ['openFile', 'multiSelections'],
    });

    return result;
  });
}
