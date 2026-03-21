// @vitest-environment jsdom
import { describe, it, expect, beforeEach, vi } from 'vitest';

global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

import { render, fireEvent } from '@testing-library/svelte';
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

describe('Track Reordering', () => {
  beforeEach(() => {
    projectStore.setCurrentProject(testProject);
    playbackStore.reset?.();
    vi.clearAllMocks();
  });

  it('each track row has a drag handle', () => {
    const { container } = render(ProjectEditor);
    const trackRows = container.querySelectorAll('.track-row');
    expect(trackRows.length).toBeGreaterThan(0);
    trackRows.forEach(row => {
      expect(row.querySelector('.drag-handle')).toBeTruthy();
    });
  });

  it('track rows have draggable attribute', () => {
    const { container } = render(ProjectEditor);
    const trackRows = container.querySelectorAll('.track-row');
    trackRows.forEach(row => {
      expect(row.getAttribute('draggable')).toBe('true');
    });
  });

  it('dragging a track changes its order', async () => {
    // Add a third track so we have 3: Track 1, Track 2, Track 3
    const { container } = render(ProjectEditor);
    const addBtn = Array.from(container.querySelectorAll('button'))
      .find(b => b.textContent?.includes('+') && b.textContent?.includes('Track')) as HTMLButtonElement;
    await fireEvent.click(addBtn);

    const rows = () => Array.from(container.querySelectorAll('.track-row'));
    expect(rows().length).toBe(3);

    const firstRow = rows()[0];
    const thirdRow = rows()[2];

    const firstName = firstRow.querySelector('.track-name')?.textContent?.trim();

    // Simulate drag: dragstart on first, dragover on third, drop on third
    await fireEvent.dragStart(firstRow, { dataTransfer: { setData: vi.fn(), effectAllowed: '' } });
    await fireEvent.dragOver(thirdRow, { preventDefault: vi.fn(), dataTransfer: { dropEffect: '' } });
    await fireEvent.drop(thirdRow, { preventDefault: vi.fn() });

    // First track should now be somewhere other than position 0
    const newRows = rows();
    const newFirstName = newRows[0].querySelector('.track-name')?.textContent?.trim();
    expect(newFirstName).not.toBe(firstName);
  });
});
