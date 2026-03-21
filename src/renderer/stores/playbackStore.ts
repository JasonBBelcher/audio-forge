import { writable } from 'svelte/store';

export interface PlaybackState {
  isPlaying: boolean;
  currentTime: number;
  duration: number;
  masterVolume: number;
  bpm: number;
  isMuted: boolean;
}

function createPlaybackStore() {
  const initialState: PlaybackState = {
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    masterVolume: 1.0,
    bpm: 120,
    isMuted: false,
  };

  const { subscribe, set, update } = writable<PlaybackState>(initialState);

  return {
    subscribe,
    play: () => update((state) => ({ ...state, isPlaying: true })),
    pause: () => update((state) => ({ ...state, isPlaying: false })),
    stop: () => update((state) => ({ ...state, isPlaying: false, currentTime: 0 })),
    seek: (time: number) => update((state) => ({ ...state, currentTime: time })),
    setVolume: (volume: number) => update((state) => ({ ...state, masterVolume: Math.max(0, Math.min(1, volume)) })),
    setDuration: (duration: number) => update((state) => ({ ...state, duration })),
    setMuted: (muted: boolean) => update((state) => ({ ...state, isMuted: muted })),
    setBpm: (bpm: number) => update((state) => ({ ...state, bpm })),
    reset: () => set(initialState),
  };
}

export const playbackStore = createPlaybackStore();
