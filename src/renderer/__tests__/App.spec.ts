// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
import { render } from '@testing-library/svelte';
import App from '../App.svelte';
import { projectStore } from '../stores/projectStore';

vi.mock('../services/audioEngine', () => ({
  audioEngine: {
    addTrack: vi.fn(), removeTrack: vi.fn(), play: vi.fn(), pause: vi.fn(),
    stop: vi.fn(), seek: vi.fn(), setMasterVolume: vi.fn(), setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(), setTrackSolo: vi.fn(), loadFile: vi.fn(),
    getTrackBuffer: vi.fn().mockReturnValue(null), hasAudio: vi.fn().mockReturnValue(false),
  },
  metronome: { start: vi.fn(), stop: vi.fn(), isActive: vi.fn().mockReturnValue(false) },
  tapTempo: { tap: vi.fn().mockReturnValue(null), reset: vi.fn() },
}));

vi.mock('../components/NewProjectModal.svelte', () => ({ default: { render: () => '' } }));
vi.mock('../components/YouTubeImportModal.svelte', () => ({ default: { render: () => '' } }));

describe('App Component', () => {
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
    projectStore.setCurrentProject(null);
  });

  it('renders Dashboard when no project is selected', () => {
    const { container } = render(App);
    expect(container.querySelector('.dashboard')).toBeTruthy();
  });

  it('renders ProjectEditor when a project is selected', () => {
    projectStore.setCurrentProject({
      id: 'app-test',
      name: 'App Test',
      bpm: 120,
      timeSignature: '4/4',
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    const { container } = render(App);
    expect(container.querySelector('.editor')).toBeTruthy();
  });

  it('shows AudioForge title on dashboard', () => {
    const { container } = render(App);
    expect(container.textContent).toContain('AudioForge');
  });
});