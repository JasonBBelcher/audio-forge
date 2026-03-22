import { describe, it, expect, beforeEach, vi } from 'vitest';
import { GenerationService } from '../generation.service.js';
import { ModelRegistry } from '../model-adapter.js';
import type { TextToAudioAdapter, ModelAdapter, ModelCapability } from '../model-adapter.js';
import type { Asset } from '../file.service.js';

class MockTextToAudioAdapter implements TextToAudioAdapter {
  id: string;
  name: string;
  version: string;
  capabilities: ModelCapability[];
  generateCalled = false;
  generateParams: any = null;

  constructor(id: string, name: string) {
    this.id = id;
    this.name = name;
    this.version = '1.0.0';
    this.capabilities = [{ type: 'text-to-audio', description: 'Generation' }];
  }

  async isInstalled(): Promise<boolean> {
    return true;
  }

  async install(): Promise<void> {
    // no-op
  }

  async uninstall(): Promise<void> {
    // no-op
  }

  async generate(params: {
    prompt: string;
    durationSec: number;
    seed?: number;
    steps?: number;
    guidance?: number;
    outputPath: string;
    onProgress?: (pct: number) => void;
  }): Promise<string> {
    this.generateCalled = true;
    this.generateParams = params;
    return params.outputPath;
  }
}

class MockFileService {
  importFileCalled = false;
  importFileParams: any = null;

  async importFile(filePath: string): Promise<Asset> {
    this.importFileCalled = true;
    this.importFileParams = filePath;
    return {
      id: 123,
      name: 'generated.wav',
      file_path: filePath,
      file_type: 'wav',
      file_size: 1000000,
      created_at: new Date().toISOString(),
    };
  }
}

describe('GenerationService', () => {
  let service: GenerationService;
  let registry: ModelRegistry;
  let fileService: MockFileService;
  let mockAdapter: MockTextToAudioAdapter;

  beforeEach(() => {
    registry = new ModelRegistry();
    fileService = new MockFileService();
    mockAdapter = new MockTextToAudioAdapter('stable-audio', 'Stable Audio');
    registry.register(mockAdapter);

    service = new GenerationService(registry, fileService as any);
    vi.clearAllMocks();
  });

  describe('generate', () => {
    it('should look up model by id and call adapter.generate', async () => {
      const result = await service.generate({
        modelId: 'stable-audio',
        prompt: 'Ambient music',
        durationSec: 10,
        outputDir: '/tmp',
      });

      expect(mockAdapter.generateCalled).toBe(true);
      expect(result.filePath).toMatch(/^\/tmp\/generated_\d+\.wav$/);
    });

    it('should pass all generation parameters to adapter', async () => {
      await service.generate({
        modelId: 'stable-audio',
        prompt: 'Specific prompt',
        durationSec: 15,
        seed: 42,
        steps: 50,
        guidance: 8.5,
        outputDir: '/tmp',
      });

      expect(mockAdapter.generateParams.prompt).toBe('Specific prompt');
      expect(mockAdapter.generateParams.durationSec).toBe(15);
      expect(mockAdapter.generateParams.seed).toBe(42);
      expect(mockAdapter.generateParams.steps).toBe(50);
      expect(mockAdapter.generateParams.guidance).toBe(8.5);
    });

    it('should call fileService.importFile with output path', async () => {
      await service.generate({
        modelId: 'stable-audio',
        prompt: 'Test',
        durationSec: 10,
        outputDir: '/tmp',
      });

      expect(fileService.importFileCalled).toBe(true);
      expect(fileService.importFileParams).toContain('/tmp/generated_');
    });

    it('should return filePath and assetId from import', async () => {
      const result = await service.generate({
        modelId: 'stable-audio',
        prompt: 'Test',
        durationSec: 10,
        outputDir: '/tmp',
      });

      expect(result.filePath).toBeDefined();
      expect(result.assetId).toBe(123);
    });

    it('should pass onProgress callback to adapter', async () => {
      const progressCallback = vi.fn();

      await service.generate({
        modelId: 'stable-audio',
        prompt: 'Test',
        durationSec: 10,
        outputDir: '/tmp',
        onProgress: progressCallback,
      });

      expect(mockAdapter.generateParams.onProgress).toBe(progressCallback);
    });

    it('should throw error if model not found', async () => {
      await expect(
        service.generate({
          modelId: 'non-existent-model',
          prompt: 'Test',
          durationSec: 10,
          outputDir: '/tmp',
        })
      ).rejects.toThrow('Model not found');
    });

    it('should create timestamped output file in output directory', async () => {
      const result = await service.generate({
        modelId: 'stable-audio',
        prompt: 'Test',
        durationSec: 10,
        outputDir: '/my/output/dir',
      });

      expect(result.filePath).toMatch(/^\/my\/output\/dir\/generated_\d+\.wav$/);
    });
  });

  describe('listModels', () => {
    it('should return adapters with text-to-audio capability', async () => {
      const models = await service.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('stable-audio');
    });

    it('should return empty list if no text-to-audio models registered', async () => {
      const emptyRegistry = new ModelRegistry();
      const emptyService = new GenerationService(emptyRegistry, fileService as any);

      const models = await emptyService.listModels();

      expect(models).toHaveLength(0);
    });

    it('should filter only text-to-audio capable models', async () => {
      class MockOtherAdapter implements ModelAdapter {
        id = 'other-model';
        name = 'Other Model';
        version = '1.0.0';
        capabilities = [{ type: 'audio-to-midi' as const, description: 'Conversion' }];

        async isInstalled(): Promise<boolean> {
          return true;
        }
        async install(): Promise<void> {}
        async uninstall(): Promise<void> {}
      }

      registry.register(new MockOtherAdapter());

      const models = await service.listModels();

      expect(models).toHaveLength(1);
      expect(models[0].id).toBe('stable-audio');
    });
  });

  describe('isModelInstalled', () => {
    it('should check if model is installed', async () => {
      mockAdapter.isInstalled = vi.fn().mockResolvedValue(true);

      const result = await service.isModelInstalled('stable-audio');

      expect(result).toBe(true);
      expect(mockAdapter.isInstalled).toHaveBeenCalled();
    });

    it('should return false if model not found', async () => {
      const result = await service.isModelInstalled('non-existent');

      expect(result).toBe(false);
    });
  });

  describe('installModel', () => {
    it('should call adapter.install with progress callback', async () => {
      mockAdapter.install = vi.fn().mockResolvedValue(undefined);
      const progressCallback = vi.fn();

      await service.installModel('stable-audio', progressCallback);

      expect(mockAdapter.install).toHaveBeenCalledWith(progressCallback);
    });

    it('should throw error if model not found', async () => {
      await expect(service.installModel('non-existent')).rejects.toThrow('Model not found');
    });
  });
});
