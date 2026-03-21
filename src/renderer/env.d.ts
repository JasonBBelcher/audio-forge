/// <reference types="svelte" />
/// <reference types="vite/client" />

interface AudioForgeAPI {
  youtube: Record<string, never>;
  audio: Record<string, never>;
  video: Record<string, never>;
  sync: Record<string, never>;
  platforms: Record<string, never>;
  files: Record<string, never>;
  projects: Record<string, never>;
  jobs: Record<string, never>;
  settings: Record<string, never>;
  health: Record<string, never>;
  hardware: Record<string, never>;
  midi: Record<string, never>;
  on: (channel: string, cb: (...args: any[]) => void) => void;
  off: (channel: string, cb: (...args: any[]) => void) => void;
}

declare global {
  interface Window {
    audioforge: AudioForgeAPI;
  }
}

export {};
