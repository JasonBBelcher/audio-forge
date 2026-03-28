import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, fireEvent } from '@testing-library/svelte';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

vi.mock('../../services/audioEngine', () => ({
  audioEngine: {
    addTrack: vi.fn(),
    removeTrack: vi.fn(),
    play: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seek: vi.fn(),
    setMasterVolume: vi.fn(),
    setTrackVolume: vi.fn(),
    setTrackMute: vi.fn(),
    setTrackSolo: vi.fn(),
    loadFile: vi.fn(),
    getTrackBuffer: vi.fn().mockReturnValue(null),
    hasAudio: vi.fn().mockReturnValue(false),
  },
  metronome: { start: vi.fn(), stop: vi.fn(), isActive: vi.fn().mockReturnValue(false) },
  tapTempo: { tap: vi.fn().mockReturnValue(null), reset: vi.fn() },
}));

vi.mock('../YouTubeImportModal.svelte', () => ({ default: { render: () => '' } }));
vi.mock('../ExportModal.svelte', () => ({
  default: vi.fn().mockImplementation(() => ({
    $set: vi.fn(), $destroy: vi.fn(), $on: vi.fn(),
  })),
}));
vi.mock('../../services/exportService', () => ({ exportService: { exportProject: vi.fn() } }));
vi.mock('../../services/recordingService', () => ({
  recordingService: { isRecording: vi.fn().mockReturnValue(false), start: vi.fn(), stop: vi.fn() },
}));

import ProjectEditor from '../ProjectEditor.svelte';
import { projectStore } from '../../stores/projectStore';
import { historyStore } from '../../stores/historyStore';

const testProject = {
  id: 'undo-test',
  name: 'Undo Test',
  bpm: 120,
  timeSignature: '4/4',
  key: 'C major',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('Undo/Redo keyboard shortcuts', () => {
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
    historyStore.clear();
    projectStore.setCurrentProject(testProject);
  });

  it('Ctrl+Z triggers undo', async () => {
    const undoSpy = vi.spyOn(historyStore, 'undo');
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true });
    expect(undoSpy).toHaveBeenCalledOnce();
    undoSpy.mockRestore();
  });

  it('Cmd+Z triggers undo on macOS', async () => {
    const undoSpy = vi.spyOn(historyStore, 'undo');
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: 'z', metaKey: true });
    expect(undoSpy).toHaveBeenCalledOnce();
    undoSpy.mockRestore();
  });

  it('Ctrl+Shift+Z triggers redo', async () => {
    const redoSpy = vi.spyOn(historyStore, 'redo');
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: 'z', ctrlKey: true, shiftKey: true });
    expect(redoSpy).toHaveBeenCalledOnce();
    redoSpy.mockRestore();
  });

  it('Cmd+Shift+Z triggers redo on macOS', async () => {
    const redoSpy = vi.spyOn(historyStore, 'redo');
    render(ProjectEditor);
    await fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true });
    expect(redoSpy).toHaveBeenCalledOnce();
    redoSpy.mockRestore();
  });

  it('Ctrl+Z does not fire when typing in an input', async () => {
    const undoSpy = vi.spyOn(historyStore, 'undo');
    const { container } = render(ProjectEditor);
    const input = document.createElement('input');
    container.appendChild(input);
    await fireEvent.keyDown(input, { key: 'z', ctrlKey: true });
    expect(undoSpy).not.toHaveBeenCalled();
    undoSpy.mockRestore();
  });
});

describe('Undo/Redo toolbar buttons', () => {
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
    historyStore.clear();
    projectStore.setCurrentProject(testProject);
  });

  it('renders an undo button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.title?.toLowerCase().includes('undo') || b.textContent?.toLowerCase().includes('undo'))).toBe(true);
  });

  it('renders a redo button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.title?.toLowerCase().includes('redo') || b.textContent?.toLowerCase().includes('redo'))).toBe(true);
  });

  it('undo button is disabled when nothing to undo', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    const undoBtn = btns.find(b => b.title?.toLowerCase().includes('undo') || b.textContent?.toLowerCase().includes('undo')) as HTMLButtonElement;
    expect(undoBtn.disabled).toBe(true);
  });

  it('clicking undo button calls historyStore.undo', async () => {
    const undoSpy = vi.spyOn(historyStore, 'undo');
    const { container } = render(ProjectEditor);
    // push a command so undo is enabled
    historyStore.push({ name: 'test', execute: vi.fn(), undo: vi.fn() });
    await new Promise(r => setTimeout(r, 0)); // let Svelte react
    const btns = Array.from(container.querySelectorAll('button'));
    const undoBtn = btns.find(b => b.title?.toLowerCase().includes('undo') || b.textContent?.toLowerCase().includes('undo')) as HTMLButtonElement;
    await fireEvent.click(undoBtn);
    expect(undoSpy).toHaveBeenCalled();
    undoSpy.mockRestore();
  });
});
