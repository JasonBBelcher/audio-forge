import { describe, it, expect, beforeEach, vi } from 'vitest';
import type { IpcMain } from 'electron';
import { registerDiscoveryHandlers } from '../discoveryHandlers';
import type { DiscoveryService } from '../../services/discovery.service';

describe('Discovery IPC Handlers', () => {
  let mockIpcMain: any;
  let mockDiscoveryService: any;
  const handlers: Map<string, Function> = new Map();

  beforeEach(() => {
    handlers.clear();

    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
    } as unknown as IpcMain;

    mockDiscoveryService = {
      rollDice: vi.fn().mockResolvedValue({ id: 1, youtube_id: 'test', title: 'Test Track' }),
      search: vi.fn().mockResolvedValue([{ id: 1, youtube_id: 'test', title: 'Test Track' }]),
      batchProcess: vi.fn().mockResolvedValue([]),
      processUrl: vi.fn().mockResolvedValue({ id: 1, youtube_id: 'test', title: 'Test Track' }),
      getHistory: vi.fn().mockReturnValue([]),
      getFavorites: vi.fn().mockReturnValue([]),
      toggleFavorite: vi.fn().mockReturnValue(true),
      updateNotes: vi.fn(),
      createPlaylist: vi.fn().mockReturnValue(1),
      listPlaylists: vi.fn().mockReturnValue([]),
      addToPlaylist: vi.fn(),
      getPlaylistItems: vi.fn().mockReturnValue([]),
      importToLibrary: vi.fn().mockResolvedValue(123),
    } as unknown as DiscoveryService;

    registerDiscoveryHandlers(mockIpcMain, mockDiscoveryService);
  });

  describe('Handler Registration', () => {
    it('should register all required discovery handlers', () => {
      const expectedHandlers = [
        'discovery:roll',
        'discovery:search',
        'discovery:batch',
        'discovery:processUrl',
        'discovery:getHistory',
        'discovery:getFavorites',
        'discovery:toggleFavorite',
        'discovery:updateNotes',
        'discovery:createPlaylist',
        'discovery:listPlaylists',
        'discovery:addToPlaylist',
        'discovery:getPlaylistItems',
        'discovery:importToLibrary',
      ];

      expectedHandlers.forEach((handler) => {
        expect(handlers.has(handler)).toBe(true);
      });

      expect(handlers.size).toBe(expectedHandlers.length);
    });
  });

  describe('discovery:roll Handler', () => {
    it('should call discoveryService.rollDice with filters', async () => {
      const handler = handlers.get('discovery:roll');
      const filters = { genres: ['funk'] };

      await handler({}, filters);

      expect(mockDiscoveryService.rollDice).toHaveBeenCalledWith(filters);
    });

    it('should return discovery result', async () => {
      const handler = handlers.get('discovery:roll');
      const result = await handler({});

      expect(result).toBeDefined();
      expect(result.youtube_id).toBe('test');
    });
  });

  describe('discovery:search Handler', () => {
    it('should call discoveryService.search with query and params', async () => {
      const handler = handlers.get('discovery:search');
      const data = { query: 'funk', filters: { bpmMin: 100 }, limit: 20 };

      await handler({}, data);

      expect(mockDiscoveryService.search).toHaveBeenCalledWith('funk', { bpmMin: 100 }, 20);
    });

    it('should use default limit if not provided', async () => {
      const handler = handlers.get('discovery:search');
      const data = { query: 'funk' };

      await handler({}, data);

      expect(mockDiscoveryService.search).toHaveBeenCalledWith('funk', undefined, undefined);
    });
  });

  describe('discovery:batch Handler', () => {
    it('should call discoveryService.batchProcess with URLs', async () => {
      const handler = handlers.get('discovery:batch');
      const urls = ['https://youtube.com/watch?v=test1', 'https://youtu.be/test2'];

      await handler({}, urls);

      expect(mockDiscoveryService.batchProcess).toHaveBeenCalledWith(urls);
    });

    it('should return array of results', async () => {
      mockDiscoveryService.batchProcess.mockResolvedValue([
        { id: 1, youtube_id: 'test1' },
        { id: 2, youtube_id: 'test2' },
      ]);

      const handler = handlers.get('discovery:batch');
      const result = await handler({}, []);

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('discovery:processUrl Handler', () => {
    it('should call discoveryService.processUrl with URL', async () => {
      const handler = handlers.get('discovery:processUrl');
      const url = 'https://youtube.com/watch?v=test';

      await handler({}, url);

      expect(mockDiscoveryService.processUrl).toHaveBeenCalledWith(url);
    });

    it('should return discovery result', async () => {
      const handler = handlers.get('discovery:processUrl');
      const result = await handler({}, 'https://youtube.com/watch?v=test');

      expect(result).toBeDefined();
      expect(result.youtube_id).toBe('test');
    });
  });

  describe('discovery:getHistory Handler', () => {
    it('should call discoveryService.getHistory', async () => {
      const handler = handlers.get('discovery:getHistory');

      await handler({}, 50);

      expect(mockDiscoveryService.getHistory).toHaveBeenCalledWith(50);
    });

    it('should return history array', async () => {
      mockDiscoveryService.getHistory.mockReturnValue([
        { id: 1, youtube_id: 'test1' },
        { id: 2, youtube_id: 'test2' },
      ]);

      const handler = handlers.get('discovery:getHistory');
      const result = await handler({});

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('discovery:getFavorites Handler', () => {
    it('should call discoveryService.getFavorites', async () => {
      const handler = handlers.get('discovery:getFavorites');

      await handler({});

      expect(mockDiscoveryService.getFavorites).toHaveBeenCalled();
    });

    it('should return favorites array', async () => {
      mockDiscoveryService.getFavorites.mockReturnValue([
        { id: 1, youtube_id: 'test1', is_favorite: true },
      ]);

      const handler = handlers.get('discovery:getFavorites');
      const result = await handler({});

      expect(Array.isArray(result)).toBe(true);
      expect(result[0].is_favorite).toBe(true);
    });
  });

  describe('discovery:toggleFavorite Handler', () => {
    it('should call discoveryService.toggleFavorite with discovery ID', async () => {
      const handler = handlers.get('discovery:toggleFavorite');

      await handler({}, 42);

      expect(mockDiscoveryService.toggleFavorite).toHaveBeenCalledWith(42);
    });

    it('should return boolean result', async () => {
      const handler = handlers.get('discovery:toggleFavorite');
      const result = await handler({}, 1);

      expect(typeof result).toBe('boolean');
    });
  });

  describe('discovery:updateNotes Handler', () => {
    it('should call discoveryService.updateNotes', async () => {
      const handler = handlers.get('discovery:updateNotes');
      const data = { discoveryId: 5, notes: 'Great sample!' };

      await handler({}, data);

      expect(mockDiscoveryService.updateNotes).toHaveBeenCalledWith(5, 'Great sample!');
    });

    it('should return true', async () => {
      const handler = handlers.get('discovery:updateNotes');
      const result = await handler({}, { discoveryId: 1, notes: 'Test' });

      expect(result).toBe(true);
    });
  });

  describe('discovery:createPlaylist Handler', () => {
    it('should call discoveryService.createPlaylist', async () => {
      const handler = handlers.get('discovery:createPlaylist');
      const data = { name: 'My Samples', description: 'Cool tracks' };

      await handler({}, data);

      expect(mockDiscoveryService.createPlaylist).toHaveBeenCalledWith(
        'My Samples',
        'Cool tracks'
      );
    });

    it('should return playlist ID', async () => {
      mockDiscoveryService.createPlaylist.mockReturnValue(99);

      const handler = handlers.get('discovery:createPlaylist');
      const result = await handler({}, { name: 'Test' });

      expect(typeof result).toBe('number');
    });
  });

  describe('discovery:listPlaylists Handler', () => {
    it('should call discoveryService.listPlaylists', async () => {
      const handler = handlers.get('discovery:listPlaylists');

      await handler({});

      expect(mockDiscoveryService.listPlaylists).toHaveBeenCalled();
    });

    it('should return array of playlists', async () => {
      mockDiscoveryService.listPlaylists.mockReturnValue([
        { id: 1, name: 'Playlist 1' },
        { id: 2, name: 'Playlist 2' },
      ]);

      const handler = handlers.get('discovery:listPlaylists');
      const result = await handler({});

      expect(Array.isArray(result)).toBe(true);
    });
  });

  describe('discovery:addToPlaylist Handler', () => {
    it('should call discoveryService.addToPlaylist', async () => {
      const handler = handlers.get('discovery:addToPlaylist');
      const data = { playlistId: 1, discoveryId: 5 };

      await handler({}, data);

      expect(mockDiscoveryService.addToPlaylist).toHaveBeenCalledWith(1, 5);
    });

    it('should return true', async () => {
      const handler = handlers.get('discovery:addToPlaylist');
      const result = await handler({}, { playlistId: 1, discoveryId: 5 });

      expect(result).toBe(true);
    });
  });

  describe('discovery:getPlaylistItems Handler', () => {
    it('should call discoveryService.getPlaylistItems with playlist ID', async () => {
      const handler = handlers.get('discovery:getPlaylistItems');

      await handler({}, 3);

      expect(mockDiscoveryService.getPlaylistItems).toHaveBeenCalledWith(3);
    });

    it('should return array of discovery items', async () => {
      mockDiscoveryService.getPlaylistItems.mockReturnValue([
        { id: 1, youtube_id: 'test1', title: 'Track 1' },
        { id: 2, youtube_id: 'test2', title: 'Track 2' },
      ]);

      const handler = handlers.get('discovery:getPlaylistItems');
      const result = await handler({}, 1);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(2);
    });
  });

  describe('discovery:importToLibrary Handler', () => {
    it('should call discoveryService.importToLibrary with options', async () => {
      const handler = handlers.get('discovery:importToLibrary');
      const data = { discoveryId: 7, options: { analyze: true, stems: false } };

      await handler({}, data);

      expect(mockDiscoveryService.importToLibrary).toHaveBeenCalledWith(
        7,
        { analyze: true, stems: false }
      );
    });

    it('should return asset ID', async () => {
      mockDiscoveryService.importToLibrary.mockResolvedValue(456);

      const handler = handlers.get('discovery:importToLibrary');
      const result = await handler({}, { discoveryId: 7 });

      expect(result).toBe(456);
    });

    it('should handle missing options', async () => {
      const handler = handlers.get('discovery:importToLibrary');

      await handler({}, { discoveryId: 7 });

      expect(mockDiscoveryService.importToLibrary).toHaveBeenCalled();
    });
  });

  describe('Error Handling', () => {
    it('should propagate service errors', async () => {
      const error = new Error('Service failed');
      mockDiscoveryService.rollDice.mockRejectedValue(error);

      const handler = handlers.get('discovery:roll');

      await expect(handler({}, {})).rejects.toThrow('Service failed');
    });

    it('should handle invalid parameters gracefully', async () => {
      const handler = handlers.get('discovery:search');

      // Should not throw, but may handle errors in the service
      await expect(handler({}, { query: '' })).resolves.toBeDefined();
    });
  });
});
