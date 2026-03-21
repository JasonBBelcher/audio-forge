import { writable } from 'svelte/store';

export type Theme = 'dark' | 'light';
export type AudioQuality = 'low' | 'medium' | 'high';

export interface Settings {
  defaultBpm: number;
  theme: Theme;
  audioQuality: AudioQuality;
  metronomeVolume: number;
  autoDetectBpm: boolean;
  autoDetectKey: boolean;
}

const DEFAULTS: Settings = {
  defaultBpm: 120,
  theme: 'dark',
  audioQuality: 'high',
  metronomeVolume: 0.8,
  autoDetectBpm: false,
  autoDetectKey: false,
};

const STORAGE_KEY = 'audioforge_settings';
const VALID_THEMES: Theme[] = ['dark', 'light'];

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function sanitize(partial: Partial<Settings>): Partial<Settings> {
  const out: Partial<Settings> = { ...partial };
  if (out.defaultBpm !== undefined) {
    out.defaultBpm = clamp(Math.round(out.defaultBpm), 20, 300);
  }
  if (out.metronomeVolume !== undefined) {
    out.metronomeVolume = clamp(out.metronomeVolume, 0, 1);
  }
  if (out.theme !== undefined && !VALID_THEMES.includes(out.theme)) {
    delete out.theme;
  }
  return out;
}

function loadFromStorage(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw) as Partial<Settings>;
      return { ...DEFAULTS, ...sanitize(parsed) };
    }
  } catch {
    // ignore
  }
  return { ...DEFAULTS };
}

function saveToStorage(settings: Settings): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  } catch {
    // ignore
  }
}

function createSettingsStore() {
  const { subscribe, set, update: rawUpdate } = writable<Settings>(loadFromStorage());

  subscribe(saveToStorage);

  // Helper function to check if IPC is available at runtime
  const checkHasIPC = () => typeof globalThis !== 'undefined' && (globalThis as any).audioforge;

  return {
    subscribe,
    update: (partial: Partial<Settings>) => {
      rawUpdate(current => ({ ...current, ...sanitize(partial) }));

      // Also persist via IPC if available
      const hasIPC = checkHasIPC();
      if (hasIPC) {
        try {
          const current = ({ ...DEFAULTS, ...sanitize(partial) });
          for (const [key, value] of Object.entries(current)) {
            (globalThis as any).audioforge.settings.set(key, value).catch((err: any) => {
              console.error(`Failed to persist setting ${key} via IPC:`, err);
            });
          }
        } catch (err) {
          console.error('Failed to persist settings via IPC:', err);
        }
      }
    },
    reset: () => {
      set({ ...DEFAULTS });

      // Also reset via IPC if available
      const hasIPC = checkHasIPC();
      if (hasIPC) {
        try {
          for (const [key, value] of Object.entries(DEFAULTS)) {
            (globalThis as any).audioforge.settings.set(key, value).catch((err: any) => {
              console.error(`Failed to reset setting ${key} via IPC:`, err);
            });
          }
        } catch (err) {
          console.error('Failed to reset settings via IPC:', err);
        }
      }
    },

    async loadSettings() {
      const hasIPC = checkHasIPC();
      if (!hasIPC) return;
      try {
        const result = await (globalThis as any).audioforge.settings.getAll();
        const merged = { ...DEFAULTS, ...sanitize(result) };
        set(merged);
      } catch (err) {
        console.error('Failed to load settings from IPC:', err);
      }
    },
  };
}

export const settingsStore = createSettingsStore();
