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

    // Save results to database
    this.fileService.updateAssetAnalysis(assetId, results);

    return results;
  }

  async analyzeAll(): Promise<void> {
    // Get all assets that don't have complete analysis
    const unanalyzed = this.fileService.listUnanalyzedAssets();

    // Analyze each asset in parallel
    await Promise.all(
      unanalyzed.map((asset) => this.analyzeAsset(asset.id, asset.file_path))
    );
  }
}
