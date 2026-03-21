// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

// jsdom doesn't include ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));
import { render, fireEvent } from '@testing-library/svelte';
import ProjectEditor from '../ProjectEditor.svelte';
import { projectStore } from '../../stores/projectStore';
import { playbackStore } from '../../stores/playbackStore';

// Mock heavy imports that need browser APIs
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
    $set: vi.fn(),
    $destroy: vi.fn(),
    $on: vi.fn(),
  })),
}));
vi.mock('../../services/exportService', () => ({ exportService: { exportProject: vi.fn() } }));

const testProject = {
  id: 'editor-test',
  name: 'Editor Test',
  bpm: 140,
  timeSignature: '4/4',
  key: 'A minor',
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

describe('ProjectEditor Component', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
  });

  it('renders the empty state when no project selected', () => {
    projectStore.setCurrentProject(null);
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('No project selected');
  });

  it('renders project name when project is set', () => {
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('Editor Test');
  });

  it('renders BPM in header', () => {
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('140');
  });

  it('renders time signature in header', () => {
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('4/4');
  });

  it('renders transport section', () => {
    const { container } = render(ProjectEditor);
    expect(container.querySelector('.transport')).toBeTruthy();
  });

  it('renders play button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Play'))).toBe(true);
  });

  it('renders stop button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Stop'))).toBe(true);
  });

  it('renders arrange section', () => {
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('Arrange');
  });

  it('renders mixer section', () => {
    const { container } = render(ProjectEditor);
    expect(container.textContent).toContain('Mixer');
  });

  it('renders add track button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Track'))).toBe(true);
  });

  it('renders back button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Back'))).toBe(true);
  });

  it('renders metronome button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Metro'))).toBe(true);
  });

  it('renders master volume slider', () => {
    const { container } = render(ProjectEditor);
    const slider = container.querySelector('#master-volume');
    expect(slider).toBeTruthy();
  });

  it('renders Export Mix button', () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    expect(btns.some(b => b.textContent?.includes('Export'))).toBe(true);
  });

  it('shows export modal when Export Mix button is clicked', async () => {
    const { container } = render(ProjectEditor);
    const btns = Array.from(container.querySelectorAll('button'));
    const exportBtn = btns.find(b => b.textContent?.includes('Export')) as HTMLButtonElement;
    await fireEvent.click(exportBtn);
    expect(container.querySelector('.modal-overlay')).toBeTruthy();
  });
});