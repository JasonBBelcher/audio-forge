import type { AudioService } from './audio.service.js';
import type { FileService } from './file.service.js';

export interface AnalysisResults {
  bpm?: number;
  key?: string;
  durationSec?: number;
}

export class AnalysisPipelineService {
  constructor(
    private readonly audioService: AudioService,
    private readonly fileService: FileService
  ) {}

  async analyzeAsset(assetId: number, filePath: string): Promise<AnalysisResults> {
    const results: AnalysisResults = {};

    // Run all three analysis methods in parallel using Promise.allSettled
    // This ensures that if one fails, the others still complete
    const outcomes = await Promise.allSettled([
      this.audioService.analyzeBPM(filePath),
      this.audioService.analyzeKey(filePath),
      this.audioService.getDuration(filePath),
    ]);

    // Extract results from Promise.allSettled outcomes
    const bpmOutcome = outcomes[0];
    if (bpmOutcome.status === 'fulfilled') {
      results.bpm = bpmOutcome.value.bpm;
    }

    const keyOutcome = outcomes[1];
    if (keyOutcome.status === 'fulfilled') {
      results.key = keyOutcome.value.key;
    }

    const durationOutcome = outcomes[2];
    if (durationOutcome.status === 'fulfilled') {
      results.durationSec = durationOutcome.value;
    }

    // Save results and stamp analyzed_at so this asset is not re-queued
    this.fileService.updateAssetAnalysis(assetId, results);
    this.fileService.markAnalyzed(assetId);

    return results;
  }

  async analyzeAll(): Promise<void> {
    const unanalyzed = this.fileService.listUnanalyzedAssets();

    // Process in batches of 3 to avoid overwhelming the system with subprocesses
    const BATCH_SIZE = 3;
    for (let i = 0; i < unanalyzed.length; i += BATCH_SIZE) {
      await Promise.allSettled(
        unanalyzed.slice(i, i + BATCH_SIZE).map((asset) => this.analyzeAsset(asset.id, asset.file_path))
      );
    }
  }
}
