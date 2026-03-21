import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {};
  return {
    getItem: (key: string) => store[key] ?? null,
    setItem: (key: string, val: string) => { store[key] = val; },
    removeItem: (key: string) => { delete store[key]; },
    clear: () => { store = {}; },
  };
})();

Object.defineProperty(global, 'localStorage', { value: localStorageMock });

describe('settingsStore', () => {
  beforeEach(() => {
    localStorageMock.clear();
    vi.resetModules();
  });

  it('has correct default values', async () => {
    const { settingsStore } = await import('../settingsStore');
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.defaultBpm).toBe(120);
    expect(settings.theme).toBe('dark');
    expect(settings.audioQuality).toBe('high');
    expect(settings.metronomeVolume).toBe(0.8);
    expect(settings.autoDetectBpm).toBe(false);
    expect(settings.autoDetectKey).toBe(false);
  });

  it('updates individual settings', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ defaultBpm: 140 });
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.defaultBpm).toBe(140);
    expect(settings.theme).toBe('dark'); // others unchanged
  });

  it('persists to localStorage', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ theme: 'light' });
    const stored = JSON.parse(localStorageMock.getItem('audioforge_settings') ?? '{}');
    expect(stored.theme).toBe('light');
  });

  it('loads from localStorage on init', async () => {
    localStorageMock.setItem('audioforge_settings', JSON.stringify({ defaultBpm: 90, theme: 'light' }));
    const { settingsStore } = await import('../settingsStore');
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.defaultBpm).toBe(90);
    expect(settings.theme).toBe('light');
  });

  it('resets to defaults', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ defaultBpm: 200, theme: 'light' });
    settingsStore.reset();
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.defaultBpm).toBe(120);
    expect(settings.theme).toBe('dark');
  });

  it('clamps metronomeVolume between 0 and 1', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ metronomeVolume: 1.5 });
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.metronomeVolume).toBeLessThanOrEqual(1);
  });

  it('clamps defaultBpm between 20 and 300', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ defaultBpm: 999 });
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(settings.defaultBpm).toBeLessThanOrEqual(300);
  });

  it('ignores invalid theme values', async () => {
    const { settingsStore } = await import('../settingsStore');
    settingsStore.update({ theme: 'rainbow' as any });
    let settings: any;
    settingsStore.subscribe(s => { settings = s; })();
    expect(['dark', 'light']).toContain(settings.theme);
  });
});
