import { join } from 'path';
import { ModelRegistry, type TextToAudioAdapter, type ModelAdapter } from './model-adapter.js';
import type { FileService } from './file.service.js';

export class GenerationService {
  constructor(
    private modelRegistry: ModelRegistry,
    private fileService: FileService
  ) {}

  async generate(params: {
    modelId: string;
    prompt: string;
    durationSec: number;
    seed?: number;
    steps?: number;
    guidance?: number;
    outputDir: string;
    onProgress?: (pct: number) => void;
  }): Promise<{ filePath: string; assetId: number }> {
    const adapter = this.modelRegistry.get(params.modelId);
    if (!adapter) {
      throw new Error(`Model not found: ${params.modelId}`);
    }

    const textAdapter = adapter as TextToAudioAdapter;

    const fileName = `generated_${Date.now()}.wav`;
    const outputPath = join(params.outputDir, fileName);

    await textAdapter.generate({
      prompt: params.prompt,
      durationSec: params.durationSec,
      seed: params.seed,
      steps: params.steps,
      guidance: params.guidance,
      outputPath,
      onProgress: params.onProgress,
    });

    // Import into library
    const asset = await this.fileService.importFile(outputPath);
    return { filePath: outputPath, assetId: asset.id };
  }

  async listModels(): Promise<ModelAdapter[]> {
    return this.modelRegistry.listByCapability('text-to-audio');
  }

  async isModelInstalled(modelId: string): Promise<boolean> {
    const adapter = this.modelRegistry.get(modelId);
    if (!adapter) {
      return false;
    }
    return adapter.isInstalled();
  }

  async installModel(modelId: string, onProgress?: (pct: number, msg: string) => void): Promise<void> {
    const adapter = this.modelRegistry.get(modelId);
    if (!adapter) {
      throw new Error(`Model not found: ${modelId}`);
    }
    await adapter.install(onProgress);
  }
}
