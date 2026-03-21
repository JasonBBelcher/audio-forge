import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashboardService } from '../../../../src/main/services/dashboard.service.js';

vi.mock('../../../../src/main/utils/process-runner.js');

describe('DashboardService', () => {
  let dashboard: DashboardService;

  beforeEach(() => {
    dashboard = new DashboardService(':memory:');
    vi.clearAllMocks();
  });

  it('initializes dashboard state', async () => {
    const state = await dashboard.getState();

    expect(state).toBeDefined();
    expect(state).toHaveProperty('currentProject');
    expect(state).toHaveProperty('tracks');
    expect(state).toHaveProperty('isPlaying');
    expect(state).toHaveProperty('currentTime');
  });

  it('sets current project', async () => {
    await dashboard.setCurrentProject('project-123');

    const state = await dashboard.getState();

    expect(state.currentProject).toBe('project-123');
  });

  it('adds track to dashboard', async () => {
    const track = {
      id: 'track-1',
      name: 'Drums',
      volume: 0.8,
      muted: false,
      solo: false,
    };

    await dashboard.addTrack(track);

    const state = await dashboard.getState();
    expect(state.tracks.some((t) => t.id === 'track-1')).toBe(true);
  });

  it('removes track from dashboard', async () => {
    const track = { id: 'track-1', name: 'Drums', volume: 0.8, muted: false, solo: false };
    await dashboard.addTrack(track);
    await dashboard.removeTrack('track-1');

    const state = await dashboard.getState();
    expect(state.tracks.some((t) => t.id === 'track-1')).toBe(false);
  });

  it('updates track properties', async () => {
    const track = { id: 'track-1', name: 'Drums', volume: 0.8, muted: false, solo: false };
    await dashboard.addTrack(track);

    await dashboard.updateTrack('track-1', { volume: 0.5, muted: true });

    const state = await dashboard.getState();
    const updated = state.tracks.find((t) => t.id === 'track-1');
    expect(updated?.volume).toBe(0.5);
    expect(updated?.muted).toBe(true);
  });

  it('plays audio', async () => {
    const playing = await dashboard.play();

    expect(playing).toBe(true);

    const state = await dashboard.getState();
    expect(state.isPlaying).toBe(true);
  });

  it('pauses audio', async () => {
    await dashboard.play();
    const paused = await dashboard.pause();

    expect(paused).toBe(true);

    const state = await dashboard.getState();
    expect(state.isPlaying).toBe(false);
  });

  it('seeks to time position', async () => {
    const seeked = await dashboard.seek(5.5);

    expect(seeked).toBe(true);

    const state = await dashboard.getState();
    expect(state.currentTime).toBe(5.5);
  });

  it('stops playback and resets position', async () => {
    await dashboard.play();
    await dashboard.seek(10);

    await dashboard.stop();

    const state = await dashboard.getState();
    expect(state.isPlaying).toBe(false);
    expect(state.currentTime).toBe(0);
  });

  it('mutes all tracks', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: false });
    await dashboard.addTrack({ id: 'track-2', name: 'Track 2', volume: 0.6, muted: false, solo: false });

    await dashboard.muteAll();

    const state = await dashboard.getState();
    expect(state.tracks.every((t) => t.muted)).toBe(true);
  });

  it('unmutes all tracks', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: true, solo: false });
    await dashboard.addTrack({ id: 'track-2', name: 'Track 2', volume: 0.6, muted: true, solo: false });

    await dashboard.unmuteAll();

    const state = await dashboard.getState();
    expect(state.tracks.every((t) => !t.muted)).toBe(true);
  });

  it('solos a track', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: false });
    await dashboard.addTrack({ id: 'track-2', name: 'Track 2', volume: 0.6, muted: false, solo: false });

    await dashboard.soloTrack('track-1');

    const state = await dashboard.getState();
    expect(state.tracks.find((t) => t.id === 'track-1')?.solo).toBe(true);
    expect(state.tracks.find((t) => t.id === 'track-2')?.solo).toBe(false);
  });

  it('clears solo on all tracks', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: true });
    await dashboard.addTrack({ id: 'track-2', name: 'Track 2', volume: 0.6, muted: false, solo: true });

    await dashboard.clearSolo();

    const state = await dashboard.getState();
    expect(state.tracks.every((t) => !t.solo)).toBe(true);
  });

  it('gets master volume', async () => {
    const volume = await dashboard.getMasterVolume();

    expect(typeof volume).toBe('number');
    expect(volume).toBeGreaterThanOrEqual(0);
    expect(volume).toBeLessThanOrEqual(1);
  });

  it('sets master volume', async () => {
    await dashboard.setMasterVolume(0.7);

    const volume = await dashboard.getMasterVolume();
    expect(volume).toBe(0.7);
  });

  it('tracks recent actions', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: false });

    const history = await dashboard.getActionHistory();

    expect(Array.isArray(history)).toBe(true);
    expect(history.length).toBeGreaterThan(0);
  });

  it('undoes last action', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: false });

    const undone = await dashboard.undo();

    expect(undone).toBe(true);

    const state = await dashboard.getState();
    expect(state.tracks.some((t) => t.id === 'track-1')).toBe(false);
  });

  it('redoes action', async () => {
    await dashboard.addTrack({ id: 'track-1', name: 'Track 1', volume: 0.8, muted: false, solo: false });
    await dashboard.undo();

    const redone = await dashboard.redo();

    expect(redone).toBe(true);

    const state = await dashboard.getState();
    expect(state.tracks.some((t) => t.id === 'track-1')).toBe(true);
  });
});
