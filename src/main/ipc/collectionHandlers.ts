import type { IpcMain } from 'electron';
import type { CollectionService } from '../services/collection.service.js';

export function registerCollectionHandlers(ipcMain: IpcMain, collectionService: CollectionService): void {
  ipcMain.handle('collections:list', () => {
    return collectionService.listCollections();
  });

  ipcMain.handle('collections:create', (_event, name: string, description?: string) => {
    return collectionService.createCollection(name, description);
  });

  ipcMain.handle('collections:delete', (_event, id: number) => {
    collectionService.deleteCollection(id);
  });

  ipcMain.handle('collections:rename', (_event, id: number, name: string) => {
    collectionService.renameCollection(id, name);
  });

  ipcMain.handle('collections:addAsset', (_event, collectionId: number, assetId: number) => {
    collectionService.addAsset(collectionId, assetId);
  });

  ipcMain.handle('collections:removeAsset', (_event, collectionId: number, assetId: number) => {
    collectionService.removeAsset(collectionId, assetId);
  });

  ipcMain.handle('collections:listAssets', (_event, collectionId: number) => {
    return collectionService.listAssets(collectionId);
  });

  ipcMain.handle('collections:exportZip', async (_event, collectionId: number, outputPath: string) => {
    return collectionService.exportAsZip(collectionId, outputPath);
  });
}
