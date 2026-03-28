// @vitest-environment jsdom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

import { render, fireEvent } from '@testing-library/svelte';
import { get } from 'svelte/store';
import ProjectEditor from '../ProjectEditor.svelte';
import { projectStore } from '../../stores/projectStore';
import { playbackStore } from '../../stores/playbackStore';
import { audioEngine as mockAudioEngine } from '../../services/audioEngine';

vi.mock('../../services/audioEngine', () => ({
  audioEngine: {
    addTrack: vi.fn(), removeTrack: vi.fn(),
    play: vi.fn(), pause: vi.fn(), stop: vi.fn(), seek: vi.fn(),
    setMasterVolume: vi.fn(), setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(), setTrackSolo: vi.fn(),
    loadFile: vi.fn(),
    getTrackBuffer: vi.fn().mockReturnValue(null),
    hasAudio: vi.fn().mockReturnValue(false),
  },
  metronome: { start: vi.fn(), stop: vi.fn(), isActive: vi.fn().mockReturnValue(false) },
  tapTempo: { tap: vi.fn().mockReturnValue(null), reset: vi.fn() },
}));

vi.mock('../YouTubeImportModal.svelte', () => ({ default: { render: () => '' } }));
vi.mock('../../services/recordingService', () => ({
  recordingService: {
    start: vi.fn().mockResolvedValue(undefined), stop: vi.fn(),
    isRecording: vi.fn().mockReturnValue(false), getTrackId: vi.fn().mockReturnValue(null),
    onComplete: null,
  },
}));

const testProject = {
  id: 'kb-test', name: 'KB Test', bpm: 120, timeSignature: '4/4',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe('ProjectEditor Keyboard Shortcuts', () => {
  beforeEach(() => {
    (window as any).audioforge = {
      settings: {
        get: vi.fn().mockResolvedValue(false),
        set: vi.fn().mockResolvedValue(undefined),
        getAll: vi.fn().mockResolvedValue({}),
      },
      jobs: { list: vi.fn().mockResolvedValue([]) },
      health: {
        getStatus: vi.fn().mockResolvedValue({
          tools: [],
          system: { platform: 'darwin', arch: 'arm64', memory: { total: 0, used: 0 } },
        }),
      },
      files: { list: vi.fn().mockResolvedValue([]) },
      on: vi.fn().mockReturnValue(() => {}),
    };
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
    vi.clearAllMocks();
  });

  it('Space key triggers play when not playing', async () => {
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(mockAudioEngine.play).toHaveBeenCalled();
  });

  it('Space key triggers pause when already playing', async () => {
    render(ProjectEditor);
    // Start playback first via button
    const { container } = render(ProjectEditor);
    const playBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('Play')) as HTMLButtonElement;
    await fireEvent.click(playBtn);
    // Now simulate actual playing state
    playbackStore.play();
    await fireEvent.keyDown(window, { key: ' ', code: 'Space' });
    expect(mockAudioEngine.pause).toHaveBeenCalled();
  });

  it('Escape key triggers stop', async () => {
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: 'Escape', code: 'Escape' });
    expect(mockAudioEngine.stop).toHaveBeenCalled();
  });
});
