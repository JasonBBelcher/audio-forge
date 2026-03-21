import { describe, it, expect, beforeEach } from 'vitest';
import { get } from 'svelte/store';
import { playbackStore } from '../playbackStore';

// Helper: read current value without subscribing
function state() { return get(playbackStore as any); }

describe('PlaybackStore', () => {
  beforeEach(() => {
    playbackStore.reset?.();
  });

  describe('Initial State', () => {
    it('initializes with not playing', () => {
      expect(state().isPlaying).toBe(false);
    });
    it('initializes with zero current time', () => {
      expect(state().currentTime).toBe(0);
    });
    it('initializes with zero duration', () => {
      expect(state().duration).toBe(0);
    });
    it('initializes with 100% master volume', () => {
      expect(state().masterVolume).toBe(1.0);
    });
    it('initializes with 120 BPM', () => {
      expect(state().bpm).toBe(120);
    });
    it('initializes as not muted', () => {
      expect(state().isMuted).toBe(false);
    });
  });

  describe('Play/Pause/Stop Controls', () => {
    it('sets isPlaying to true on play', () => {
      playbackStore.play?.();
      expect(state().isPlaying).toBe(true);
    });
    it('sets isPlaying to false on pause', () => {
      playbackStore.play?.();
      playbackStore.pause?.();
      expect(state().isPlaying).toBe(false);
    });
    it('stops playback and resets time', () => {
      playbackStore.seek?.(50);
      playbackStore.play?.();
      playbackStore.stop?.();
      expect(state().isPlaying).toBe(false);
      expect(state().currentTime).toBe(0);
    });
  });

  describe('Seeking', () => {
    it('sets current time when seeking', () => {
      playbackStore.seek?.(30);
      expect(state().currentTime).toBe(30);
    });
    it('allows seeking to zero', () => {
      playbackStore.seek?.(100);
      playbackStore.seek?.(0);
      expect(state().currentTime).toBe(0);
    });
    it('allows seeking beyond current duration', () => {
      playbackStore.seek?.(500);
      expect(state().currentTime).toBe(500);
    });
  });

  describe('Volume Control', () => {
    it('sets volume between 0 and 1', () => {
      playbackStore.setVolume?.(0.5);
      expect(state().masterVolume).toBe(0.5);
    });
    it('clamps volume to 1.0 when exceeding max', () => {
      playbackStore.setVolume?.(2.0);
      expect(state().masterVolume).toBe(1.0);
    });
    it('clamps volume to 0 when below min', () => {
      playbackStore.setVolume?.(-0.5);
      expect(state().masterVolume).toBe(0);
    });
    it('allows setting to 0 (mute volume)', () => {
      playbackStore.setVolume?.(0);
      expect(state().masterVolume).toBe(0);
    });
  });

  describe('Duration Management', () => {
    it('sets duration', () => {
      playbackStore.setDuration?.(240);
      expect(state().duration).toBe(240);
    });
    it('allows zero duration', () => {
      playbackStore.setDuration?.(0);
      expect(state().duration).toBe(0);
    });
    it('updates duration independently from currentTime', () => {
      playbackStore.seek?.(100);
      playbackStore.setDuration?.(300);
      expect(state().currentTime).toBe(100);
      expect(state().duration).toBe(300);
    });
  });

  describe('Mute Control', () => {
    it('sets muted state to true', () => {
      playbackStore.setMuted?.(true);
      expect(state().isMuted).toBe(true);
    });
    it('sets muted state to false', () => {
      playbackStore.setMuted?.(true);
      playbackStore.setMuted?.(false);
      expect(state().isMuted).toBe(false);
    });
  });

  describe('BPM Management', () => {
    it('sets BPM value', () => {
      playbackStore.setBpm?.(140);
      expect(state().bpm).toBe(140);
    });
    it('allows various BPM values', () => {
      playbackStore.setBpm?.(60);
      playbackStore.setBpm?.(200);
      expect(state().bpm).toBe(200);
    });
    it('allows slow tempos', () => {
      playbackStore.setBpm?.(40);
      expect(state().bpm).toBe(40);
    });
  });

  describe('Reset Function', () => {
    it('resets all state to initial values', () => {
      playbackStore.play?.();
      playbackStore.setVolume?.(0.3);
      playbackStore.setDuration?.(180);
      playbackStore.seek?.(45);
      playbackStore.setBpm?.(180);
      playbackStore.setMuted?.(true);
      playbackStore.reset?.();
      const s = state();
      expect(s.isPlaying).toBe(false);
      expect(s.currentTime).toBe(0);
      expect(s.duration).toBe(0);
      expect(s.masterVolume).toBe(1.0);
      expect(s.bpm).toBe(120);
      expect(s.isMuted).toBe(false);
    });
  });

  describe('Store Methods', () => {
    it('provides subscribe method', () => { expect(typeof playbackStore.subscribe).toBe('function'); });
    it('provides play method', () => { expect(typeof playbackStore.play).toBe('function'); });
    it('provides pause method', () => { expect(typeof playbackStore.pause).toBe('function'); });
    it('provides stop method', () => { expect(typeof playbackStore.stop).toBe('function'); });
    it('provides seek method', () => { expect(typeof playbackStore.seek).toBe('function'); });
    it('provides setVolume method', () => { expect(typeof playbackStore.setVolume).toBe('function'); });
    it('provides setDuration method', () => { expect(typeof playbackStore.setDuration).toBe('function'); });
    it('provides setMuted method', () => { expect(typeof playbackStore.setMuted).toBe('function'); });
    it('provides setBpm method', () => { expect(typeof playbackStore.setBpm).toBe('function'); });
    it('provides reset method', () => { expect(typeof playbackStore.reset).toBe('function'); });
  });

  describe('State Consistency', () => {
    it('maintains state across multiple operations', () => {
      playbackStore.setDuration?.(300);
      playbackStore.seek?.(150);
      playbackStore.setVolume?.(0.7);
      playbackStore.play?.();
      const s = state();
      expect(s.isPlaying).toBe(true);
      expect(s.currentTime).toBe(150);
      expect(s.duration).toBe(300);
      expect(s.masterVolume).toBe(0.7);
      expect(s.bpm).toBe(120);
    });
  });
});
