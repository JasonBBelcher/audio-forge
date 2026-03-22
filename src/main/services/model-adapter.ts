export interface ModelCapability {
  type: 'text-to-audio' | 'audio-to-midi' | 'stem-separation' | 'key-detection' | 'bpm-detection';
  description: string;
}

export interface ModelAdapter {
  readonly id: string;
  readonly name: string;
  readonly version: string;
  readonly capabilities: ModelCapability[];

  isInstalled(): Promise<boolean>;
  install(onProgress?: (pct: number, msg: string) => void): Promise<void>;
  uninstall(): Promise<void>;
}

export interface TextToAudioAdapter extends ModelAdapter {
  generate(params: {
    prompt: string;
    durationSec: number;
    seed?: number;
    steps?: number;
    guidance?: number;
    outputPath: string;
    onProgress?: (pct: number) => void;
  }): Promise<string>;
}

export class ModelRegistry {
  private adapters = new Map<string, ModelAdapter>();

  register(adapter: ModelAdapter): void {
    this.adapters.set(adapter.id, adapter);
  }

  get(id: string): ModelAdapter | undefined {
    return this.adapters.get(id);
  }

  list(): ModelAdapter[] {
    return Array.from(this.adapters.values());
  }

  listByCapability(type: ModelCapability['type']): ModelAdapter[] {
    return Array.from(this.adapters.values()).filter((adapter) =>
      adapter.capabilities.some((cap) => cap.type === type)
    );
  }
}
