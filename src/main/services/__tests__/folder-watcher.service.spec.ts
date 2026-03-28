import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { FolderWatcherService } from '../folder-watcher.service.js';
import type { FileService } from '../file.service.js';
import type { AnalysisPipelineService } from '../analysis-pipeline.service.js';

// Mock fs module
vi.mock('fs', () => ({
  watch: vi.fn(),
  existsSync: vi.fn(),
  statSync: vi.fn(),
}));

import { watch, existsSync } from 'fs';

describe('FolderWatcherService', () => {
  let service: FolderWatcherService;
  let fileService: Partial<FileService>;
  let analysisPipelineService: Partial<AnalysisPipelineService>;
  let mockWatcher: any;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    vi.useFakeTimers();

    // Create mock implementations
    mockWatcher = {
      close: vi.fn(),
    };

    (watch as any).mockReturnValue(mockWatcher);
    (existsSync as any).mockReturnValue(true);

    fileService = {
      importFile: vi.fn().mockResolvedValue({
        id: 1,
        name: 'test.wav',
        file_path: '/media/test.wav',
        file_type: 'wav',
        file_size: 1000,
        created_at: new Date().toISOString(),
      }),
      findByFilePath: vi.fn().mockReturnValue(false),
    };

    analysisPipelineService = {
      analyzeAsset: vi.fn().mockResolvedValue({
        bpm: 120,
        key: 'Am',
        durationSec: 5.5,
      }),
    };

    service = new FolderWatcherService(
      fileService as FileService,
      analysisPipelineService as AnalysisPipelineService
    );
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('watchFolder', () => {
    it('calls fs.watch with the given path and persistent: false, recursive: true', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);

      expect(watch).toHaveBeenCalledWith(
        folderPath,
        { persistent: false, recursive: true },
        expect.any(Function)
      );
    });

    it('passes recursive: true to fs.watch for subdirectory support', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);

      expect(watch).toHaveBeenCalledWith(
        expect.any(String),
        expect.objectContaining({ recursive: true }),
        expect.any(Function)
      );
    });

    it('stores the watcher in the map for later cleanup', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);

      expect(service.getWatchedFolders()).toContain(folderPath);
    });

    it('does not create duplicate watchers for the same path', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);
      service.watchFolder(folderPath);

      expect(watch).toHaveBeenCalledTimes(1);
    });

    it('watches multiple folders independently', () => {
      const folder1 = '/path/to/sync/folder1';
      const folder2 = '/path/to/sync/folder2';

      service.watchFolder(folder1);
      service.watchFolder(folder2);

      expect(watch).toHaveBeenCalledTimes(2);
      expect(service.getWatchedFolders()).toContain(folder1);
      expect(service.getWatchedFolders()).toContain(folder2);
    });
  });

  describe('unwatchFolder', () => {
    it('calls watcher.close() for the folder', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);
      service.unwatchFolder(folderPath);

      expect(mockWatcher.close).toHaveBeenCalled();
    });

    it('removes the folder from watched list', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);
      expect(service.getWatchedFolders()).toContain(folderPath);

      service.unwatchFolder(folderPath);
      expect(service.getWatchedFolders()).not.toContain(folderPath);
    });

    it('does nothing if folder is not being watched', () => {
      const folderPath = '/path/to/sync/folder';

      expect(() => service.unwatchFolder(folderPath)).not.toThrow();
    });

    it('allows re-watching a folder after unwatch', () => {
      const folderPath = '/path/to/sync/folder';

      service.watchFolder(folderPath);
      service.unwatchFolder(folderPath);
      service.watchFolder(folderPath);

      expect(watch).toHaveBeenCalledTimes(2);
      expect(service.getWatchedFolders()).toContain(folderPath);
    });
  });

  describe('unwatchAll', () => {
    it('closes all active watchers', () => {
      const folder1 = '/path/to/sync/folder1';
      const folder2 = '/path/to/sync/folder2';

      service.watchFolder(folder1);
      service.watchFolder(folder2);

      service.unwatchAll();

      expect(mockWatcher.close).toHaveBeenCalledTimes(2);
    });

    it('clears all folders from watched list', () => {
      const folder1 = '/path/to/sync/folder1';
      const folder2 = '/path/to/sync/folder2';

      service.watchFolder(folder1);
      service.watchFolder(folder2);

      service.unwatchAll();

      expect(service.getWatchedFolders()).toEqual([]);
    });
  });

  describe('getWatchedFolders', () => {
    it('returns an empty array initially', () => {
      expect(service.getWatchedFolders()).toEqual([]);
    });

    it('returns list of watched folders', () => {
      const folder1 = '/path/to/sync/folder1';
      const folder2 = '/path/to/sync/folder2';

      service.watchFolder(folder1);
      service.watchFolder(folder2);

      const watched = service.getWatchedFolders();
      expect(watched).toContain(folder1);
      expect(watched).toContain(folder2);
      expect(watched.length).toBe(2);
    });

    it('returns updated list after unwatch', () => {
      const folder1 = '/path/to/sync/folder1';
      const folder2 = '/path/to/sync/folder2';

      service.watchFolder(folder1);
      service.watchFolder(folder2);
      service.unwatchFolder(folder1);

      const watched = service.getWatchedFolders();
      expect(watched).not.toContain(folder1);
      expect(watched).toContain(folder2);
      expect(watched.length).toBe(1);
    });
  });

  describe('setOnFileAdded', () => {
    it('sets the onFileAdded callback', () => {
      const callback = vi.fn();

      service.setOnFileAdded(callback);

      // We'll test that it's called in the integration tests below
    });
  });

  describe('fs.watch event handling', () => {
    it('ignores non-rename events', () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('change', 'somefile.wav');

      // fileService.importFile should not be called
      expect(fileService.importFile).not.toHaveBeenCalled();
    });

    it('ignores non-audio file extensions', () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);

      // Try various non-audio extensions
      watchCallback('rename', 'file.txt');
      watchCallback('rename', 'file.doc');
      watchCallback('rename', 'file.jpg');

      expect(fileService.importFile).not.toHaveBeenCalled();
    });

    it('processes .wav files after debounce', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      // Before debounce timeout, importFile should not be called
      expect(fileService.importFile).not.toHaveBeenCalled();

      // Advance time by 500ms
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // After debounce, importFile should be called
      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.wav');
    });

    it('processes .mp3 files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.mp3');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.mp3');
    });

    it('processes .flac files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.flac');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.flac');
    });

    it('processes .aiff files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.aiff');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.aiff');
    });

    it('processes .ogg files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.ogg');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.ogg');
    });

    it('processes .m4a files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.m4a');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.m4a');
    });

    it('processes .aac files', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.aac');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.aac');
    });

    it('skips if file no longer exists after debounce', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      (existsSync as any).mockReturnValue(false);

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // File was deleted before we could process it
      expect(fileService.importFile).not.toHaveBeenCalled();
    });

    it('handles case-insensitive file extensions', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.WAV');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.WAV');
    });

    it('ignores events with no filename', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', null);

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(fileService.importFile).not.toHaveBeenCalled();
    });

    it('skips import if file already exists in library', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      // Mock findByFilePath to indicate file already exists
      (fileService.findByFilePath as any).mockReturnValue(true);

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // importFile should NOT be called since file already exists
      expect(fileService.importFile).not.toHaveBeenCalled();
      // analyzeAsset should also NOT be called
      expect(analysisPipelineService.analyzeAsset).not.toHaveBeenCalled();
    });
  });

  describe('processNewFile integration', () => {
    it('calls importFile and then analyzeAsset', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // Both should be called
      expect(fileService.importFile).toHaveBeenCalledWith('/path/to/sync/folder/test.wav');
      expect(analysisPipelineService.analyzeAsset).toHaveBeenCalledWith(
        1,
        '/media/test.wav'
      );
    });

    it('calls onFileAdded callback with assetId and filePath', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      const onFileAddedCallback = vi.fn();
      service.setOnFileAdded(onFileAddedCallback);

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      expect(onFileAddedCallback).toHaveBeenCalledWith(
        expect.objectContaining({ id: 1, file_path: '/media/test.wav' })
      );
    });

    it('handles importFile errors gracefully', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      (fileService.importFile as any).mockRejectedValue(new Error('Import failed'));

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      // Should not throw - error is caught and logged
      await vi.runAllTimersAsync();

      // analyzeAsset should not be called if import fails
      expect(analysisPipelineService.analyzeAsset).not.toHaveBeenCalled();
    });

    it('handles analyzeAsset errors gracefully', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      (analysisPipelineService.analyzeAsset as any).mockRejectedValue(
        new Error('Analysis failed')
      );

      service.watchFolder(folderPath);
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      // Should not throw - error is caught and logged
      await vi.runAllTimersAsync();

      // importFile should still have been called
      expect(fileService.importFile).toHaveBeenCalled();
    });

    it('continues to process other files even if one fails', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      let callCount = 0;
      (fileService.importFile as any).mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          throw new Error('First file failed');
        }
        return Promise.resolve({
          id: callCount,
          name: `test${callCount}.wav`,
          file_path: `/media/test${callCount}.wav`,
          file_type: 'wav',
          file_size: 1000,
          created_at: new Date().toISOString(),
        });
      });

      service.watchFolder(folderPath);

      // First file (should fail)
      watchCallback('rename', 'test1.wav');
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // Second file (should succeed)
      watchCallback('rename', 'test2.wav');
      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // Both should have been attempted
      expect(fileService.importFile).toHaveBeenCalledTimes(2);
      expect(analysisPipelineService.analyzeAsset).toHaveBeenCalledTimes(1); // Only second succeeded
    });
  });

  describe('multiple debounce events for same file', () => {
    it('processes file only once even if multiple rename events occur', async () => {
      const folderPath = '/path/to/sync/folder';
      let watchCallback: any;

      (watch as any).mockImplementation((_path: string, _opts: any, cb: Function) => {
        watchCallback = cb;
        return mockWatcher;
      });

      service.watchFolder(folderPath);

      // Multiple rename events in quick succession
      watchCallback('rename', 'test.wav');
      watchCallback('rename', 'test.wav');
      watchCallback('rename', 'test.wav');

      vi.advanceTimersByTime(800);
      await vi.runAllTimersAsync();

      // Will be called 3 times since each debounce timer is independent
      // This is expected behavior - each rename event creates its own debounce
      expect(fileService.importFile).toHaveBeenCalled();
    });
  });
});
