import { describe, it, expect, vi, beforeEach } from 'vitest';
import { registerMediaSyncHandlers } from '../../../../src/main/ipc/mediaSyncHandlers.js';
import type { MediaSyncService } from '../../../../src/main/services/media-sync.service.js';

describe('registerMediaSyncHandlers', () => {
  let mockIpcMain: any;
  let mockMediaSyncService: any;
  let handlers: Map<string, Function>;

  beforeEach(() => {
    handlers = new Map();
    mockIpcMain = {
      handle: vi.fn((channel: string, handler: Function) => {
        handlers.set(channel, handler);
      }),
    };

    mockMediaSyncService = {
      findOffset: vi.fn(),
      syncAudioWithVideo: vi.fn(),
      alignRecordings: vi.fn(),
      autoSync: vi.fn(),
    };
  });

  it('registers media-sync:findOffset handler', () => {
    registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);

    expect(handlers.has('media-sync:findOffset')).toBe(true);
  });

  it('registers media-sync:syncAudioWithVideo handler', () => {
    registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);

    expect(handlers.has('media-sync:syncAudioWithVideo')).toBe(true);
  });

  it('registers media-sync:alignRecordings handler', () => {
    registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);

    expect(handlers.has('media-sync:alignRecordings')).toBe(true);
  });

  it('registers media-sync:autoSync handler', () => {
    registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);

    expect(handlers.has('media-sync:autoSync')).toBe(true);
  });

  describe('findOffset handler', () => {
    it('calls service method with correct arguments', async () => {
      mockMediaSyncService.findOffset.mockResolvedValue({
        offsetSec: 0.5,
        confidence: 0.9,
        method: 'onset',
      });

      registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);
      const handler = handlers.get('media-sync:findOffset')!;

      const result = await handler({}, '/path/to/ref.wav', '/path/to/target.wav');

      expect(mockMediaSyncService.findOffset).toHaveBeenCalledWith('/path/to/ref.wav', '/path/to/target.wav');
      expect(result).toEqual({
        offsetSec: 0.5,
        confidence: 0.9,
        method: 'onset',
      });
    });
  });

  describe('syncAudioWithVideo handler', () => {
    it('calls service method with correct arguments', async () => {
      mockMediaSyncService.syncAudioWithVideo.mockResolvedValue({
        outputPath: '/path/to/output.wav',
        offsetApplied: 0.5,
      });

      registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);
      const handler = handlers.get('media-sync:syncAudioWithVideo')!;

      const result = await handler(
        {},
        '/path/to/video.wav',
        '/path/to/audio.wav',
        0.5,
        '/path/to/output.wav'
      );

      expect(mockMediaSyncService.syncAudioWithVideo).toHaveBeenCalledWith(
        '/path/to/video.wav',
        '/path/to/audio.wav',
        0.5,
        '/path/to/output.wav'
      );
      expect(result.outputPath).toBe('/path/to/output.wav');
    });
  });

  describe('alignRecordings handler', () => {
    it('calls service method with correct arguments', async () => {
      mockMediaSyncService.alignRecordings.mockResolvedValue([
        '/path/to/output/target1_aligned.wav',
        '/path/to/output/target2_aligned.wav',
      ]);

      registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);
      const handler = handlers.get('media-sync:alignRecordings')!;

      const result = await handler(
        {},
        '/path/to/ref.wav',
        ['/path/to/target1.wav', '/path/to/target2.wav'],
        '/path/to/output'
      );

      expect(mockMediaSyncService.alignRecordings).toHaveBeenCalledWith(
        '/path/to/ref.wav',
        ['/path/to/target1.wav', '/path/to/target2.wav'],
        '/path/to/output'
      );
      expect(result.length).toBe(2);
    });
  });

  describe('autoSync handler', () => {
    it('calls service method with correct arguments', async () => {
      mockMediaSyncService.autoSync.mockResolvedValue({
        outputPath: '/path/to/output.wav',
        offsetApplied: 0.3,
      });

      registerMediaSyncHandlers(mockIpcMain, mockMediaSyncService);
      const handler = handlers.get('media-sync:autoSync')!;

      const result = await handler(
        {},
        '/path/to/video.mp4',
        '/path/to/audio.wav',
        '/path/to/output.wav'
      );

      expect(mockMediaSyncService.autoSync).toHaveBeenCalledWith(
        '/path/to/video.mp4',
        '/path/to/audio.wav',
        '/path/to/output.wav'
      );
      expect(result.outputPath).toBe('/path/to/output.wav');
    });
  });
});
