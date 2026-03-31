import type { IpcMain } from 'electron';
import type { DiscoveryService } from '../services/discovery.service.js';

export function registerDiscoveryHandlers(ipcMain: IpcMain, discoveryService: DiscoveryService): void {
  // Rolling the dice
  ipcMain.handle('discovery:roll', async (_event, filters?: object) => {
    return discoveryService.rollDice(filters as any);
  });

  // Searching
  ipcMain.handle('discovery:search', async (_event, data: { query: string; filters?: object; limit?: number }) => {
    return discoveryService.search(data.query, data.filters as any, data.limit);
  });

  // Batch processing
  ipcMain.handle('discovery:batch', async (_event, urls: string[]) => {
    return discoveryService.batchProcess(urls);
  });

  // Process single URL
  ipcMain.handle('discovery:processUrl', async (_event, url: string) => {
    return discoveryService.processUrl(url);
  });

  // History
  ipcMain.handle('discovery:getHistory', async (_event, limit?: number) => {
    return discoveryService.getHistory(limit);
  });

  // Favorites
  ipcMain.handle('discovery:getFavorites', async (_event) => {
    return discoveryService.getFavorites();
  });

  ipcMain.handle('discovery:toggleFavorite', async (_event, discoveryId: number) => {
    return discoveryService.toggleFavorite(discoveryId);
  });

  // Notes
  ipcMain.handle('discovery:updateNotes', async (_event, data: { discoveryId: number; notes: string }) => {
    discoveryService.updateNotes(data.discoveryId, data.notes);
    return true;
  });

  // Playlists
  ipcMain.handle('discovery:createPlaylist', async (_event, data: { name: string; description?: string }) => {
    return discoveryService.createPlaylist(data.name, data.description);
  });

  ipcMain.handle('discovery:listPlaylists', async (_event) => {
    return discoveryService.listPlaylists();
  });

  ipcMain.handle('discovery:addToPlaylist', async (_event, data: { playlistId: number; discoveryId: number }) => {
    discoveryService.addToPlaylist(data.playlistId, data.discoveryId);
    return true;
  });

  ipcMain.handle('discovery:getPlaylistItems', async (_event, playlistId: number) => {
    return discoveryService.getPlaylistItems(playlistId);
  });

  // Import to library
  ipcMain.handle('discovery:importToLibrary', async (_event, data: { discoveryId: number; options?: object }) => {
    return discoveryService.importToLibrary(data.discoveryId, data.options as any);
  });
}
