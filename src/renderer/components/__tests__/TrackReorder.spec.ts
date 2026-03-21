// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

import { render } from '@testing-library/svelte';
import ProjectEditor from '../ProjectEditor.svelte';
import { projectStore } from '../../stores/projectStore';
import { playbackStore } from '../../stores/playbackStore';

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
  id: 'reorder-test', name: 'Reorder Test', bpm: 120, timeSignature: '4/4',
  createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
};

describe('ProjectEditor Navigation and Layout', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
    vi.clearAllMocks();
  });

  it('renders ProjectEditor with sidebar', () => {
    const { container } = render(ProjectEditor);
    expect(container.querySelector('.sidebar')).toBeTruthy();
  });

  it('renders main content area', () => {
    const { container } = render(ProjectEditor);
    expect(container.querySelector('.content-area')).toBeTruthy();
  });

  it('renders view content container', () => {
    const { container } = render(ProjectEditor);
    expect(container.querySelector('.view-content')).toBeTruthy();
  });

  it('has editor-main container', () => {
    const { container } = render(ProjectEditor);
    expect(container.querySelector('.editor-main')).toBeTruthy();
  });
});
