import { describe, it, expect } from 'vitest';
import { ModelRegistry } from '../model-adapter.js';
import type { ModelAdapter, ModelCapability } from '../model-adapter.js';

class MockAdapter implements ModelAdapter {
  id: string;
  name: string;
  version: string;
  capabilities: ModelCapability[];

  constructor(id: string, name: string, capabilities: ModelCapability[]) {
    this.id = id;
    this.name = name;
    this.version = '1.0.0';
    this.capabilities = capabilities;
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
}

describe('ModelRegistry', () => {
  it('should register an adapter and retrieve it by id', () => {
    const registry = new ModelRegistry();
    const adapter = new MockAdapter('test-model', 'Test Model', [
      { type: 'text-to-audio', description: 'Test generation' },
    ]);

    registry.register(adapter);
    const retrieved = registry.get('test-model');

    expect(retrieved).toBe(adapter);
  });

  it('should return undefined for non-existent adapter', () => {
    const registry = new ModelRegistry();
    const retrieved = registry.get('non-existent');

    expect(retrieved).toBeUndefined();
  });

  it('should list all registered adapters', () => {
    const registry = new ModelRegistry();
    const adapter1 = new MockAdapter('model1', 'Model 1', [
      { type: 'text-to-audio', description: 'Generation' },
    ]);
    const adapter2 = new MockAdapter('model2', 'Model 2', [
      { type: 'audio-to-midi', description: 'Conversion' },
    ]);

    registry.register(adapter1);
    registry.register(adapter2);
    const list = registry.list();

    expect(list).toHaveLength(2);
    expect(list).toContain(adapter1);
    expect(list).toContain(adapter2);
  });

  it('should filter adapters by capability type', () => {
    const registry = new ModelRegistry();
    const textToAudioAdapter = new MockAdapter('tts', 'Text-to-Audio', [
      { type: 'text-to-audio', description: 'Generation' },
    ]);
    const midiAdapter = new MockAdapter('midi-converter', 'MIDI Converter', [
      { type: 'audio-to-midi', description: 'Conversion' },
    ]);

    registry.register(textToAudioAdapter);
    registry.register(midiAdapter);
    const textToAudioList = registry.listByCapability('text-to-audio');

    expect(textToAudioList).toHaveLength(1);
    expect(textToAudioList[0].id).toBe('tts');
  });

  it('should return empty list when filtering by non-existent capability', () => {
    const registry = new ModelRegistry();
    const adapter = new MockAdapter('model', 'Model', [
      { type: 'text-to-audio', description: 'Generation' },
    ]);

    registry.register(adapter);
    const list = registry.listByCapability('stem-separation');

    expect(list).toHaveLength(0);
  });

  it('should allow registering adapters with multiple capabilities', () => {
    const registry = new ModelRegistry();
    const multiCapabilityAdapter = new MockAdapter('multi', 'Multi Capability', [
      { type: 'text-to-audio', description: 'Generation' },
      { type: 'audio-to-midi', description: 'Conversion' },
    ]);

    registry.register(multiCapabilityAdapter);
    const textToAudioList = registry.listByCapability('text-to-audio');
    const midiList = registry.listByCapability('audio-to-midi');

    expect(textToAudioList).toHaveLength(1);
    expect(midiList).toHaveLength(1);
    expect(textToAudioList[0]).toBe(midiList[0]);
  });
});
