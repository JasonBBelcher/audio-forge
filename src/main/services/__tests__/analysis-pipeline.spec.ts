import { describe, it, expect, beforeEach, vi } from 'vitest';
import { AnalysisPipelineService } from '../analysis-pipeline.service.js';
import type { AudioService } from '../audio.service.js';
import type { FileService } from '../file.service.js';

describe('AnalysisPipelineService', () => {
  let service: AnalysisPipelineService;
  let audioService: Partial<AudioService>;
  let fileService: Partial<FileService>;

  beforeEach(() => {
    audioService = {
      analyzeBPM: vi.fn().mockResolvedValue({ bpm: 120 }),
      analyzeKey: vi.fn().mockResolvedValue({ key: 'Am' }),
      getDuration: vi.fn().mockResolvedValue(3.5),
    };

    fileService = {
      updateAssetAnalysis: vi.fn(),
      listUnanalyzedAssets: vi.fn().mockReturnValue([]),
    };

    service = new AnalysisPipelineService(
      audioService as AudioService,
      fileService as FileService
    );
  });

  describe('analyzeAsset', () => {
    it('runs all three analysis methods in parallel', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      await service.analyzeAsset(assetId, filePath);

      expect(audioService.analyzeBPM).toHaveBeenCalledWith(filePath);
      expect(audioService.analyzeKey).toHaveBeenCalledWith(filePath);
      expect(audioService.getDuration).toHaveBeenCalledWith(filePath);
    });

    it('saves results to database via updateAssetAnalysis', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      await service.analyzeAsset(assetId, filePath);

      expect(fileService.updateAssetAnalysis).toHaveBeenCalledWith(
        assetId,
        expect.objectContaining({
          bpm: 120,
          key: 'Am',
          durationSec: 3.5,
        })
      );
    });

    it('returns analysis results', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: 120,
        key: 'Am',
        durationSec: 3.5,
      });
    });

    it('continues analysis if one method fails (BPM)', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      (audioService.analyzeBPM as any).mockRejectedValue(new Error('BPM failed'));

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: undefined,
        key: 'Am',
        durationSec: 3.5,
      });

      expect(fileService.updateAssetAnalysis).toHaveBeenCalledWith(
        assetId,
        expect.objectContaining({
          key: 'Am',
          durationSec: 3.5,
        })
      );
    });

    it('continues analysis if one method fails (Key)', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      (audioService.analyzeKey as any).mockRejectedValue(new Error('Key failed'));

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: 120,
        key: undefined,
        durationSec: 3.5,
      });
    });

    it('continues analysis if one method fails (Duration)', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      (audioService.getDuration as any).mockRejectedValue(new Error('Duration failed'));

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: 120,
        key: 'Am',
        durationSec: undefined,
      });
    });

    it('returns partial results when multiple methods fail', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      (audioService.analyzeBPM as any).mockRejectedValue(new Error('BPM failed'));
      (audioService.analyzeKey as any).mockRejectedValue(new Error('Key failed'));

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: undefined,
        key: undefined,
        durationSec: 3.5,
      });
    });

    it('handles all methods failing gracefully', async () => {
      const assetId = 1;
      const filePath = '/tmp/test.wav';

      (audioService.analyzeBPM as any).mockRejectedValue(new Error('BPM failed'));
      (audioService.analyzeKey as any).mockRejectedValue(new Error('Key failed'));
      (audioService.getDuration as any).mockRejectedValue(new Error('Duration failed'));

      const result = await service.analyzeAsset(assetId, filePath);

      expect(result).toEqual({
        bpm: undefined,
        key: undefined,
        durationSec: undefined,
      });

      expect(fileService.updateAssetAnalysis).toHaveBeenCalledWith(assetId, {});
    });
  });

  describe('analyzeAll', () => {
    it('fetches unanalyzed assets and analyzes each', async () => {
      const unanalyzed = [
        { id: 1, file_path: '/tmp/test1.wav', name: 'test1.wav', file_type: 'wav', file_size: 100 },
        { id: 2, file_path: '/tmp/test2.wav', name: 'test2.wav', file_type: 'wav', file_size: 200 },
      ];

      (fileService.listUnanalyzedAssets as any).mockReturnValue(unanalyzed);

      await service.analyzeAll();

      expect(fileService.listUnanalyzedAssets).toHaveBeenCalled();
      expect(audioService.analyzeBPM).toHaveBeenCalledWith('/tmp/test1.wav');
      expect(audioService.analyzeBPM).toHaveBeenCalledWith('/tmp/test2.wav');
    });

    it('saves results for each analyzed asset', async () => {
      const unanalyzed = [
        { id: 1, file_path: '/tmp/test1.wav', name: 'test1.wav', file_type: 'wav', file_size: 100 },
        { id: 2, file_path: '/tmp/test2.wav', name: 'test2.wav', file_type: 'wav', file_size: 200 },
      ];

      (fileService.listUnanalyzedAssets as any).mockReturnValue(unanalyzed);

      await service.analyzeAll();

      expect(fileService.updateAssetAnalysis).toHaveBeenCalledTimes(2);
      expect(fileService.updateAssetAnalysis).toHaveBeenCalledWith(
        1,
        expect.objectContaining({ bpm: 120 })
      );
      expect(fileService.updateAssetAnalysis).toHaveBeenCalledWith(
        2,
        expect.objectContaining({ bpm: 120 })
      );
    });

    it('handles empty list of unanalyzed assets', async () => {
      (fileService.listUnanalyzedAssets as any).mockReturnValue([]);

      await service.analyzeAll();

      expect(fileService.updateAssetAnalysis).not.toHaveBeenCalled();
    });
  });
});
